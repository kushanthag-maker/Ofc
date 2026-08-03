const axios = require('axios');
const config = require('../config/config');

async function askOpenAI(prompt, system = 'You are a helpful assistant.') {
  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    },
    { headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` } }
  );
  return data.choices[0].message.content;
}

function requireKey(ctx) {
  if (!config.OPENAI_API_KEY) {
    ctx.reply('❗ Set OPENAI_API_KEY in your .env file to enable AI commands (.ai, .chat, .gpt, .code, .explain, .translate).');
    return false;
  }
  return true;
}

module.exports = [
  {
    name: 'ai',
    category: 'ai',
    aliases: ['gpt', 'chat'],
    description: 'Chat with AI. Usage: .ai <question>',
    execute: async (sock, m, args, ctx) => {
      if (!requireKey(ctx)) return;
      const prompt = args.join(' ');
      if (!prompt) return ctx.reply('❗ Usage: .ai <your question>');
      try {
        const reply = await askOpenAI(prompt);
        await ctx.reply(reply);
      } catch {
        await ctx.reply('❌ AI request failed. Check your API key/quota.');
      }
    },
  },
  {
    name: 'translate',
    category: 'ai',
    description: 'Translate text. Usage: .translate <lang> <text>',
    execute: async (sock, m, args, ctx) => {
      if (!requireKey(ctx)) return;
      const lang = args[0];
      const text = args.slice(1).join(' ');
      if (!lang || !text) return ctx.reply('❗ Usage: .translate <target-language> <text>');
      try {
        const reply = await askOpenAI(`Translate this to ${lang}, reply with only the translation:\n${text}`);
        await ctx.reply(`🌐 ${reply}`);
      } catch {
        await ctx.reply('❌ Translation failed.');
      }
    },
  },
  {
    name: 'image',
    category: 'ai',
    description: 'Generate an AI image. Usage: .image <prompt>',
    execute: async (sock, m, args, ctx) => {
      if (!requireKey(ctx)) return;
      const prompt = args.join(' ');
      if (!prompt) return ctx.reply('❗ Usage: .image <description>');
      try {
        const { data } = await axios.post(
          'https://api.openai.com/v1/images/generations',
          { model: 'dall-e-3', prompt, n: 1, size: '1024x1024' },
          { headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` } }
        );
        await sock.sendMessage(ctx.from, { image: { url: data.data[0].url }, caption: `🎨 ${prompt}` });
      } catch {
        await ctx.reply('❌ Image generation failed.');
      }
    },
  },
  {
    name: 'code',
    category: 'ai',
    description: 'Ask AI to write code. Usage: .code <request>',
    execute: async (sock, m, args, ctx) => {
      if (!requireKey(ctx)) return;
      const prompt = args.join(' ');
      if (!prompt) return ctx.reply('❗ Usage: .code <what you want built>');
      try {
        const reply = await askOpenAI(prompt, 'You are an expert programmer. Reply with clean, working code and brief comments only.');
        await ctx.reply('```' + reply + '```');
      } catch {
        await ctx.reply('❌ Request failed.');
      }
    },
  },
  {
    name: 'explain',
    category: 'ai',
    description: 'Ask AI to explain a concept or code. Usage: .explain <text/code>',
    execute: async (sock, m, args, ctx) => {
      if (!requireKey(ctx)) return;
      const prompt = args.join(' ');
      if (!prompt) return ctx.reply('❗ Usage: .explain <concept or code>');
      try {
        const reply = await askOpenAI(`Explain this simply:\n${prompt}`);
        await ctx.reply(reply);
      } catch {
        await ctx.reply('❌ Request failed.');
      }
    },
  },
];
