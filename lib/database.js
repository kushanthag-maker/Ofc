**
 * DATA LAYER - THE GHOST MINI OFC
 * Backed by the GitHub repository (see lib/githubdb.js).
 *
 * Exposes the same helper surface the plugins already use
 * (getUser, getGroup, User.find..., etc.) so no plugin needed rewriting.
 */
const gh = require('./mongodb');
const config = require('../config');

const now = () => new Date().toISOString();
const numOf = (jid) => String(jid || '').split('@')[0].split(':')[0];

/* ============================================================
   CONNECT
   ============================================================ */
async function connectDB() {
  await gh.init();
  return true;
}

const isConnected = () => gh.isReady();
const getLastError = () => gh.getLastError();

/* ============================================================
   USERS
   ============================================================ */
function blankUser(jid, name = '') {
  return {
    jid,
    number: numOf(jid),
    name,
    commandCount: 0,
    lastCommand: null,
    warns: 0,
    economy: { balance: 1000, bank: 0, lastDaily: null, lastWork: null, lastRob: null, xp: 0, level: 1 },
    afk: { active: false, reason: '', since: null },
    firstSeen: now(),
    lastSeen: now()
  };
}

/** Returns a live object; call .save() to persist. */
function wrapUser(jid, raw) {
  const obj = { ...raw };
  Object.defineProperty(obj, 'save', {
    enumerable: false,
    value: async function () {
      gh.update('user', (db) => {
        const { save, banned, premium, ...clean } = this;
        db[jid] = { ...clean, lastSeen: now() };
      });
      if (this.banned !== undefined) setBanned(jid, this.banned);
      if (this.premium !== undefined) setPremium(jid, this.premium);
      return this;
    }
  });
  obj.banned = isBanned(jid);
  obj.premium = isPremium(jid);
  return obj;
}

async function getUser(jid, name = '') {
  if (!jid) return null;
  const db = gh.get('user');
  if (!db[jid]) {
    db[jid] = blankUser(jid, name);
    gh.set('user', db);
  } else if (name && db[jid].name !== name) {
    db[jid].name = name;
  }
  return wrapUser(jid, db[jid]);
}

function allUsers() {
  return Object.entries(gh.get('user')).map(([jid, u]) => ({ ...u, jid, banned: isBanned(jid), premium: isPremium(jid) }));
}

/* ---------- banned / premium / admin lists ---------- */
const listHas = (key, jid) => {
  const n = numOf(jid);
  return gh.get(key).some(x => numOf(x) === n);
};
function listAdd(key, jid) {
  const n = numOf(jid);
  gh.update(key, (arr) => { if (!arr.some(x => numOf(x) === n)) arr.push(n); }, true);
}
function listRemove(key, jid) {
  const n = numOf(jid);
  gh.update(key, (arr) => arr.filter(x => numOf(x) !== n), true);
}

const isBanned  = (jid) => listHas('banned', jid);
const isPremium = (jid) => listHas('premium', jid);
const isAdmin   = (jid) => listHas('admin', jid) || config.OWNER_NUMBERS.includes(numOf(jid));

const setBanned  = (jid, v) => v ? listAdd('banned', jid)  : listRemove('banned', jid);
const setPremium = (jid, v) => v ? listAdd('premium', jid) : listRemove('premium', jid);
const setAdmin   = (jid, v) => v ? listAdd('admin', jid)   : listRemove('admin', jid);

const bannedList  = () => gh.get('banned');
const premiumList = () => gh.get('premium');
const adminList   = () => gh.get('admin');

/* ============================================================
   GROUPS
   ============================================================ */
function blankGroup(jid, name = '') {
  return {
    jid, name,
    antilink: false, antilinkAction: 'delete',
    antibadword: false, antibot: false, antisticker: false,
    welcome: false, welcomeText: '',
    goodbye: false, goodbyeText: '',
    mute: false, nsfw: false, autoSticker: false,
    filters: {},
    createdAt: now()
  };
}

function wrapGroup(jid, raw) {
  const obj = { ...raw };
  Object.defineProperty(obj, 'save', {
    enumerable: false,
    value: async function () {
      gh.update('groups', (db) => {
        const { save, ...clean } = this;
        db[jid] = clean;
      });
      return this;
    }
  });
  return obj;
}

async function getGroup(jid, name = '') {
  if (!jid) return null;
  const db = gh.get('groups');
  if (!db[jid]) { db[jid] = blankGroup(jid, name); gh.set('groups', db); }
  else if (name && db[jid].name !== name) db[jid].name = name;
  return wrapGroup(jid, db[jid]);
}

/* ============================================================
   SETTINGS  +  COMMAND STATS
   ============================================================ */
async function getSetting(key, def = null) {
  const s = gh.get('settings');
  return key in s ? s[key] : def;
}
async function setSetting(key, value) {
  gh.update('settings', (s) => { s[key] = value; });
  return value;
}

async function bumpCommand(jid, cmd) {
  try {
    gh.update('user', (db) => {
      if (!db[jid]) db[jid] = blankUser(jid);
      db[jid].commandCount = (db[jid].commandCount || 0) + 1;
      db[jid].lastCommand = cmd;
      db[jid].lastSeen = now();
    });
    gh.update('settings', (s) => {
      if (!s._commandStats) s._commandStats = {};
      s._commandStats[cmd] = (s._commandStats[cmd] || 0) + 1;
    });
  } catch (_) {}
}

function commandStats() {
  const s = gh.get('settings')._commandStats || {};
  return Object.entries(s).map(([command, count]) => ({ command, count })).sort((a, b) => b.count - a.count);
}

