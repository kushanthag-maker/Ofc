const axios = require('axios');

/**
 * These commands are wired as clean integration points.
 * Public scraper APIs for YouTube/TikTok/IG/FB/Twitter/Spotify change
 * often and many require their own API key or self-hosting, so plug
 * your preferred provider's endpoint + key into config/config.js and
 * reference it here. The request/response handling below is ready to go.
 */

function notConfigured(ctx, name) {
  return ctx.reply(`⚙️ *.${name}* needs a downloader API wired in commands/download.js — add your provider's endpoint + key, the send logic below is already set up.`);
}

module.exports = [
  {
    name: 'play',
    category: 'download',
    aliases: ['song', 'ytmp3'],
    description: 'Download audio from YouTube. Usage: .play <song name / url>',
    execute: async (sock, m, args, ctx) => {
      const query = args.join(' ');
      if (!query) return ctx.reply('❗ Usage: .play <song name or YouTube link>');
      // TODO: call your YouTube audio-extraction API here, then:
      // await sock.sendMessage(ctx.from, { audio: { url: audioUrl }, mimetype: 'audio/mpeg' });
      return notConfigured(ctx, 'play');
    },
  },
  {
    name: 'video',
    category: 'download',
    aliases: ['ytmp4'],
    description: 'Download video from YouTube. Usage: .video <name / url>',
    execute: async (sock, m, args, ctx) => {
      const query = args.join(' ');
      if (!query) return ctx.reply('❗ Usage: .video <name or YouTube link>');
      // TODO: call your YouTube video API here, then:
      // await sock.sendMessage(ctx.from, { video: { url: videoUrl }, caption: query });
      return notConfigured(ctx, 'video');
    },
  },
  {
    name: 'tiktok',
    category: 'download',
    description: 'Download a TikTok video without watermark. Usage: .tiktok <link>',
    execute: async (sock, m, args, ctx) => {
      if (!args[0]) return ctx.reply('❗ Usage: .tiktok <link>');
      return notConfigured(ctx, 'tiktok');
    },
  },
  {
    name: 'facebook',
    category: 'download',
    description: 'Download a Facebook video. Usage: .facebook <link>',
    execute: async (sock, m, args, ctx) => {
      if (!args[0]) return ctx.reply('❗ Usage: .facebook <link>');
      return notConfigured(ctx, 'facebook');
    },
  },
  {
    name: 'instagram',
    category: 'download',
    description: 'Download Instagram photo/video/reel. Usage: .instagram <link>',
    execute: async (sock, m, args, ctx) => {
      if (!args[0]) return ctx.reply('❗ Usage: .instagram <link>');
      return notConfigured(ctx, 'instagram');
    },
  },
  {
    name: 'twitter',
    category: 'download',
    description: 'Download a video/gif from X/Twitter. Usage: .twitter <link>',
    execute: async (sock, m, args, ctx) => {
      if (!args[0]) return ctx.reply('❗ Usage: .twitter <link>');
      return notConfigured(ctx, 'twitter');
    },
  },
  {
    name: 'spotify',
    category: 'download',
    description: 'Download a Spotify track as mp3. Usage: .spotify <link>',
    execute: async (sock, m, args, ctx) => {
      if (!args[0]) return ctx.reply('❗ Usage: .spotify <link>');
      return notConfigured(ctx, 'spotify');
    },
  },
  {
    name: 'mediafire',
    category: 'download',
    description: 'Download a file from a Mediafire link. Usage: .mediafire <link>',
    execute: async (sock, m, args, ctx) => {
      const link = args[0];
      if (!link) return ctx.reply('❗ Usage: .mediafire <link>');
      try {
        const { data: html } = await axios.get(link);
        const match = html.match(/href="(https:\/\/download[^"]+)"/);
        if (!match) return ctx.reply('❌ Could not find a direct download link on that page.');
        await sock.sendMessage(ctx.from, { document: { url: match[1] }, fileName: 'file', mimetype: 'application/octet-stream' });
      } catch {
        await ctx.reply('❌ Failed to fetch that Mediafire link.');
      }
    },
  },
  {
    name: 'pinterest',
    category: 'download',
    description: 'Search & fetch a Pinterest image. Usage: .pinterest <query>',
    execute: async (sock, m, args, ctx) => {
      if (!args.length) return ctx.reply('❗ Usage: .pinterest <search term>');
      return notConfigured(ctx, 'pinterest');
    },
  },
  {
    name: 'apk',
    category: 'download',
    description: 'Find an APK download link. Usage: .apk <app name>',
    execute: async (sock, m, args, ctx) => {
      if (!args.length) return ctx.reply('❗ Usage: .apk <app name>');
      return notConfigured(ctx, 'apk');
    },
  },
];
