/**
 * Offline smoke test for the new command packs.
 * Builds the same ctx object lib/handler.js builds, runs every command
 * with realistic arguments and reports anything that throws or replies
 * with nothing.
 *
 * Usage: node scripts/test-new-commands.js
 */
const path = require('path');
const { cmd, commands, loadPlugins } = require('../lib/command');
const config = require('../config');

const NEW_FILES = ['textkit.js', 'mathkit.js', 'games.js', 'devkit.js', 'utilkit.js', 'support.js'];

/* Load only the new packs so the test is fast and focused. */
const before = commands.length;
for (const f of NEW_FILES) require(path.join(__dirname, '..', 'plugins', f));
const fresh = commands.slice(before);

/* Realistic arguments per command. Anything not listed runs with no args
   (which must still produce a helpful usage reply, never a crash). */
const ARGS = {
  // textkit
  titlecase: 'hello world from sri lanka', sentencecase: 'hello. how are you? fine',
  togglecase: 'Hello World', randomcase: 'this is fine', camelcase: 'hello world again',
  pascalcase: 'hello world', snakecase: 'Hello World', kebabcase: 'My Blog Post Title',
  constcase: 'max retry count', sortlines: 'banana\napple\ncherry', dedupe: 'a\nb\na\nc\nb',
  shufflelines: 'one\ntwo\nthree', numberlines: 'first\nsecond\nthird', reverselines: 'a\nb\nc',
  cleantext: '  messy    text  \n\n  here ', removespaces: 'h e l l o', spaceout: 'ghost',
  wraptext: '20 the quick brown fox jumps over the lazy dog again and again',
  repeat: '3 ghost', extracturls: 'see https://a.com and http://b.org/x?y=1 now',
  extractemails: 'mail me at a@b.com or c.d@e.co.uk', extractnumbers: 'i have 3 cats and 12.5 kg rice',
  wordfreq: 'the cat sat on the mat the cat was fat', charfreq: 'hello world',
  readtime: 'word '.repeat(300), palindrome: 'A man a plan a canal Panama',
  anagram: 'listen silent', acronym: 'as soon as possible', vowels: 'hello world 123',
  rot13: 'hello world', caesar: '3 attack at dawn', atbash: 'secret message',
  leetspeak: 'elite hacker', upsidedown: 'hello there', bubbletext: 'ghost mini',
  squaretext: 'ghost', fullwidth: 'aesthetic', strikethrough: 'deleted words',
  underlinetext: 'important', zalgo: 'chaos', clap: 'say it louder', emojify: 'ghost',
  lorem: '2',
  // mathkit
  isprime: '97', factors: '360', primefactors: '5040', gcd: '48 180', fibonacci: '15',
  factorial: '20', tobase: '255 10 16', roman: '1994', percent: '45 200',
  average: '10 20 30 45 12', quadratic: '1 -3 2', triangle: '3 4', circle: '7',
  convert: '10 km mi', temp: '32 f', bmi: '70 175', loan: '500000 12 5',
  interest: '100000 8 10', discount: '2500 30', tipcalc: '4500 10 4', vat: '1000 18',
  ratio: '1920 1080', randomnum: '1 100 5', countdown2: '2027-01-01',
  datediff: '2020-01-01 2026-07-27',
  // games
  hangman: '', guessletter: 'e', guessword: 'elephant', numbergame: '100', ng2: '50',
  mathquiz: 'medium', answer: '10', scramble: '', unscrambleans: 'elephant',
  endgame: '', slot2: '', dice2: '2d6', lottery: '6 49', wheel: 'pizza | burger | rice',
  coinflip2: '5', wyr2: '', neverhaveiever: '', riddle: '', riddleans: '', wouldyou: '',
  rate2: 'ghost mini', ship2: 'Kasun & Nimali', truthordare: '', rpsgame: 'rock',
  magic8: 'Will I pass?',
  // devkit
  jsonformat: '{"a":1,"b":[2,3],"c":{"d":true}}', jsonmin: '{ "a" : 1 , "b" : 2 }',
  jsonkeys: '{"user":{"name":"a","tags":["x"]},"n":1}',
  csvtojson: 'name,age\nAnna,30\nBen,25', jsontocsv: '[{"a":1,"b":"x"},{"a":2,"b":"y"}]',
  urlencode: 'hello world & more', urldecode: 'hello%20world%20%26%20more',
  hexencode: 'ghost', hexdecode: '67686f7374', unicode: 'abc', escape: 'line\nbreak "quoted"',
  uuid: '3', randomstring: '32', sha512: 'password123', hmac: 'mysecret|the message',
  jwtdecode: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwibmFtZSI6IkEiLCJleHAiOjE3NjAwMDAwMDB9.x',
  hextorgb: '#1e90ff', palette: '#1e90ff', urlinfo: 'https://example.com/a/b?x=1&y=2#top',
  httpstatus: '404', regextest: '\\d+|order 123 and 456', cron: '0 9 * * 1-5',
  timestamp: '1769472000', wordlist: '65', ipcalc: '192.168.1.10/24', sysinfo: '',
  // utilkit
  note: 'buy data package', notes: '', delnote: '1', clearnotes: '',
  todo: 'finish assignment', todolist: '', donetask: '1', cleartasks: '',
  shuffle: 'Anna, Ben, Chris, Dilan', teams: '2 Anna, Ben, Chris, Dilan',
  order: 'Anna, Ben, Chris', pickone: 'rice, noodles, bread', pomodoro: '3',
  splitwork: '350 7', grade: '78 100', neededmarks: '65 40 75',
  emojimeaning: '🔥', phonetic: 'GHOST', romannum: '4207', zodiac: '06-15',
  chinesezodiac: '1998', birthstone: 'June', countdownnewyear: '', weekinfo: '2026-07-27',
  motivate: '', checklist: 'pack bag, charge phone', progressbar: '35 100',
  randomname: '5', strengthcheck: 'MyP@ssw0rd', summarylines: 'First point. Second point.',
  initialsavatar: 'Kasun Perera', caseconvertall: 'hello world example',
  // support pack (AI is unconfigured in tests -> must fall back gracefully)
  support: 'status', health: '', errors: '', clearerrors: '',
  // network-dependent - exercised but failures are tolerated
  headers: 'https://example.com', dnslookup: 'google.com', myip: '', randomcolor: ''
};

