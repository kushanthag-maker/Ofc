/**
 * DOWNLOADER COMMANDS - powered by SASA TECH API
 * THE GHOST MINI OFC
 */
const { cmd } = require('../lib/command');
const config = require('../config');
const { sasaApi, extractUrl, isUrl, withFooter, formatBytes, truncate, getBuffer } = require('../lib/utils');

const askUrl = (name, prefix, cmdName, example) =>
  `*${name} DOWNLOADER*\n\nPlease provide a valid link.\n\nExample:\n${prefix}${cmdName} ${example}`;

/* ================= TIKTOK ================= */
async function tiktokFlow({ q, m, reply, send, prefix, command }, wantAudio = false) {
  const url = extractUrl(q) || extractUrl(m.quoted?.text || '');
  if (!url) return reply(askUrl('TIKTOK', prefix, command, 'https://vt.tiktok.com/xxxxx/'));
  await reply('Fetching TikTok media, please wait...');
  const res = await sasaApi('/api/v1/download/tiktok', { q: url });
  if (!res.status || !res.data) return reply(`Download failed.\n${res.err || 'Try another link.'}`);
  const d = res.data;
  const info = `*TIKTOK DOWNLOADER*\n\nTitle  : ${truncate(d.title || 'unknown', 90)}\nAuthor : ${d.author || 'unknown'}\nRegion : ${d.regions || '-'}\nLength : ${d.runtime || '-'}s`;
  if (wantAudio && d.music) {
    return send({ audio: { url: d.music }, mimetype: 'audio/mpeg', fileName: `${truncate(d.title || 'tiktok', 40)}.mp3`, caption: withFooter(info) });
  }
  const video = d.no_watermark || d.watermark;
  if (!video) return reply('No downloadable video URL was returned.');
  await send({ video: { url: video }, caption: withFooter(info), mimetype: 'video/mp4' });
}

cmd({ pattern: 'tiktok', alias: ['tt', 'ttdl', 'tiktokdl'], desc: 'Download TikTok video without watermark', category: 'download', use: '<url>', react: '🎵' },
async (ctx) => tiktokFlow(ctx, false));

cmd({ pattern: 'tiktokaudio', alias: ['ttmp3', 'ttaudio', 'tiktokmp3'], desc: 'Extract audio from a TikTok video', category: 'download', use: '<url>', react: '🎧' },
async (ctx) => tiktokFlow(ctx, true));

cmd({ pattern: 'tiktoknowm', alias: ['ttnowm', 'ttnw'], desc: 'TikTok no-watermark direct video', category: 'download', use: '<url>', react: '🎬' },
async (ctx) => tiktokFlow(ctx, false));

/* ================= YOUTUBE ================= */
async function ytFlow(ctx, format) {
  const { q, m, reply, send, prefix, command } = ctx;
  let url = extractUrl(q) || extractUrl(m.quoted?.text || '');
  if (!url) {
    if (!q) return reply(askUrl('YOUTUBE', prefix, command, 'https://youtube.com/watch?v=xxxx'));
    try {
      const yts = require('yt-search');
      const s = await yts(q);
      url = s.videos?.[0]?.url;
    } catch (_) {}
    if (!url) return reply('No YouTube result found for that query.');
  }
  await reply(`Processing YouTube ${format === 'mp3' ? 'audio' : 'video'}...`);
  const res = await sasaApi('/api/v1/download/youtube', { q: url, format });
  if (!res.status || !res.data?.url) return reply(`Download failed.\n${res.err || res.data?.error || 'Try again later.'}`);
  const file = res.data.filename || `ghost-${Date.now()}.${format === 'mp3' ? 'mp3' : 'mp4'}`;
  const info = `*YOUTUBE DOWNLOADER*\n\nFile   : ${truncate(file, 80)}\nFormat : ${format}\nSource : ${url}`;
  if (format === 'mp3') {
    return send({ audio: { url: res.data.url }, mimetype: 'audio/mpeg', fileName: file.endsWith('.mp3') ? file : file + '.mp3', caption: withFooter(info) });
  }
  await send({ video: { url: res.data.url }, mimetype: 'video/mp4', fileName: file, caption: withFooter(info) });
}

cmd({ pattern: 'youtube', alias: ['yt', 'ytv', 'ytmp4', 'ytvideo'], desc: 'Download a YouTube video', category: 'download', use: '<url|query>', react: '📹' },
async (ctx) => ytFlow(ctx, '360'));

cmd({ pattern: 'song', alias: ['ytmp3', 'ytaudio', 'play', 'music', 'mp3'], desc: 'Download a song from YouTube', category: 'download', use: '<song name|url>', react: '🎶' },
async (ctx) => ytFlow(ctx, 'mp3'));

cmd({ pattern: 'video720', alias: ['yt720', 'hdvideo'], desc: 'Download YouTube video in 720p', category: 'download', use: '<url>', react: '🎥' },
async (ctx) => ytFlow(ctx, '720'));

cmd({ pattern: 'video480', alias: ['yt480'], desc: 'Download YouTube video in 480p', category: 'download', use: '<url>', react: '📽️' },
async (ctx) => ytFlow(ctx, '480'));

