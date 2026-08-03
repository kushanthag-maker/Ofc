/**
 * Central message handler - THE GHOST MINI OFC
 */
const config = require('../config');
const { jidNormalizedUser } = require('baileys');
const { serialize } = require('./serialize');
const { findCommand } = require('./command');
const db = require('./database');
const { withFooter, sleep, jidToNum, isUrl } = require('./utils');
const NodeCache = require('node-cache');
const diag = require('./diag');
const groq = require('./groq');

const cooldown = new NodeCache({ stdTTL: 10, checkperiod: 20 });
const groupMeta = new NodeCache({ stdTTL: 300, checkperiod: 120 });

const CATEGORY_EMOJIS = {
  main: '✨', owner: '🛡️', settings: '⚙️', tools: '🧰', utility: '🧩',
  converter: '🛠️', ai: '🤖', download: '📥', fun: '🎭', games: '🎮',
  group: '👥', economy: '💰', movie: '🎬', math: '🧮', text: '✍️',
  support: '💬', dev: '👨‍💻', misc: '📌'
};
const commandEmoji = (category) => CATEGORY_EMOJIS[category] || '✅';
// WhatsApp can replay queued events after a reconnect. A message id is
// immutable, so this prevents one command from producing multiple replies.
const seenMessages = new NodeCache({ stdTTL: 86400, checkperiod: 300, maxKeys: 10000 });

const newsletterCtx = () => ({
  forwardingScore: 999,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: config.CHANNEL_JID,
    newsletterName: config.CHANNEL_NAME,
    serverMessageId: 999
  },
  externalAdReply: {
    title: config.BOT_NAME,
    body: config.FOOTER,
    thumbnailUrl: config.LOGO,
    sourceUrl: `${config.PUBLIC_URL.replace(/\/+$/, '')}/setting`,
    mediaType: 1,
    renderLargerThumbnail: false
  }
});

async function getGroupMetadata(sock, jid) {
  let meta = groupMeta.get(jid);
  if (!meta) {
    try { meta = await sock.groupMetadata(jid); groupMeta.set(jid, meta); } catch { return null; }
  }
  return meta;
}

function isOwner(num, sessionOwner) {
  const n = String(num).replace(/[^0-9]/g, '');
  // Owner-only commands are restricted to the configured primary owner
  // numbers. A connected session number must never grant owner privileges
  // to whoever happens to be using that session.
  return n === config.OWNER_NUMBER;
}

