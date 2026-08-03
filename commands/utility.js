const moment = require('moment');
const axios = require('axios');
const QRCode = require('qrcode');
const sharp = require('sharp');
const config = require('../config/config');
const { getCommand, getAllCommands } = require('../lib/commandHandler');

const startedAt = Date.now();

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

module.exports = [
  {
    name: 'ping',
    category: 'utility',
    description: 'Check bot response speed',
    execute: async (sock, m, args, ctx) => {
      const start = Date.now();
      const sent = await ctx.reply('🏓 Pinging...');
      const latency = Date.now() - start;
      await sock.sendMessage(ctx.from, { text: `🏓 *Pong!*\n⚡ ${latency}ms`, edit: sent?.key });
    },
  },
  {
    name: 'speed',
    category: 'utility',
    description: 'Alias of .ping',
    aliases: [],
    execute: async (sock, m, args, ctx) => {
      const start = Date.now();
      await ctx.reply(`⚡ Speed: ${Date.now() - start}ms`);
    },
  },
  {
    name: 'runtime',
    category: 'utility',
    description: 'Show how long the bot has been running',
    execute: async (sock, m, args, ctx) => {
      await ctx.reply(`⏱ *Uptime:* ${formatUptime(Date.now() - startedAt)}`);
    },
  },
  {
    name: 'alive',
    category: 'utility',
    description: 'Check if the bot is online',
    execute: async (sock, m, args, ctx) => {
      await ctx.reply(
        `✅ *${config.BOT_NAME}* is alive and running!\n⏱ Uptime: ${formatUptime(Date.now() - startedAt)}\n👑 Owner: ${config.OWNER_NAME}`
      );
    },
  },
  {
    name: 'menu',
    category: 'utility',
    aliases: ['help'],
    description: 'Show all available commands',
    execute: async (sock, m, args, ctx) => {
      const cmds = getAllCommands();
      const byCategory = {};
      for (const c of cmds) {
        byCategory[c.category] = byCategory[c.category] || [];
        byCategory[c.category].push(c.name);
      }
      let text = `🤖 *${config.BOT_NAME} MENU*\nPrefix: ${config.PREFIX}\n\n`;
      for (const [cat, names] of Object.entries(byCategory)) {
        text += `╭─「 *${cat.toUpperCase()}* 」\n`;
        names.forEach((n) => (text += `│ ➤ ${config.PREFIX}${n}\n`));
        text += `╰────────────\n\n`;
      }
      await ctx.reply(text.trim());
    },
  },
  {
    name: 'profile',
    category: 'utility',
    description: 'Show your WhatsApp profile info',
    execute: async (sock, m, args, ctx) => {
      const jid = ctx.mentionedJid?.[0] || ctx.sender;
      let pic;
      try {
        pic = await sock.profilePictureUrl(jid, 'image');
      } catch {
        pic = null;
      }
      const caption = `👤 *Profile*\n📱 ${jid.split('@')[0]}`;
      if (pic) {
        await sock.sendMessage(ctx.from, { image: { url: pic }, caption });
      } else {
        await ctx.reply(caption + '\n(no profile photo)');
      }
    },
  },
  {
    name: 'weather',
    category: 'utility',
    description: 'Get weather for a city. Usage: .weather Colombo',
    execute: async (sock, m, args, ctx) => {
      if (!config.WEATHER_API_KEY) return ctx.reply('❗ Set WEATHER_API_KEY in .env to enable this command.');
      const city = args.join(' ');
      if (!city) return ctx.reply('❗ Usage: .weather <city>');
      try {
        const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
          params: { q: city, appid: config.WEATHER_API_KEY, units: 'metric' },
        });
        await ctx.reply(
          `🌤 *Weather in ${data.name}*\n🌡 ${data.main.temp}°C (feels ${data.main.feels_like}°C)\n☁ ${data.weather[0].description}\n💧 Humidity: ${data.main.humidity}%`
        );
      } catch {
        await ctx.reply('❌ City not found or API error.');
      }
    },
  },
  {
    name: 'news',
    category: 'utility',
    description: 'Get latest headlines',
    execute: async (sock, m, args, ctx) => {
      if (!config.NEWS_API_KEY) return ctx.reply('❗ Set NEWS_API_KEY in .env to enable this command.');
      try {
        const { data } = await axios.get('https://newsapi.org/v2/top-headlines', {
          params: { country: 'lk', apiKey: config.NEWS_API_KEY, pageSize: 5 },
        });
        const text = data.articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n');
        await ctx.reply(`📰 *Top Headlines*\n\n${text || 'No news found.'}`);
      } catch {
        await ctx.reply('❌ Could not fetch news right now.');
      }
    },
  },
  {
    name: 'qr',
    category: 'utility',
    description: 'Generate a QR code. Usage: .qr <text>',
    execute: async (sock, m, args, ctx) => {
      const text = args.join(' ');
      if (!text) return ctx.reply('❗ Usage: .qr <text>');
      const buffer = await QRCode.toBuffer(text, { width: 400 });
      await sock.sendMessage(ctx.from, { image: buffer, caption: '✅ QR code generated' });
    },
  },
  {
    name: 'shorturl',
    category: 'utility',
    description: 'Shorten a URL. Usage: .shorturl <link>',
    execute: async (sock, m, args, ctx) => {
      const url = args[0];
      if (!url) return ctx.reply('❗ Usage: .shorturl <link>');
      try {
        const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        await ctx.reply(`🔗 ${data}`);
      } catch {
        await ctx.reply('❌ Could not shorten this URL.');
      }
    },
  },
  {
    name: 'calc',
    category: 'utility',
    description: 'Basic calculator. Usage: .calc 2+2*5',
    execute: async (sock, m, args, ctx) => {
      const expr = args.join(' ');
      if (!expr) return ctx.reply('❗ Usage: .calc <expression>');
      if (!/^[0-9+\-*/().\s%]+$/.test(expr)) return ctx.reply('❌ Only numbers and + - * / ( ) % allowed.');
      try {
        const result = Function(`"use strict"; return (${expr})`)();
        await ctx.reply(`🧮 ${expr} = *${result}*`);
      } catch {
        await ctx.reply('❌ Invalid expression.');
      }
    },
  },
  {
    name: 'sticker',
    category: 'utility',
    description: 'Convert a replied/sent image to sticker',
    execute: async (sock, m, args, ctx) => {
      const buffer = await ctx.downloadQuotedMedia();
      if (!buffer) return ctx.reply('❗ Send/reply to an image with .sticker');
      const webp = await sharp(buffer).resize(512, 512, { fit: 'contain' }).webp().toBuffer();
      await sock.sendMessage(ctx.from, { sticker: webp });
    },
  },
  {
    name: 'toimg',
    category: 'utility',
    description: 'Convert a sticker back to an image',
    execute: async (sock, m, args, ctx) => {
      const buffer = await ctx.downloadQuotedMedia();
      if (!buffer) return ctx.reply('❗ Reply to a sticker with .toimg');
      const png = await sharp(buffer).png().toBuffer();
      await sock.sendMessage(ctx.from, { image: png, caption: '✅ Converted to image' });
    },
  },
  {
    name: 'tomp3',
    category: 'utility',
    description: 'Convert a video/voice note to mp3 (requires ffmpeg installed on server)',
    execute: async (sock, m, args, ctx) => {
      await ctx.reply('⚙️ This command requires ffmpeg on the server. See README for setup, then wire it up in commands/utility.js.');
    },
  },
];