cmd({ pattern: 'video1080', alias: ['yt1080', 'fullhd'], desc: 'Download YouTube video in 1080p', category: 'download', use: '<url>', react: '🍿' },
async (ctx) => ytFlow(ctx, '1080'));

cmd({ pattern: 'ytdoc', alias: ['ytfile'], desc: 'Send YouTube video as a document file', category: 'download', use: '<url>', react: '📄' },
async ({ q, reply, send, prefix }) => {
  const url = extractUrl(q);
  if (!url) return reply(askUrl('YOUTUBE DOCUMENT', prefix, 'ytdoc', 'https://youtube.com/watch?v=xxxx'));
  await reply('Preparing document...');
  const res = await sasaApi('/api/v1/download/youtube', { q: url, format: '360' });
  if (!res.status || !res.data?.url) return reply('Download failed.');
  await send({ document: { url: res.data.url }, mimetype: 'video/mp4', fileName: res.data.filename || 'video.mp4', caption: withFooter('*YOUTUBE DOCUMENT*') });
});

/* ================= SIMPLE GENERIC DOWNLOADERS ================= */
function simpleDownloader({ pattern, alias, name, endpoint, example, react, mediaHint }) {
  cmd({ pattern, alias, desc: `Download media from ${name}`, category: 'download', use: '<url>', react },
  async ({ q, m, reply, send, prefix, command }) => {
    const url = extractUrl(q) || extractUrl(m.quoted?.text || '');
    if (!url) return reply(askUrl(name.toUpperCase(), prefix, command, example));
    await reply(`Fetching from ${name}...`);
    const res = await sasaApi(endpoint, { q: url });
    if (!res.status) return reply(`Download failed.\n${res.err || 'Link may be private or unsupported.'}`);
    const d = res.data || res.result;
    if (!d) return reply(`${name} returned no downloadable data for that link.`);

    // Try to find a media url in a flexible way
    const found = [];
    const walk = (obj, depth = 0) => {
      if (!obj || depth > 4) return;
      if (typeof obj === 'string' && /^https?:\/\//.test(obj) && /\.(mp4|mp3|jpg|jpeg|png|webp|m4a|zip|pdf|apk|mkv)(\?|$)/i.test(obj)) found.push(obj);
      else if (Array.isArray(obj)) obj.forEach(o => walk(o, depth + 1));
      else if (typeof obj === 'object') Object.values(obj).forEach(o => walk(o, depth + 1));
    };
    walk(d);

    const direct = d.dl_link || d.url || d.download || d.link || d.hd || d.sd || found[0];
    const title = d.fileName || d.title || d.filename || name;
    const meta = `*${name.toUpperCase()} DOWNLOADER*\n\nName : ${truncate(title, 80)}\n${d.size ? `Size : ${d.size}\n` : ''}${d.fileType ? `Type : ${d.fileType}\n` : ''}Source: ${url}`;

    if (!direct) return reply(`${meta}\n\nCould not resolve a direct download link.`);

    const lower = String(direct).toLowerCase();
    try {
      if (/\.(mp4|mkv|mov)(\?|$)/.test(lower) || mediaHint === 'video') {
        return send({ video: { url: direct }, caption: withFooter(meta), mimetype: 'video/mp4' });
      }
      if (/\.(mp3|m4a|opus|wav)(\?|$)/.test(lower) || mediaHint === 'audio') {
        return send({ audio: { url: direct }, mimetype: 'audio/mpeg', fileName: `${truncate(title, 40)}.mp3` });
      }
      if (/\.(jpg|jpeg|png|webp)(\?|$)/.test(lower) || mediaHint === 'image') {
        return send({ image: { url: direct }, caption: withFooter(meta) });
      }
      return send({ document: { url: direct }, fileName: String(title).slice(0, 60), mimetype: d.fileType || 'application/octet-stream', caption: withFooter(meta) });
    } catch (e) {
      return reply(`${meta}\n\nDirect link:\n${direct}`);
    }
  });
}

simpleDownloader({ pattern: 'facebook', alias: ['fb', 'fbdl', 'fbvideo'], name: 'Facebook', endpoint: '/api/v1/download/fb', example: 'https://facebook.com/watch?v=xxxx', react: '📘', mediaHint: 'video' });
simpleDownloader({ pattern: 'instagram', alias: ['ig', 'igdl', 'insta', 'reel'], name: 'Instagram', endpoint: '/api/v1/download/inster', example: 'https://instagram.com/reel/xxxx', react: '📸', mediaHint: 'video' });
simpleDownloader({ pattern: 'twitter', alias: ['x', 'twdl', 'xdl', 'twitterdl'], name: 'Twitter/X', endpoint: '/api/v1/download/twiter', example: 'https://twitter.com/user/status/xxxx', react: '🐦', mediaHint: 'video' });
simpleDownloader({ pattern: 'mediafire', alias: ['mf', 'mfire', 'mfdl'], name: 'MediaFire', endpoint: '/api/v1/download/mfire', example: 'https://mediafire.com/file/xxxx', react: '🔥' });
simpleDownloader({ pattern: 'gdrive', alias: ['drive', 'googledrive', 'gd'], name: 'Google Drive', endpoint: '/api/v1/download/gdrive', example: 'https://drive.google.com/file/d/xxxx/view', react: '💽' });
simpleDownloader({ pattern: 'terabox', alias: ['tb', 'tbdl'], name: 'Terabox', endpoint: '/api/v1/download/terabox', example: 'https://1024terabox.com/s/xxxx', react: '📦' });
simpleDownloader({ pattern: 'mega', alias: ['meganz', 'megadl'], name: 'Mega.nz', endpoint: '/api/v1/download/mega', example: 'https://mega.nz/file/xxxx', react: '☁️' });

/* ================= INFO-ONLY VARIANTS ================= */
function infoCommand({ pattern, alias, name, endpoint, react }) {
  cmd({ pattern, alias, desc: `Show raw file info from ${name} without downloading`, category: 'download', use: '<url>', react },
  async ({ q, reply, prefix, command }) => {
    const url = extractUrl(q);
    if (!url) return reply(askUrl(name.toUpperCase() + ' INFO', prefix, command, 'https://...'));
    const res = await sasaApi(endpoint, { q: url });
    if (!res.status) return reply(`Failed: ${res.err || 'unknown error'}`);
    const d = res.data || res.result || {};
    const lines = Object.entries(d)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
      .slice(0, 15)
      .map(([k, v]) => `${k} : ${truncate(String(v), 70)}`);
    await reply(`*${name.toUpperCase()} INFO*\n\n${lines.join('\n') || 'No simple fields returned.'}`);
  });
}

infoCommand({ pattern: 'mfinfo', alias: ['mediafireinfo'], name: 'MediaFire', endpoint: '/api/v1/download/mfire', react: 'ℹ️' });
infoCommand({ pattern: 'gdinfo', alias: ['driveinfo'], name: 'Google Drive', endpoint: '/api/v1/download/gdrive', react: 'ℹ️' });
infoCommand({ pattern: 'tbinfo', alias: ['teraboxinfo'], name: 'Terabox', endpoint: '/api/v1/download/terabox', react: 'ℹ️' });
infoCommand({ pattern: 'ttinfo', alias: ['tiktokinfo'], name: 'TikTok', endpoint: '/api/v1/download/tiktok', react: 'ℹ️' });
infoCommand({ pattern: 'ytinfo', alias: ['youtubeinfo'], name: 'YouTube', endpoint: '/api/v1/download/youtube', react: 'ℹ️' });

/* ================= YT SEARCH ================= */
cmd({ pattern: 'ytsearch', alias: ['yts', 'searchyt'], desc: 'Search YouTube videos', category: 'download', use: '<query>', react: '🔎' },
async ({ q, reply, send }) => {
  if (!q) return reply('Please provide a search query.\nExample: .ytsearch alan walker faded');
  try {
    const yts = require('yt-search');
    const r = await yts(q);
    const vids = (r.videos || []).slice(0, 10);
    if (!vids.length) return reply('No results found.');
    let t = `*YOUTUBE SEARCH*\nQuery: ${q}\n\n`;
    vids.forEach((v, i) => {
      t += `${i + 1}. ${truncate(v.title, 60)}\n   Duration: ${v.timestamp} | Views: ${v.views?.toLocaleString?.() || v.views}\n   ${v.url}\n\n`;
    });
    await send({ image: { url: vids[0].thumbnail }, caption: withFooter(t) });
  } catch (e) {
    await reply('YouTube search failed: ' + e.message);
  }
});

cmd({ pattern: 'lyrics', alias: ['lyric', 'getlyrics'], desc: 'Find song lyrics', category: 'download', use: '<song name>', react: '📝' },
async ({ q, reply }) => {
  if (!q) return reply('Provide a song name.\nExample: .lyrics faded alan walker');
  try {
    const parts = q.split('-').map(s => s.trim());
    const artist = parts.length > 1 ? parts[0] : '';
    const title = parts.length > 1 ? parts[1] : q;
    const { axios } = require('../lib/utils');
    const r = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist || title)}/${encodeURIComponent(title)}`, { timeout: 30000, validateStatus: () => true });
    if (!r.data?.lyrics) return reply(`No lyrics found for *${q}*.\nTry the format: .lyrics artist - song`);
    await reply(`*LYRICS*\n${q}\n\n${String(r.data.lyrics).slice(0, 3500)}`);
  } catch (e) {
    await reply('Lyrics lookup failed. Try format: .lyrics artist - song');
  }
});

cmd({ pattern: 'dlmenu', alias: ['downloadmenu'], desc: 'Show all downloader commands', category: 'download', react: '📥' },
async ({ prefix, reply }) => {
  const { categories } = require('../lib/command');
  const list = (categories().download || []).map(c => `${prefix}${c.pattern} — ${c.desc}`).join('\n');
  await reply(`*DOWNLOAD MENU*\n\n${list}`);
});
