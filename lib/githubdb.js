/**
 * ==========================================================
 *  GITHUB DATABASE ENGINE - THE GHOST MINI OFC
 *  © POWERD BY SASA DEV OFC </>
 * ==========================================================
 *
 *  Uses a GitHub repository as the persistence layer.
 *
 *  DESIGN (important):
 *  GitHub is not a database. The API allows 5000 requests/hour and each
 *  commit costs 300-900ms. Baileys writes auth keys on almost every
 *  message, so committing per write would exhaust the quota in minutes
 *  and make the bot unusable.
 *
 *  Therefore:
 *   - ALL reads are served from an in-memory cache  -> zero latency
 *   - Writes mark a file dirty and are flushed in a DEBOUNCED batch
 *   - Multiple files in one flush are pushed as ONE git commit
 *     (Git Data API: blob -> tree -> commit -> ref)
 *   - A hard interval guarantees data is never held too long
 *   - Flush on shutdown so nothing is lost on dyno restart
 *
 *  Files created automatically under database/ :
 *    user.json      registered users, economy, xp, afk
 *    premium.json   premium user list
 *    banned.json    banned user list
 *    admin.json     bot admins / owners
 *    creds.json     WhatsApp session credentials + auth keys
 *    groups.json    per group settings
 *    settings.json  global bot settings
 *    sessions.json  session registry and status
 */

const axios = require('axios');
const config = require('../config');

const API = 'https://api.github.com';

/* ---------- file registry ---------- */
const FILES = {
  user:     'user.json',
  premium:  'premium.json',
  banned:   'banned.json',
  admin:    'admin.json',
  creds:    'creds.json',
  groups:   'groups.json',
  settings: 'settings.json',
  sessions: 'sessions.json'
};

const DEFAULTS = {
  user:     {},
  premium:  [],
  banned:   [],
  admin:    () => config.OWNER_NUMBERS.slice(),
  creds:    {},
  groups:   {},
  settings: {},
  sessions: {}
};

/* ---------- state ---------- */
const cache = new Map();     // key -> parsed JSON
const shas  = new Map();     // path -> blob sha (for conflict-free updates)
const dirty = new Set();     // keys awaiting flush

let ready = false;
let flushTimer = null;
let flushing = false;
let pendingAgain = false;
let lastError = null;
let stats = { commits: 0, reads: 0, writes: 0, apiCalls: 0, lastCommit: null, rateRemaining: null };

const OWNER  = () => config.GITHUB_OWNER;
const REPO   = () => config.GITHUB_REPO;
const BRANCH = () => config.GITHUB_BRANCH;
const DIR    = () => config.GITHUB_DB_DIR;
const pathOf = (key) => `${DIR()}/${FILES[key]}`;

