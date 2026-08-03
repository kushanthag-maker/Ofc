const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const readline = require('readline');

const config = require('./config/config');
const logger = require('./lib/logger');
const { connectDB } = require('./database/db');
const { useMongoDBAuthState } = require('./database/mongoAuthState');
const { loadCommands, getCommand } = require('./lib/commandHandler');
const { checkSpam } = require('./middlewares/antiSpam');
const { isBlocked } = require('./middlewares/blockList');
const { getSettings } = require('./lib/settings');
const { handleGroupParticipantsUpdate } = require('./events/groupParticipants');
const { applyGroupFilters } = require('./events/groupFilters');
const { createServer } = require('./website/server');

const botState = {
  connected: false,
  startedAt: Date.now(),
  qr: null,
  requestPairingCode: null,
};

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function startBot() {
  logger.banner(config.BOT_NAME);
  await connectDB();
  loadCommands();

  const { state, saveCreds } = await useMongoDBAuthState();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: config.PAIRING_METHOD === 'qr',
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    browser: [config.BOT_NAME, 'Chrome', '1.0.0'],
  });

  botState.sock = sock;

  // Expose pairing-code request to the website
  botState.requestPairingCode = async (number) => {
    if (sock.authState.creds.registered) throw new Error('Already paired.');
    const code = await sock.requestPairingCode(number);
    return code;
  };

  // CLI fallback: if running interactively and PAIRING_METHOD=code, ask for number in terminal too
  if (config.PAIRING_METHOD === 'code' && !sock.authState.creds.registered && process.stdin.isTTY) {
    setTimeout(async () => {
      if (sock.authState.creds.registered) return;
      const number = await ask('📱 Enter WhatsApp number with country code (or press Enter to use the website instead): ');
      if (number.trim()) {
        try {
          const code = await sock.requestPairingCode(number.replace(/\D/g, ''));
          logger.bot(`Your pairing code: ${code}`);
        } catch (err) {
          logger.error(`Failed to request pairing code: ${err.message}`);
        }
      }
    }, 3000);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      botState.qr = await QRCode.toDataURL(qr);
      if (config.PAIRING_METHOD === 'qr') qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === 'close') {
      botState.connected = false;
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn(`Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        startBot(); // auto reconnect
      } else {
        logger.error('Logged out. Delete the session in MongoDB and re-pair.');
      }
    } else if (connection === 'open') {
      botState.connected = true;
      logger.success(`${config.BOT_NAME} connected successfully! ✅`);
    }
  });

  sock.ev.on('group-participants.update', (update) => handleGroupParticipantsUpdate(sock, update));

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    try {
      await handleMessage(sock, msg);
    } catch (err) {
      logger.error(`Message handler crashed (recovered): ${err.message}`);
    }
  });

  return sock;
}

function extractText(message) {
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ''
  );
}

async function handleMessage(sock, msg) {
  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  const sender = isGroup ? msg.key.participant : from;
  const text = extractText(msg.message).trim();

  const settings = await getSettings();
  if (settings.autoread) await sock.readMessages([msg.key]);
  if (settings.autotyping) await sock.sendPresenceUpdate('composing', from);
  if (settings.autorecord) await sock.sendPresenceUpdate('recording', from);

  // Block list check
  if (await isBlocked(sender)) return;

  // Build reusable context object passed to every command
  const quoted = msg.message.extendedTextMessage?.contextInfo;
  let isSenderAdmin = false;
  let isBotAdmin = false;
  if (isGroup) {
    try {
      const metadata = await sock.groupMetadata(from);
      const participant = metadata.participants.find((p) => p.id === sender);
      isSenderAdmin = ['admin', 'superadmin'].includes(participant?.admin);
      const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      const botParticipant = metadata.participants.find((p) => p.id.startsWith(botId.split('@')[0]));
      isBotAdmin = ['admin', 'superadmin'].includes(botParticipant?.admin);
    } catch { /* ignore metadata errors */ }
  }

  const ctx = {
    from,
    sender,
    isGroup,
    isOwner: sender?.startsWith(config.OWNER_NUMBER) && config.OWNER_NUMBER.length > 0,
    isSenderAdmin,
    isBotAdmin,
    key: msg.key,
    mentionedJid: quoted?.mentionedJid || [],
    quotedParticipant: quoted?.participant,
    reply: (content, extra = {}) =>
      sock.sendMessage(from, typeof content === 'string' ? { text: content, ...extra } : content, { quoted: msg }),
    downloadQuotedMedia: async () => {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      const target = quoted?.quotedMessage
        ? { message: quoted.quotedMessage, key: { remoteJid: from, id: quoted.stanzaId } }
        : msg;
      const mediaMsg = quoted?.quotedMessage || msg.message;
      if (!mediaMsg.imageMessage && !mediaMsg.stickerMessage && !mediaMsg.videoMessage) return null;
      return downloadMediaMessage(target.message ? target : msg, 'buffer', {});
    },
  };

  // Anti-link / anti-badword group filters run before command parsing
  if (isGroup && text) {
    const handled = await applyGroupFilters(sock, ctx, text);
    if (handled) return;
  }

  if (!text.startsWith(config.PREFIX)) return;

  const [rawCmd, ...args] = text.slice(config.PREFIX.length).trim().split(/\s+/);
  const cmd = getCommand(rawCmd.toLowerCase());
  if (!cmd) return;

  if (cmd.ownerOnly && !ctx.isOwner) {
    return ctx.reply('🚫 This command is for the bot owner only.');
  }

  const { allowed, warn } = checkSpam(sender);
  if (!allowed) {
    if (warn) await ctx.reply('⏳ Slow down! You are sending commands too fast.');
    return;
  }

  await cmd.execute(sock, msg, args, ctx);
}

// Anti-crash: never let one bad command kill the whole process
process.on('unhandledRejection', (err) => logger.error(`Unhandled rejection: ${err?.message || err}`));
process.on('uncaughtException', (err) => logger.error(`Uncaught exception: ${err?.message || err}`));

(async () => {
  createServer(botState);
  await startBot();
})();
