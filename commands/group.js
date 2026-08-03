const { setGroupSetting } = require('../lib/groupSettings');

function jidToNumber(jid) {
  return jid?.split('@')[0];
}

function requireGroupAdmin(ctx) {
  if (!ctx.isGroup) return '❗ This command only works inside a group.';
  if (!ctx.isSenderAdmin && !ctx.isOwner) return '🚫 Only group admins can use this command.';
  if (!ctx.isBotAdmin) return '🚫 Make the bot an admin first.';
  return null;
}

module.exports = [
  {
    name: 'tagall',
    category: 'group',
    description: 'Tag every member in the group',
    execute: async (sock, m, args, ctx) => {
      if (!ctx.isGroup) return ctx.reply('❗ Group only command.');
      const metadata = await sock.groupMetadata(ctx.from);
      const mentions = metadata.participants.map((p) => p.id);
      const text = args.join(' ') || 'Attention everyone!';
      const listText = mentions.map((j) => `➤ @${jidToNumber(j)}`).join('\n');
      await sock.sendMessage(ctx.from, { text: `📢 *Tag All*\n\n${text}\n\n${listText}`, mentions });
    },
  },
  {
    name: 'hidetag',
    category: 'group',
    description: 'Send a message mentioning everyone without showing the list',
    execute: async (sock, m, args, ctx) => {
      if (!ctx.isGroup) return ctx.reply('❗ Group only command.');
      const metadata = await sock.groupMetadata(ctx.from);
      const mentions = metadata.participants.map((p) => p.id);
      await sock.sendMessage(ctx.from, { text: args.join(' ') || '‎', mentions });
    },
  },
  {
    name: 'promote',
    category: 'group',
    description: 'Promote a tagged/replied user to admin',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      const target = ctx.mentionedJid?.[0] || ctx.quotedParticipant;
      if (!target) return ctx.reply('❗ Tag or reply to the user you want to promote.');
      await sock.groupParticipantsUpdate(ctx.from, [target], 'promote');
      await ctx.reply(`✅ Promoted @${jidToNumber(target)}`, { mentions: [target] });
    },
  },
  {
    name: 'demote',
    category: 'group',
    description: 'Demote a tagged/replied admin',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      const target = ctx.mentionedJid?.[0] || ctx.quotedParticipant;
      if (!target) return ctx.reply('❗ Tag or reply to the user you want to demote.');
      await sock.groupParticipantsUpdate(ctx.from, [target], 'demote');
      await ctx.reply(`✅ Demoted @${jidToNumber(target)}`, { mentions: [target] });
    },
  },
  {
    name: 'kick',
    category: 'group',
    description: 'Remove a tagged/replied user from the group',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      const target = ctx.mentionedJid?.[0] || ctx.quotedParticipant;
      if (!target) return ctx.reply('❗ Tag or reply to the user you want to remove.');
      await sock.groupParticipantsUpdate(ctx.from, [target], 'remove');
      await ctx.reply(`✅ Removed @${jidToNumber(target)}`, { mentions: [target] });
    },
  },
  {
    name: 'add',
    category: 'group',
    description: 'Add a number to the group. Usage: .add 94xxxxxxxxx',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      const num = args[0]?.replace(/\D/g, '');
      if (!num) return ctx.reply('❗ Usage: .add <number>');
      await sock.groupParticipantsUpdate(ctx.from, [`${num}@s.whatsapp.net`], 'add');
      await ctx.reply(`✅ Add request sent to ${num}`);
    },
  },
  {
    name: 'mute',
    category: 'group',
    description: 'Only admins can send messages',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      await sock.groupSettingUpdate(ctx.from, 'announcement');
      await ctx.reply('🔇 Group muted — only admins can chat now.');
    },
  },
  {
    name: 'unmute',
    category: 'group',
    description: 'Everyone can send messages again',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      await sock.groupSettingUpdate(ctx.from, 'not_announcement');
      await ctx.reply('🔊 Group unmuted — everyone can chat now.');
    },
  },
  {
    name: 'lock',
    category: 'group',
    description: 'Lock group settings (only admins can edit group info)',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      await sock.groupSettingUpdate(ctx.from, 'locked');
      await ctx.reply('🔒 Group info locked to admins only.');
    },
  },
  {
    name: 'unlock',
    category: 'group',
    description: 'Unlock group settings',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      await sock.groupSettingUpdate(ctx.from, 'unlocked');
      await ctx.reply('🔓 Group info unlocked for everyone.');
    },
  },
  {
    name: 'welcome',
    category: 'group',
    description: 'Toggle welcome messages. Usage: .welcome on|off',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      const val = args[0]?.toLowerCase() === 'on';
      await setGroupSetting(ctx.from, 'welcome', val);
      await ctx.reply(`👋 Welcome messages: *${val ? 'ON' : 'OFF'}*`);
    },
  },
  {
    name: 'goodbye',
    category: 'group',
    description: 'Toggle goodbye messages. Usage: .goodbye on|off',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      const val = args[0]?.toLowerCase() === 'on';
      await setGroupSetting(ctx.from, 'goodbye', val);
      await ctx.reply(`👋 Goodbye messages: *${val ? 'ON' : 'OFF'}*`);
    },
  },
  {
    name: 'antilink',
    category: 'group',
    description: 'Toggle anti-link protection. Usage: .antilink on|off',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      const val = args[0]?.toLowerCase() === 'on';
      await setGroupSetting(ctx.from, 'antilink', val);
      await ctx.reply(`🔗 Anti-link: *${val ? 'ON' : 'OFF'}*`);
    },
  },
  {
    name: 'antibadword',
    category: 'group',
    description: 'Toggle bad-word filter. Usage: .antibadword on|off',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      const val = args[0]?.toLowerCase() === 'on';
      await setGroupSetting(ctx.from, 'antibadword', val);
      await ctx.reply(`🤬 Anti-badword: *${val ? 'ON' : 'OFF'}*`);
    },
  },
  {
    name: 'antispam',
    category: 'group',
    description: 'Toggle anti-spam protection. Usage: .antispam on|off',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      const val = args[0]?.toLowerCase() === 'on';
      await setGroupSetting(ctx.from, 'antispam', val);
      await ctx.reply(`🚯 Anti-spam: *${val ? 'ON' : 'OFF'}*`);
    },
  },
  {
    name: 'antilog',
    category: 'group',
    description: 'Notify on messages being deleted in the group. Usage: .antilog on|off',
    execute: async (sock, m, args, ctx) => {
      const err = requireGroupAdmin(ctx);
      if (err) return ctx.reply(err);
      const val = args[0]?.toLowerCase() === 'on';
      await setGroupSetting(ctx.from, 'antilog', val);
      await ctx.reply(`🕵️ Anti-delete log: *${val ? 'ON' : 'OFF'}*`);
    },
  },
];