function http() {
  return axios.create({
    baseURL: API,
    timeout: 30000,
    headers: {
      Authorization: `token ${config.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'GhostMiniOFC-DB',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    validateStatus: () => true
  });
}

function track(res) {
  stats.apiCalls++;
  const rem = res?.headers?.['x-ratelimit-remaining'];
  if (rem !== undefined) stats.rateRemaining = Number(rem);
  return res;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** GitHub occasionally returns 409/422 on concurrent ref updates - retry. */
async function withRetry(fn, label, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fn();
      if (r.status < 300) return r;
      last = new Error(`${label}: HTTP ${r.status} ${JSON.stringify(r.data?.message || '').slice(0, 120)}`);
      if (![409, 422, 500, 502, 503].includes(r.status)) throw last;
    } catch (e) { last = e; }
    await sleep(400 * Math.pow(2, i));
  }
  throw last;
}

/* ============================================================
   BOOTSTRAP - create database/ and every file if missing
   ============================================================ */
async function init() {
  if (!config.GITHUB_TOKEN || !config.GITHUB_OWNER || !config.GITHUB_REPO) {
    const missing = [];
    if (!config.GITHUB_TOKEN) missing.push('GITHUB_TOKEN');
    if (!config.GITHUB_OWNER) missing.push('GITHUB_OWNER');
    if (!config.GITHUB_REPO)  missing.push('GITHUB_REPO');
    lastError = {
      code: 'GITHUB_NOT_CONFIGURED',
      human: `GitHub database is not configured. Missing: ${missing.join(', ')}`,
      missing,
      fix: [
        `Run: heroku config:set ${missing.map(m => m + '=...').join(' ')}`,
        'GITHUB_TOKEN must be a Personal Access Token with the "repo" scope',
        'Then restart the app: heroku restart'
      ]
    };
    throw new Error(lastError.code);
  }

  const c = http();

  /* verify repo + token */
  const repo = track(await c.get(`/repos/${OWNER()}/${REPO()}`));
  if (repo.status === 401) {
    lastError = { code: 'BAD_TOKEN', human: 'GitHub token is invalid or expired.', fix: ['Generate a new token with "repo" scope', 'Update the GITHUB_TOKEN config var'] };
    throw new Error(lastError.code);
  }
  if (repo.status === 404) {
    lastError = { code: 'REPO_NOT_FOUND', human: `Repository ${OWNER()}/${REPO()} was not found.`, fix: ['Check GITHUB_OWNER and GITHUB_REPO', 'For a private repo the token needs full "repo" scope'] };
    throw new Error(lastError.code);
  }
  if (repo.status >= 300) {
    lastError = { code: 'GITHUB_ERROR', human: `GitHub returned HTTP ${repo.status}.`, fix: [String(repo.data?.message || '').slice(0, 160)] };
    throw new Error(lastError.code);
  }

  if (!config.GITHUB_BRANCH) config.GITHUB_BRANCH = repo.data.default_branch || 'main';

  /* load existing files */
  const missing = [];
  for (const key of Object.keys(FILES)) {
    const res = track(await c.get(`/repos/${OWNER()}/${REPO()}/contents/${encodeURI(pathOf(key))}`, { params: { ref: BRANCH() } }));
    if (res.status === 200 && res.data?.content) {
      try {
        cache.set(key, JSON.parse(Buffer.from(res.data.content, 'base64').toString('utf8')));
        shas.set(pathOf(key), res.data.sha);
      } catch {
        cache.set(key, defaultFor(key));
        missing.push(key);
      }
    } else {
      cache.set(key, defaultFor(key));
      missing.push(key);
    }
    stats.reads++;
  }

  /* create any file that does not exist yet - one commit for all */
  if (missing.length) {
    console.log(`[GH-DB] Creating ${missing.length} file(s) in ${DIR()}/ ...`);
    missing.forEach(k => dirty.add(k));
    await flush(true);
  }

  ready = true;
  lastError = null;
  console.log(`[GH-DB] Connected -> ${OWNER()}/${REPO()}@${BRANCH()}:${DIR()}/  (${Object.keys(FILES).length} files)`);
  console.log(`[GH-DB] API quota remaining: ${stats.rateRemaining ?? 'unknown'}`);

  /* safety-net interval flush */
  setInterval(() => { if (dirty.size) flush().catch(() => {}); }, config.GH_FLUSH_INTERVAL_MS);
  return true;
}

function defaultFor(key) {
  const d = DEFAULTS[key];
  return typeof d === 'function' ? d() : JSON.parse(JSON.stringify(d));
}

/* ============================================================
   READ / WRITE  (memory speed)
   ============================================================ */
function get(key) {
  if (!cache.has(key)) cache.set(key, defaultFor(key));
  return cache.get(key);
}

function set(key, value, immediate = false) {
  cache.set(key, value);
  dirty.add(key);
  stats.writes++;
  schedule(immediate);
  return value;
}

/** Mutate in place then persist. */
function update(key, mutator, immediate = false) {
  const data = get(key);
  const out = mutator(data);
  const final = out === undefined ? data : out;
  return set(key, final, immediate);
}

function schedule(immediate = false) {
  if (flushing) { pendingAgain = true; return; }
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flush().catch(e => console.warn('[GH-DB] flush error:', e.message)),
    immediate ? 150 : config.GH_FLUSH_DEBOUNCE_MS);
}

/* ============================================================
   FLUSH - all dirty files in a SINGLE commit
   ============================================================ */
/* Serialises every flush. force=true used to bypass this guard, which let
   a debounced commit and an urgent one run at the same time: both read the
   same base commit SHA, so the second silently overwrote the first and the
   freshly paired credentials were lost. Now callers queue behind the
   in-flight commit instead of racing it. */
let flushChain = Promise.resolve();

function flush(force = false) {
  const run = () => _flush(force);
  flushChain = flushChain.then(run, run);
  return flushChain;
}

async function _flush(force = false) {
  if (!dirty.size) return { committed: 0 };

  flushing = true;
  const keys = Array.from(dirty);
  dirty.clear();

  try {
    const c = http();
    const owner = OWNER(), repo = REPO(), branch = BRANCH();

    /* single file -> cheap contents API (2 calls) */
    if (keys.length === 1) {
      const key = keys[0];
      const p = pathOf(key);
      const body = {
        message: `chore(db): update ${FILES[key]} [skip ci]`,
        content: Buffer.from(JSON.stringify(cache.get(key), null, 2)).toString('base64'),
        branch
      };
      const sha = shas.get(p);
      if (sha) body.sha = sha;

      let res = track(await c.put(`/repos/${owner}/${repo}/contents/${encodeURI(p)}`, body));

      /* stale sha -> refetch and retry once */
      if (res.status === 409 || res.status === 422) {
        const cur = track(await c.get(`/repos/${owner}/${repo}/contents/${encodeURI(p)}`, { params: { ref: branch } }));
        if (cur.status === 200) body.sha = cur.data.sha; else delete body.sha;
        res = track(await c.put(`/repos/${owner}/${repo}/contents/${encodeURI(p)}`, body));
      }
      if (res.status >= 300) throw new Error(`contents PUT ${res.status}: ${JSON.stringify(res.data?.message).slice(0, 120)}`);

      shas.set(p, res.data.content.sha);
      stats.commits++; stats.lastCommit = new Date().toISOString();
    } else {
      /* multi file -> Git Data API, ONE commit for everything (5 calls) */
      const refRes = await withRetry(() => c.get(`/repos/${owner}/${repo}/git/ref/heads/${branch}`), 'get ref');
      track(refRes);
      const baseSha = refRes.data.object.sha;

      const commitRes = track(await c.get(`/repos/${owner}/${repo}/git/commits/${baseSha}`));
      const baseTree = commitRes.data.tree.sha;

      const blobs = [];
      for (const key of keys) {
        const b = await withRetry(() => c.post(`/repos/${owner}/${repo}/git/blobs`, {
          content: Buffer.from(JSON.stringify(cache.get(key), null, 2)).toString('base64'),
          encoding: 'base64'
        }), 'blob');
        track(b);
        blobs.push({ path: pathOf(key), mode: '100644', type: 'blob', sha: b.data.sha });
      }

      const treeRes = await withRetry(() => c.post(`/repos/${owner}/${repo}/git/trees`, { base_tree: baseTree, tree: blobs }), 'tree');
      track(treeRes);

      const newCommit = await withRetry(() => c.post(`/repos/${owner}/${repo}/git/commits`, {
        message: `chore(db): sync ${keys.length} file(s) [skip ci]\n\n${keys.map(k => '- ' + FILES[k]).join('\n')}`,
        tree: treeRes.data.sha,
        parents: [baseSha]
      }), 'commit');
      track(newCommit);

      await withRetry(() => c.patch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha: newCommit.data.sha, force: false }), 'ref update');

      /* refresh blob shas so the fast path stays valid */
      for (const key of keys) shas.delete(pathOf(key));
      stats.commits++; stats.lastCommit = new Date().toISOString();
    }

    lastError = null;
    if (config.GH_LOG_COMMITS) console.log(`[GH-DB] Committed ${keys.length} file(s). Quota left: ${stats.rateRemaining ?? '?'}`);
    return { committed: keys.length };
  } catch (e) {
    /* never lose data - put the keys back */
    keys.forEach(k => dirty.add(k));
    lastError = { code: 'FLUSH_FAILED', human: 'Could not save data to GitHub.', fix: [e.message.slice(0, 180)] };
    console.warn('[GH-DB] flush failed, will retry:', e.message.slice(0, 150));
    setTimeout(() => flush().catch(() => {}), 15000);
    throw e;
  } finally {
    flushing = false;
    if (pendingAgain) { pendingAgain = false; schedule(); }
  }
}

/* ============================================================
   SHUTDOWN SAFETY
   ============================================================ */
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(flushTimer);
  if (dirty.size) {
    console.log(`[GH-DB] Saving ${dirty.size} pending file(s) before exit...`);
    try { await flush(true); console.log('[GH-DB] Saved.'); }
    catch (e) { console.error('[GH-DB] Final save failed:', e.message); }
  }
}

module.exports = {
  init, get, set, update, flush, shutdown,
  FILES, pathOf,
  isReady: () => ready,
  getLastError: () => lastError,
  getStats: () => ({ ...stats, dirty: dirty.size, cached: cache.size, ready }),
  _cache: cache
};