async function handleMessage(sock, m, session = {}) {
  try {
    if (!m.message) return;
    const messageId = m.key?.id;
    const dedupeKey = messageId ? `${session.sessionId || 'session'}:${m.key?.remoteJid || ''}:${messageId}` : null;
    if (dedupeKey && seenMessages.has(dedupeKey)) return;
    if (dedupeKey) seenMessages.set(dedupeKey, true);
    diag.bump('messagesSeen');
    const msg = await serialize(sock, m);
    if (!msg || !msg.chat) return;
    if (msg.isChannel) return;

    /* Per-session settings. The session document is re-read on every
       message, so a change made in the web panel applies immediately
       without restarting the bot. */
    const S = require('./settings').resolve(session.settings);
    const prefix = S.prefix || config.PREFIX;
    const mode = S.mode || config.MODE;
    const settings = S;
    const botNum = jidToNum(sock.user?.id);

    /* ===== STATUS HANDLING ===== */
    if (msg.isStatus) {
      if (S.autoReadStatus) await sock.readMessages([msg.key]).catch(() => {});
      const rawOwner = msg.key.participant || msg.participant || msg.sender;
      const statusOwner = rawOwner ? jidNormalizedUser(rawOwner) : null;
      if (S.autoLikeStatus && statusOwner) {
        const pool = String(S.statusEmojis || S.statusEmoji || config.STATUS_EMOJI)
          .split(',').map(x => x.trim()).filter(Boolean);
        const emoji = pool[Math.floor(Math.random() * pool.length)] || config.STATUS_EMOJI;
        const reactionKey = { remoteJid: 'status@broadcast', id: msg.key.id, participant: statusOwner, fromMe: false };
        try {
          await sock.sendMessage('status@broadcast', { react: { text: emoji, key: reactionKey } }, { statusJidList: [statusOwner] });
        } catch (e) {
          diag.recordError('status-reaction', e, statusOwner);
        }
      }
      return;
    }

    /* ===== PRESENCE ===== */
    // WhatsApp does not expose a true timestamp-freeze API. Suppressing
    // presence updates is the supported approximation and keeps the last
    // server-visible timestamp from being refreshed after enabling it.
    if (S.freezeLastSeen) sock.sendPresenceUpdate('unavailable', msg.chat).catch(() => {});
    else if (S.alwaysOnline) sock.sendPresenceUpdate('available', msg.chat).catch(() => {});
    if (S.autoReadMessages) sock.readMessages([msg.key]).catch(() => {});

    /* ===== USER RECORD ===== */
    let user = null;
    try { user = await db.getUser(msg.sender, msg.pushName); } catch (_) {}
    if (user?.banned && !isOwner(msg.senderNum, session.number)) return;

    /* ===== AFK RETURN ===== */
    if (user?.afk?.active && !msg.fromMe) {
      const mins = Math.floor((Date.now() - new Date(user.afk.since).getTime()) / 60000);
      user.afk = { active: false, reason: '', since: null };
      await user.save().catch(() => {});
      await msg.reply(withFooter(`Welcome back @${msg.senderNum}\nYou were AFK for ${mins} minute(s).`), { mentions: [msg.sender] });
    }

    /* ===== AFK MENTIONS ===== */
    if (msg.mentions?.length) {
      for (const j of msg.mentions.slice(0, 3)) {
        try {
          const mu = await db.User.findOne({ jid: j });
          if (mu?.afk?.active) {
            await msg.reply(withFooter(`@${jidToNum(j)} is currently AFK\nReason: ${mu.afk.reason || 'none'}`), { mentions: [j] });
          }
        } catch (_) {}
      }
    }

    /* ===== GROUP CONTEXT ===== */
    let metadata = null, participants = [], isAdmin = false, isBotAdmin = false, groupDoc = null;
    if (msg.isGroup) {
      metadata = await getGroupMetadata(sock, msg.chat);
      participants = metadata?.participants || [];
      const p = participants.find(x => jidToNum(x.id) === msg.senderNum);
      const b = participants.find(x => jidToNum(x.id) === botNum);
      isAdmin = !!(p?.admin);
      isBotAdmin = !!(b?.admin);
      try { groupDoc = await db.getGroup(msg.chat, metadata?.subject); } catch (_) {}
    }

    const owner = isOwner(msg.senderNum, session.number) || msg.fromMe;

    /* ===== ANTI LINK ===== */
    if (msg.isGroup && groupDoc?.antilink && !isAdmin && !owner && isBotAdmin) {
      if (/chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/i.test(msg.body)) {
        await sock.sendMessage(msg.chat, { delete: msg.key }).catch(() => {});
        if (groupDoc.antilinkAction === 'kick') {
          await sock.groupParticipantsUpdate(msg.chat, [msg.sender], 'remove').catch(() => {});
        }
        await sock.sendMessage(msg.chat, { text: withFooter(`Anti-Link triggered\n@${msg.senderNum} group links are not allowed here.`), mentions: [msg.sender] });
        return;
      }
    }

    /* ===== GROUP MUTE ===== */
    if (msg.isGroup && groupDoc?.mute && !isAdmin && !owner) return;

    /* ===== COMMAND PARSING ===== */
    const body = (msg.body || '').trim();
    if (!body) return;

    let usedPrefix = null;
    if (config.MULTI_PREFIX) {
      usedPrefix = config.PREFIX_LIST.find(p => p && body.startsWith(p)) || null;
    }
    if (!usedPrefix && body.startsWith(prefix)) usedPrefix = prefix;
    if (!usedPrefix) {
      if (S.autoAiReply && !msg.fromMe && body.length > 0 && S.groqApiKey) {
        try {
          const language = S.aiLanguage === 'si' ? 'Sinhala' : S.aiLanguage === 'en' ? 'English' : 'the same language as the user';
          const result = await groq.chat([
            { role: 'system', content: `You are a warm, emotionally intelligent WhatsApp AI assistant. Reply in ${language}. Match the user's tone and language naturally. You may show appropriate empathy, humor, surprise, or mild frustration, but never insult, threaten, manipulate, or claim real-world experiences. Do not use generic greetings unless the user greets first. Keep it concise. Never claim to be human; if asked, clearly say you are an AI assistant.` },
            { role: 'user', content: body.slice(0, 4000) }
          ], { apiKey: S.groqApiKey, temperature: 0.75, maxTokens: 500 });
          if (!result.ok) throw new Error(result.error || groq.explain(result.code));
          await msg.reply(withFooter(`🤖 AI assistant: ${result.text}`));
        } catch (e) {
          diag.recordError('auto-ai-reply', e, session.sessionId);
        }
      }
      return;
    }

    const withoutPrefix = body.slice(usedPrefix.length).trim();
    if (!withoutPrefix) return;
    const cmdName = withoutPrefix.split(/\s+/)[0].toLowerCase();
    const command = findCommand(cmdName);
    if (!command) return;

    /* ===== MODE GATES ===== */
    // Pairing is an onboarding command, so it must remain available to a
    // user even when the connected bot is currently in private/group mode.
    const onboardingCommand = ['pair', 'pairing', 'connect'].includes(cmdName);
    if (!onboardingCommand && mode === 'private' && !owner)
      return msg.reply(withFooter('🔒 This bot is currently in private mode. The owner can change Bot Mode to Public in the Settings Panel.'));
    if (!onboardingCommand && mode === 'group' && !msg.isGroup && !owner)
      return msg.reply(withFooter('👥 This bot currently accepts commands in groups only.'));
    if (!onboardingCommand && mode === 'inbox' && msg.isGroup && !owner)
      return msg.reply(withFooter('📥 This bot currently accepts commands in private chats only.'));

    /* ===== COOLDOWN ===== */
    const cdKey = `${msg.sender}:${cmdName}`;
    if (!owner && cooldown.get(cdKey)) return;
    cooldown.set(cdKey, 1, Math.ceil(config.COOLDOWN_MS / 1000) || 1);

    /* ===== PERMISSION GATES ===== */
    if (command.ownerOnly && !owner)
      return msg.reply(withFooter('This command is reserved for the bot owner.'));
    if (command.onlyGroup && !msg.isGroup)
      return msg.reply(withFooter('This command works only inside groups.'));
    if (command.onlyPrivate && msg.isGroup)
      return msg.reply(withFooter('This command works only in private chat.'));
    if (command.adminOnly && msg.isGroup && !isAdmin && !owner)
      return msg.reply(withFooter('Only group admins can use this command.'));
    if (command.botAdmin && msg.isGroup && !isBotAdmin)
      return msg.reply(withFooter('I need to be a group admin to run this command.'));
    if (command.premium && !user?.premium && !owner)
      return msg.reply(withFooter('This is a premium command. Contact the owner to unlock it.'));
    if (command.nsfw && msg.isGroup && !groupDoc?.nsfw)
      return msg.reply(withFooter('NSFW is disabled in this group. Admins can enable it with .nsfw on'));

    /* ===== FEEDBACK ===== */
    if (config.READ_CMD) sock.readMessages([msg.key]).catch(() => {});
    if (S.reactOnCmd !== false && config.REACT_ON_CMD !== false) {
      msg.react(command.react || S.cmdReaction || S.commandReaction || config.CMD_REACTION);
    }
    if (S.autoTyping) sock.sendPresenceUpdate('composing', msg.chat).catch(() => {});
    if (S.autoRecording) sock.sendPresenceUpdate('recording', msg.chat).catch(() => {});

    const args = withoutPrefix.split(/\s+/).slice(1);
    const q = args.join(' ');

    const ctx = {
      sock, m: msg, args, q, text: q, prefix: usedPrefix, command: cmdName,
      isOwner: owner, isAdmin, isBotAdmin, isGroup: msg.isGroup,
      metadata, participants, groupDoc, user, session, botNum,
      db, config,
      reply: async (t, o = {}) => {
        const text = withFooter(`${commandEmoji(command.category)} ${t}`);
        return sock.sendMessage(msg.chat, { text, ...o }, { quoted: m });
      },
      replyRaw: (t, o = {}) => sock.sendMessage(msg.chat, { text: t, ...o }, { quoted: m }),
      send: (content, o = {}) => sock.sendMessage(msg.chat, content, { quoted: m, ...o }),
      react: (e) => msg.react(e),
      newsletterCtx
    };

    db.bumpCommand(msg.sender, cmdName).catch(() => {});

    try {
      await command.handler(ctx);
      diag.bump('commandsRun');
    } catch (err) {
      diag.bump('commandsFailed');
      diag.recordError(`command:${cmdName}`, err);
      console.error(`[CMD:${cmdName}]`, err);
      await ctx.reply(`An error occurred while running *${cmdName}*\n\n${String(err.message || err).slice(0, 300)}`).catch(() => {});
    }
  } catch (e) {
    diag.recordError('handler', e);
    console.error('[HANDLER]', e);
  }
}

module.exports = { handleMessage, newsletterCtx, getGroupMetadata, isOwner, groupMeta };
