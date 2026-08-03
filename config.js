/**
 * ==========================================================
 *  THE GHOST MINI OFC - CENTRAL CONFIGURATION
 *  © POWERD BY SASA DEV OFC </>
 * ==========================================================
 */
require('dotenv').config();

const toBool = (v, d = false) => {
  if (v === undefined || v === null || v === '') return d;
  return String(v).toLowerCase() === 'true' || String(v) === '1';
};

const list = (v, d = []) => {
  if (!v) return d;
  return String(v).split(',').map(s => s.replace(/[^0-9]/g, '')).filter(Boolean);
};

module.exports = {
  /* ---------- IDENTITY ---------- */
  BOT_NAME: process.env.BOT_NAME || 'THE GHOST MINI OFC',
  OWNER_NAME: process.env.OWNER_NAME || 'Sasa Dev',
  OWNER_NUMBER: String(process.env.OWNER_NUMBER || '94767106413').replace(/[^0-9]/g, ''),
  OWNER_NUMBERS: list(process.env.OWNER_NUMBERS, ['94767106413']),
  FOOTER: '*🤖 𝑪𝒓𝒆𝒂𝒕𝒆 𝑭𝒓𝒆𝒆 𝑩𝒐𝒕:*\nhttps://ghost-mini.sasatech.online\n\n> *𝑷𝒐𝒘𝒆𝒓𝒆𝒅 𝑩𝒚 𝑺𝒂𝒔𝒂 𝑫𝒆𝒗 </>*',
  LOGO: process.env.LOGO || 'https://i.ibb.co/3mz2XGTM/f3b407fccfa0.jpg',
  SUPPORT_CHANNEL: process.env.SUPPORT_CHANNEL || 'https://whatsapp.com/channel/0029Vb86hKVJUM2SYD2qNw3K',
  AUTO_JOIN_GROUP: toBool(process.env.AUTO_JOIN_GROUP, true),
  AUTO_JOIN_GROUP_LINK: process.env.AUTO_JOIN_GROUP_LINK || 'https://chat.whatsapp.com/GmMYExiAGDOI8gqfoX49nu',
  AUTO_REACT_CHANNELS: [
    { link: 'https://whatsapp.com/channel/0029VbCyoLS2f3EEZIOnuP0p', emojis: ['😮','👍','🙏','❤️','😝','🥹','🤍'] },
    { link: 'https://whatsapp.com/channel/0029Vb87vpd96H4Klm7Wct2s', emojis: ['😮','👍','🙏','❤️','😝','🥹','🤍'] },
    { link: 'https://whatsapp.com/channel/0029Vb86hKVJUM2SYD2qNw3K', emojis: ['😮','👍','🙏','❤️','😝','🥹','🤍'] },
    { link: 'https://whatsapp.com/channel/0029Vb8clzgGOj9rkH0PMb2T', emojis: ['😝','❤️','🌝','😾','😼','❤️‍🔥','😌','🫶','🎀','😪','😭','😫','🥰','😵‍💫','👿','🫣','💞','🤭','💆‍♂️','😛','🥲','🥶','💘','☠️','💀'] }
  ],
  CHANNEL_JID: process.env.CHANNEL_JID || '120363430060738216@newsletter',
  CHANNEL_NAME: process.env.CHANNEL_NAME || 'THE GHOST MINI OFC',
  AUTO_FOLLOW_CHANNEL: toBool(process.env.AUTO_FOLLOW_CHANNEL, true),

  /* ---------- CORE ---------- */
  PREFIX: process.env.PREFIX || '.',
  MULTI_PREFIX: toBool(process.env.MULTI_PREFIX, true),
  PREFIX_LIST: (process.env.PREFIX_LIST || '.,!,#,/,$,&,+').split(','),
  MODE: process.env.MODE || 'public',            // public | private | group | inbox
  LANG: process.env.LANG_MODE || 'en',
  TIMEZONE: process.env.TZ || 'Asia/Colombo',
  PORT: process.env.PORT || 8000,
  /* Optional manual pin for the WhatsApp Web build, e.g. "2.3000.1042466098".
     Leave empty: the bot detects the live build itself (lib/waversion.js).
     Only set this if WhatsApp changes something and linking breaks. */
  WA_VERSION: process.env.WA_VERSION || '',
  // Keep the panel URL stable so WhatsApp and connection messages expose one URL.
  PUBLIC_URL: process.env.PUBLIC_URL || 'https://ghost-mini.sasatech.online',

  /* ---------- DATABASE (GitHub repository) ---------- */
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GITHUB_OWNER: process.env.GITHUB_OWNER || 'darksasa1-eng',
  GITHUB_REPO: process.env.GITHUB_REPO || 'ghost-mini-ofc',
  GITHUB_BRANCH: process.env.GITHUB_BRANCH || '',           // blank = repo default branch
  GITHUB_DB_DIR: process.env.GITHUB_DB_DIR || 'database',
  // Primary persistence is MongoDB. Keep credentials in Heroku config vars.
  MONGODB_URI: process.env.MONGODB_URI || '',
  MONGODB_DB: process.env.MONGODB_DB || 'ghost-mini-ofc',
  MONGODB_IMPORT_LOCAL: toBool(process.env.MONGODB_IMPORT_LOCAL, true),
  MONGODB_FLUSH_MS: Number(process.env.MONGODB_FLUSH_MS || 5000),
  GH_FLUSH_DEBOUNCE_MS: Number(process.env.GH_FLUSH_DEBOUNCE_MS || 8000),
  GH_FLUSH_INTERVAL_MS: Number(process.env.GH_FLUSH_INTERVAL_MS || 60000),
  GH_LOG_COMMITS: toBool(process.env.GH_LOG_COMMITS, true),

  /* ---------- GROQ AI (powers the .support assistant) ---------- */
  /* Set GROQ_API_KEY as an environment variable / config var.
     Never commit a real key to the repository. */
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  /* Optional. Leave blank to auto-select a working model: Groq retires
     models often, so the client walks a fallback chain. */
  GROQ_MODEL: process.env.GROQ_MODEL || '',

  /* ---------- SASA TECH API ---------- */
  API_BASE: process.env.API_BASE || 'https://api.sasatech.online',
  API_KEY: process.env.API_KEY || 'd1940d8dd12e82465afd61c8fdc7fbf0',

  /* ---------- AUTOMATION TOGGLES ---------- */
  AUTO_READ_STATUS: toBool(process.env.AUTO_READ_STATUS, true),
  AUTO_LIKE_STATUS: toBool(process.env.AUTO_LIKE_STATUS, true),
  STATUS_EMOJI: process.env.STATUS_EMOJI || '💚',
  AUTO_READ_MESSAGES: toBool(process.env.AUTO_READ_MESSAGES, false),
  AUTO_TYPING: toBool(process.env.AUTO_TYPING, false),
  AUTO_RECORDING: toBool(process.env.AUTO_RECORDING, false),
  ALWAYS_ONLINE: toBool(process.env.ALWAYS_ONLINE, true),
  AUTO_REACT: toBool(process.env.AUTO_REACT, false),
  AUTO_BIO: toBool(process.env.AUTO_BIO, false),
  ANTI_DELETE: toBool(process.env.ANTI_DELETE, true),
  ANTI_CALL: toBool(process.env.ANTI_CALL, true),
  ANTI_CALL_BLOCK: toBool(process.env.ANTI_CALL_BLOCK, false),
  ANTI_LINK: toBool(process.env.ANTI_LINK, false),
  ANTI_BOT: toBool(process.env.ANTI_BOT, false),
  WELCOME: toBool(process.env.WELCOME, false),
  READ_CMD: toBool(process.env.READ_CMD, true),
  PRESENCE_UPDATE: process.env.PRESENCE_UPDATE || 'available',

  /* ---------- UI ---------- */
  SEND_LOGO_ON_MENU: toBool(process.env.SEND_LOGO_ON_MENU, true),
  NEWSLETTER_FORWARD: toBool(process.env.NEWSLETTER_FORWARD, true),
  REACT_ON_CMD: toBool(process.env.REACT_ON_CMD, true),
  CMD_REACTION: process.env.CMD_REACTION || '⚡',

  /* ---------- LIMITS ---------- */
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB || 90),
  COOLDOWN_MS: Number(process.env.COOLDOWN_MS || 1200),
  // WhatsApp rotates the pairing ref at ~60s. Anything below ~50 cuts the
  // user off while they are still typing, so a floor is enforced here even
  // if an old deployment still sets PAIR_CODE_TTL=40.
  PAIR_CODE_TTL: Math.min(58, Math.max(50, Number(process.env.PAIR_CODE_TTL || 55))),
  SESSION_DIR: process.env.SESSION_DIR || './data/sessions',
  MAX_SESSIONS: Number(process.env.MAX_SESSIONS || 500),

  /* ---------- WEB ---------- */
  SITE_NAME: process.env.SITE_NAME || 'THE GHOST MINI OFC',
  API_RATE_LIMIT: Number(process.env.API_RATE_LIMIT || 30),

  /* Owner dashboard. Set this as a Heroku config var; never expose it in chat. */
  OWNER_PANEL_PASSWORD: process.env.OWNER_PANEL_PASSWORD || 'Chamu2010@!!!',
  OWNER_PANEL_NUMBER: process.env.OWNER_PANEL_NUMBER || '94767106413',
  OWNER_PANEL_TOKEN_TTL: Number(process.env.OWNER_PANEL_TOKEN_TTL || 1800000)
};
