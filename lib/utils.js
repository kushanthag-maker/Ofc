/**
 * Shared utilities - THE GHOST MINI OFC
 */
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

const FOOTER = config.FOOTER;

/* ---------- text ---------- */
const withFooter = (text = '') => `${text}\n\n${FOOTER}`;

const box = (title, body) =>
  `╭━━━〔 *${title}* 〕━━━┈⊷\n` +
  body.split('\n').map(l => `┃ ${l}`).join('\n') +
  `\n╰━━━━━━━━━━━━━━━┈⊷`;

const monospace = (t) => '```' + t + '```';

const runtime = (seconds) => {
  seconds = Number(seconds);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
};

const formatBytes = (bytes, dec = 2) => {
  if (!+bytes) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dec))} ${sizes[i]}`;
};

const now = () => new Date().toLocaleString('en-GB', { timeZone: config.TIMEZONE });
const timeOnly = () => new Date().toLocaleTimeString('en-GB', { timeZone: config.TIMEZONE });
const dateOnly = () => new Date().toLocaleDateString('en-GB', { timeZone: config.TIMEZONE });

const greeting = () => {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: config.TIMEZONE, hour: '2-digit', hour12: false }));
  if (h < 5) return 'Good Night';
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Good Night';
};

const randomId = (n = 10) => crypto.randomBytes(n).toString('hex').slice(0, n);
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const capitalize = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

const toSmallCaps = (str) => {
  const map = { a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'q',r:'ʀ',s:'ѕ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ' };
  return String(str).toLowerCase().split('').map(c => map[c] || c).join('');
};

/* ---------- validation ---------- */
const isUrl = (t) => /https?:\/\/[^\s]+/i.test(String(t || ''));
const extractUrl = (t) => { const m = String(t || '').match(/https?:\/\/[^\s]+/i); return m ? m[0] : null; };
const isNumeric = (t) => /^[0-9]+$/.test(String(t || ''));

/* ---------- SASA TECH API ---------- */
const api = axios.create({
  baseURL: config.API_BASE,
  timeout: 90000,
  headers: { 'x-api-key': config.API_KEY, 'User-Agent': 'GhostMiniOFC/1.0' },
  validateStatus: () => true
});

async function sasaApi(path, params = {}) {
  try {
    const res = await api.get(path, { params: { ...params, apiKey: config.API_KEY } });
    if (typeof res.data === 'string') {
      return { status: false, err: 'Endpoint not available' };
    }
    return res.data || { status: false, err: 'Empty response' };
  } catch (e) {
    return { status: false, err: e.message };
  }
}

async function getBuffer(url, opts = {}) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: config.MAX_UPLOAD_MB * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    ...opts
  });
  return Buffer.from(res.data);
}

async function getJson(url, opts = {}) {
  const res = await axios.get(url, { timeout: 60000, ...opts });
  return res.data;
}

/* ---------- jid ---------- */
const decodeJid = (jid) => {
  if (!jid) return jid;
  if (/:\d+@/gi.test(jid)) {
    const d = jid.split('@');
    return `${d[0].split(':')[0]}@${d[1]}`;
  }
  return jid;
};

const numToJid = (num) => `${String(num).replace(/[^0-9]/g, '')}@s.whatsapp.net`;
const jidToNum = (jid) => String(jid || '').split('@')[0].split(':')[0];

/* ---------- misc ---------- */
const progressBar = (percent, len = 12) => {
  const filled = Math.round((percent / 100) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled) + ` ${percent}%`;
};

const truncate = (s, n = 60) => (String(s).length > n ? String(s).slice(0, n - 3) + '...' : String(s));

module.exports = {
  FOOTER, withFooter, box, monospace, runtime, formatBytes,
  now, timeOnly, dateOnly, greeting, randomId, pickRandom, sleep, capitalize,
  toSmallCaps, isUrl, extractUrl, isNumeric, sasaApi, getBuffer, getJson,
  decodeJid, numToJid, jidToNum, progressBar, truncate, axios
};