const NETWORK = new Set(['headers', 'dnslookup', 'myip', 'randomcolor']);

function makeCtx(command, raw) {
  const args = raw ? raw.split(/\s+/) : [];
  const out = { replies: [], sends: [] };
  const chat = '120363@g.us';
  const msg = {
    chat, sender: '94770000000@s.whatsapp.net', senderNum: '94770000000',
    pushName: 'Tester', isGroup: true, fromMe: false, body: raw,
    key: { id: 'X', remoteJid: chat },
    quoted: raw.includes('\n') ? { text: raw } : null,
    react: async () => {}, reply: async (t) => { out.replies.push(String(t)); }
  };
  return {
    out,
    ctx: {
      sock: { sendMessage: async () => {}, user: { id: '94771111111:1@s.whatsapp.net' } },
      m: msg, args, q: raw, text: raw, prefix: '.', command,
      isOwner: true, isAdmin: true, isBotAdmin: true, isGroup: true,
      metadata: null, participants: [], groupDoc: null, user: null, session: {}, botNum: '94771111111',
      db: require('../lib/database'), config,
      reply: async (t) => { out.replies.push(String(t)); },
      replyRaw: async (t) => { out.replies.push(String(t)); },
      send: async (c) => { out.sends.push(c); if (c.caption) out.replies.push(String(c.caption)); },
      react: async () => {},
      newsletterCtx: () => ({})
    }
  };
}

(async () => {
  const fails = [];
  const empty = [];
  let ok = 0;

  for (const c of fresh) {
    const raw = ARGS[c.pattern] !== undefined ? ARGS[c.pattern] : '';
    const { ctx, out } = makeCtx(c.pattern, raw);
    try {
      await c.handler(ctx);
      if (!out.replies.length && !out.sends.length) empty.push(c.pattern);
      else ok++;
    } catch (e) {
      if (NETWORK.has(c.pattern)) { ok++; continue; }
      fails.push(`${c.pattern}  ->  ${e.message}`);
    }
  }

  /* Every command must also survive being called with no arguments. */
  const crashOnEmpty = [];
  for (const c of fresh) {
    const { ctx } = makeCtx(c.pattern, '');
    try { await c.handler(ctx); }
    catch (e) { if (!NETWORK.has(c.pattern)) crashOnEmpty.push(`${c.pattern} -> ${e.message}`); }
  }

  console.log(`\nNew commands tested : ${fresh.length}`);
  console.log(`Produced output     : ${ok}`);
  console.log(`Silent (no reply)   : ${empty.length}${empty.length ? ' -> ' + empty.join(', ') : ''}`);
  console.log(`Threw with args     : ${fails.length}`);
  fails.forEach(f => console.log('   FAIL ' + f));
  console.log(`Threw with no args  : ${crashOnEmpty.length}`);
  crashOnEmpty.forEach(f => console.log('   FAIL ' + f));

  const bad = fails.length + crashOnEmpty.length + empty.length;
  console.log(bad === 0 ? '\nALL NEW COMMANDS PASS\n' : `\n${bad} problem(s) found\n`);
  process.exit(bad === 0 ? 0 : 1);
})();
