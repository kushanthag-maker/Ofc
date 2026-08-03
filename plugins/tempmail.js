/** Temporary mailbox commands with 1secmail and Mail.tm fallback providers. */
const axios = require('axios');
const crypto = require('crypto');
const { cmd } = require('../lib/command');

const boxes = new Map(); // sender JID -> provider mailbox credentials
const ONE_APIS = [
  'https://www.1secmail.com/api/v1/',
  'https://1secmail.com/api/v1/',
  'https://www.1secmail.net/api/v1/',
  'https://www.1secmail.org/api/v1/'
];
const MAIL_APIS = ['https://api.mail.tm', 'https://api.mail.gw'];
const headers = { 'User-Agent': 'GhostMiniOFC/1.0', Accept: 'application/json' };

async function one(params, preferredBase = null) {
  const hosts = preferredBase ? [preferredBase, ...ONE_APIS.filter(x => x !== preferredBase)] : ONE_APIS;
  let last = '1secmail unavailable';
  for (const base of hosts) {
    try {
      const r = await axios.get(base, { params, headers, timeout: 20000, validateStatus: () => true });
      if (r.status < 300) return { data: r.data, base };
      last = `1secmail HTTP ${r.status}`;
    } catch (e) { last = e.message; }
  }
  throw new Error(last);
}
async function tm(base, method, path, data, token) {
  const r = await axios({ method, url: base + path, data, timeout: 25000, validateStatus: () => true,
    headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) } });
  if (r.status >= 300) throw new Error(`Mail.tm HTTP ${r.status}: ${r.data?.message || ''}`);
  return r.data;
}
function randomPassword() { return `Ghost${crypto.randomBytes(9).toString('base64url')}!9`; }
function getBox(sender) { return boxes.get(sender); }

async function createMailbox() {
  try {
    const result = await one({ action: 'genRandomMailbox', count: 1 });
    const data = result.data;
    const address = Array.isArray(data) ? data[0] : null;
    if (!address || !address.includes('@')) throw new Error('No mailbox returned');
    const [login, domain] = address.split('@');
    return { provider: '1secmail', base: result.base, login, domain, address, createdAt: Date.now() };
  } catch (_) {
    let base, domains, lastError;
    for (const candidate of MAIL_APIS) {
      try {
        const result = await tm(candidate, 'GET', '/domains?page=1');
        if (result?.['hydra:member']?.length) { base = candidate; domains = result; break; }
      } catch (e) { lastError = e; }
    }
    const domain = domains?.['hydra:member']?.[0]?.domain;
    if (!base || !domain) throw new Error(lastError?.message || 'Temporary mail providers returned no domains');
    const login = `ghost${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`.toLowerCase();
    const password = randomPassword();
    const address = `${login}@${domain}`;
    await tm(base, 'POST', '/accounts', { address, password });
    const auth = await tm(base, 'POST', '/token', { address, password });
    return { provider: 'mail.tm', base, login, domain, address, password, token: auth.token, createdAt: Date.now() };
  }
}

async function listMailbox(box) {
  if (box.provider === '1secmail') {
    const result = await one({ action: 'getMessages', login: box.login, domain: box.domain }, box.base);
    return result.data;
  }
  const data = await tm(box.base || MAIL_APIS[0], 'GET', '/messages?page=1', null, box.token);
  return (data?.['hydra:member'] || []).map(x => ({ subject: x.subject, from: x.from?.address, id: x.id, date: x.createdAt }));
}

cmd({ pattern: 'tempmail', alias: ['tempemail', '10minutemail'], desc: 'Create a temporary email inbox', category: 'tools', react: '📧' },
async ({ m, reply }) => {
  try {
    const box = await createMailbox(); boxes.set(m.sender, box);
    await reply(`📧 *TEMPORARY MAILBOX CREATED*\n\nAddress: ${box.address}\nProvider: ${box.provider}\n\nUse *.mailbox* to check messages.\nUse *.refresh* to refresh the inbox.\n\n⚠️ Temporary inboxes are short-lived. Do not use them for sensitive accounts.`);
  } catch (e) { await reply(`❌ Temporary mail failed: ${String(e.message || e).slice(0, 180)}`); }
});

async function showMailbox(sender, reply) {
  const box = getBox(sender);
  if (!box) return reply('📭 Create an inbox first with *.tempmail*.');
  try {
    const messages = await listMailbox(box);
    if (!Array.isArray(messages) || !messages.length) return reply(`📭 *MAILBOX EMPTY*\n\n${box.address}\n\nNo messages yet.`);
    const lines = messages.slice(0, 20).map((x, i) => `${i + 1}. *${x.subject || '(no subject)'}*\n   From: ${x.from || 'unknown'}\n   ID: ${x.id}\n   ${x.date || ''}`);
    await reply(`📬 *MAILBOX*\n\nAddress: ${box.address}\n\n${lines.join('\n\n')}\n\nUse *.mailbox* again to refresh the list.`);
  } catch (e) { await reply(`❌ Mailbox refresh failed: ${String(e.message || e).slice(0, 180)}`); }
}

cmd({ pattern: 'mailbox', alias: ['inbox', 'tempmailbox'], desc: 'Check your temporary email inbox', category: 'tools', react: '📬' },
async ({ m, reply }) => showMailbox(m.sender, reply));
cmd({ pattern: 'refresh', alias: ['refreshmail', 'checkmail'], desc: 'Refresh your temporary mailbox', category: 'tools', react: '🔄' },
async ({ m, reply }) => showMailbox(m.sender, reply));