/* ============================================================
   SESSIONS  (registry)
   ============================================================ */
async function getSession(sessionId) {
  return gh.get('sessions')[sessionId] || null;
}
async function saveSession(sessionId, patch) {
  gh.update('sessions', (db) => {
    db[sessionId] = { ...(db[sessionId] || {}), ...patch, sessionId, updatedAt: now() };
  }, true);
  return true;
}
async function deleteSession(sessionId) {
  gh.update('sessions', (db) => { delete db[sessionId]; }, true);
  gh.update('creds', (db) => { delete db[sessionId]; }, true);
  return true;
}
function allSessions() {
  return Object.values(gh.get('sessions'));
}

/* ============================================================
   COMPAT SHIMS
   Plugins were written against Mongoose models. These provide the
   handful of query methods those plugins actually call.
   ============================================================ */
function sortBy(arr, spec) {
  const [field, dir] = Object.entries(spec || {})[0] || [];
  if (!field) return arr;
  const pick = (o) => {
    const v = field.split('.').reduce((a, k) => (a || {})[k], o);
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    const t = Date.parse(v);                 // ISO date strings sort chronologically
    return Number.isNaN(t) ? String(v) : t;
  };
  return [...arr].sort((a, b) => {
    const x = pick(a), y = pick(b);
    const c = (typeof x === 'string' || typeof y === 'string') ? String(x).localeCompare(String(y)) : x - y;
    return dir === 1 ? c : -c;
  });
}

function matches(item, q = {}) {
  return Object.entries(q).every(([k, v]) => {
    const val = k.split('.').reduce((a, kk) => (a || {})[kk], item);
    if (v && typeof v === 'object' && '$in' in v) return v.$in.includes(val);
    return val === v;
  });
}

function makeQuery(getAll) {
  return function find(q = {}) {
    let rows = getAll().filter(r => matches(r, q));
    const chain = {
      sort(s) { rows = sortBy(rows, s); return chain; },
      limit(n) { rows = rows.slice(0, n); return chain; },
      lean() { return Promise.resolve(rows); },
      then(res, rej) { return Promise.resolve(rows).then(res, rej); }
    };
    return chain;
  };
}

const User = {
  find: makeQuery(allUsers),
  findOne: async (q = {}) => {
    const hit = allUsers().find(u => matches(u, q));
    return hit ? wrapUser(hit.jid, gh.get('user')[hit.jid]) : null;
  },
  countDocuments: async (q = {}) => allUsers().filter(u => matches(u, q)).length,
  updateOne: async (q, upd) => {
    const jid = q.jid;
    if (!jid) return;
    gh.update('user', (db) => {
      if (!db[jid]) db[jid] = blankUser(jid);
      if (upd.$inc) for (const [k, v] of Object.entries(upd.$inc)) db[jid][k] = (db[jid][k] || 0) + v;
      if (upd.$set) Object.assign(db[jid], upd.$set);
    });
  }
};

const Group = {
  find: makeQuery(() => Object.values(gh.get('groups'))),
  findOne: async (q = {}) => {
    const hit = Object.values(gh.get('groups')).find(g => matches(g, q));
    return hit ? wrapGroup(hit.jid, hit) : null;
  },
  countDocuments: async () => Object.keys(gh.get('groups')).length
};

const Session = {
  find: makeQuery(allSessions),
  findOne: (q = {}) => {
    const hit = allSessions().find(s => matches(s, q));
    const chain = { lean: () => Promise.resolve(hit || null), then: (r, j) => Promise.resolve(hit || null).then(r, j) };
    return chain;
  },
  countDocuments: async (q = {}) => allSessions().filter(s => matches(s, q)).length,
  updateOne: async (q, upd) => saveSession(q.sessionId, upd.$set || {}),
  deleteOne: async (q) => deleteSession(q.sessionId)
};

const Stat = {
  find: makeQuery(commandStats),
  updateOne: async () => {}
};

/* anti-delete is memory only - it expires in 24h and must never spam commits */
const antiDeleteStore = new Map();
setInterval(() => {
  const cutoff = Date.now() - 86400000;
  for (const [k, v] of antiDeleteStore) if (v._t < cutoff) antiDeleteStore.delete(k);
}, 600000).unref?.();

const AntiDelete = {
  create: async (doc) => { antiDeleteStore.set(doc.msgId, { ...doc, _t: Date.now() }); return doc; },
  findOne: async (q) => antiDeleteStore.get(q.msgId) || null,
  deleteOne: async (q) => { if (q.msgId) antiDeleteStore.delete(q.msgId); else for (const [k, v] of antiDeleteStore) if (v === q._id) antiDeleteStore.delete(k); },
  deleteMany: async () => { const n = antiDeleteStore.size; antiDeleteStore.clear(); return { deletedCount: n }; },
  countDocuments: async () => antiDeleteStore.size
};

const Setting = {
  findOne: async (q) => { const s = gh.get('settings'); return q.key in s ? { key: q.key, value: s[q.key] } : null; },
  updateOne: async (q, upd) => setSetting(q.key, upd.$set?.value)
};

module.exports = {
  connectDB, isConnected, getLastError,
  gh, flush: gh.flush, shutdown: gh.shutdown, getStats: gh.getStats,

  getUser, allUsers, getGroup,
  getSetting, setSetting, bumpCommand, commandStats,
  getSession, saveSession, deleteSession, allSessions,

  isBanned, isPremium, isAdmin,
  setBanned, setPremium, setAdmin,
  bannedList, premiumList, adminList,

  /* mongoose-compatible shims */
  User, Group, Session, Stat, AntiDelete, Setting
};
