const { blockUser, unblockUser } = require('../middlewares/blockList');
const config = require('../config/config');
const logger = require('../lib/logger');
const { toggleSetting } = require('../lib/settings');

module.exports = [
  {
    name: 'owner',
    category: 'owner',
    description: 'Show owner contact',
    execute: async (sock, m, args, ctx) => {
      await ctx.reply(`👑 *Owner:* ${config.OWNER_NAME}\n📞 *Number:* wa.me/${config.OWNER_NUMBER}`);
    },
  },
  {
    name: 'restart',
    category: 'owner',
    ownerOnly: true,
    description: 'Restart the bot process (requires PM2/Docker restart policy)',
    execute: async (sock, m, args, ctx) => {
      await ctx.reply('♻️ Restarting bot...');
      logger.warn('Restart requested by owner');
      process.exit(0); // PM2 / Docker / Railway will auto-restart the process
    },
  },
  {
    name: 'shutdown',
    category: 'owner',
    ownerOnly: true,
    description: 'Shut down the bot completely',
    execute: async (sock, m, args, ctx) => {
      await ctx.reply('🛑 Shutting down...');
      process.exit(1);
    },
  },
  {
    name: 'eval',
    category: 'owner',
    ownerOnly: true,
    description: 'Evaluate raw JS (owner debug only)',
    execute: async (sock, m, args, ctx) => {
      try {
        let result = eval(args.join(' '));
        if (typeof result !== 'string') result = require('util').inspect(result);
        await ctx.reply('```' + result + '```');
      } catch (err) {
        await ctx.reply(`❌ Error: ${err.message}`);
      }
    },
  },
  {
    name: 'exec',
    category: 'owner',
    ownerOnly: true,
    description: 'Run a shell command (owner debug only)',
    execute: async (sock, m, args, ctx) => {
      const { exec } = require('child_process');
      exec(args.join(' '), (err, stdout, stderr) => {
        ctx.reply('```' + (err ? err.message : stdout || stderr || 'No output') + '```');
      });
    },
  },
  {
    name: 'block',
    category: 'owner',
    ownerOnly: true,
    description: 'Block a user from using the bot. Usage: .block 94xxxxxxxxx',
    execute: async (sock, m, args, ctx) => {
      const num = args[0]?.replace(/\D/g, '');
      if (!num) return ctx.reply('❗ Usage: .block <number>');
      await blockUser(`${num}@s.whatsapp.net`);
      await ctx.reply(`🚫 Blocked ${num}`);
    },
  },
  {
    name: 'unblock',
    category: 'owner',
    ownerOnly: true,
    description: 'Unblock a user. Usage: .unblock 94xxxxxxxxx',
    execute: async (sock, m, args, ctx) => {
      const num = args[0]?.replace(/\D/g, '');
      if (!num) return ctx.reply('❗ Usage: .unblock <number>');
      await unblockUser(`${num}@s.whatsapp.net`);
      await ctx.reply(`✅ Unblocked ${num}`);
    },
  },
  {
    name: 'broadcast',
    category: 'owner',
    ownerOnly: true,
    description: 'Broadcast a message to all groups the bot is in. Usage: .broadcast <text>',
    execute: async (sock, m, args, ctx) => {
      const text = args.join(' ');
      if (!text) return ctx.reply('❗ Usage: .broadcast <message>');
      const groups = await sock.groupFetchAllParticipating();
      const ids = Object.keys(groups);
      await ctx.reply(`📢 Broadcasting to ${ids.length} groups...`);
      for (const gid of ids) {
        try {
          await sock.sendMessage(gid, { text: `📢 *Broadcast*\n\n${text}` });
        } catch (e) { /* skip failed group */ }
      }
    },
  },
  {
    name: 'leavegc',
    category: 'owner',
    ownerOnly: true,
    description: 'Make the bot leave the current group',
    execute: async (sock, m, args, ctx) => {
      if (!ctx.isGroup) return ctx.reply('❗ This command only works inside a group.');
      await ctx.reply('👋 Leaving this group...');
      await sock.groupLeave(ctx.from);
    },
  },
  {
    name: 'joingc',
    category: 'owner',
    ownerOnly: true,
    description: 'Join a group via invite link. Usage: .joingc <link>',
    execute: async (sock, m, args, ctx) => {
      const link = args[0];
      if (!link) return ctx.reply('❗ Usage: .joingc <invite link>');
      const code = link.split('/').pop();
      await sock.groupAcceptInvite(code);
      await ctx.reply('✅ Joined the group.');
    },
  },
  {
    name: 'autoread',
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto read-receipts',
    execute: async (sock, m, args, ctx) => {
      const val = await toggleSetting('autoread');
      await ctx.reply(`👁 Auto-read is now *${val ? 'ON' : 'OFF'}*`);
    },
  },
  {
    name: 'autotyping',
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto typing indicator',
    execute: async (sock, m, args, ctx) => {
      const val = await toggleSetting('autotyping');
      await ctx.reply(`⌨️ Auto-typing is now *${val ? 'ON' : 'OFF'}*`);
    },
  },
  {
    name: 'autorecord',
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto recording indicator',
    execute: async (sock, m, args, ctx) => {
      const val = await toggleSetting('autorecord');
      await ctx.reply(`🎙 Auto-record is now *${val ? 'ON' : 'OFF'}*`);
    },
  },
  {
    name: 'autostatus',
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto status view',
    execute: async (sock, m, args, ctx) => {
      const val = await toggleSetting('autostatus');
      await ctx.reply(`📸 Auto-status-view is now *${val ? 'ON' : 'OFF'}*`);
    },
  },
];
