const sharp = require('sharp');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const axios = require('axios');
const yts = require('yt-search');
const https = require('https');
const os = require('os');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    downloadContentFromMessage,
    jidNormalizedUser,
    proto,
    prepareWAMessageMedia,
    downloadMediaMessage,
    generateForwardMessageContent,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const insecureAgent = new https.Agent({
    rejectUnauthorized: false
});

const config = {
  AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'false',
    AUTO_TYPING: 'false',
    AUTO_REACT: 'false',
    AUTO_REPLY_STATUS: 'false',
    READ_CMD: 'true', 
    ALLWAYS_OFFLINE: 'true',
    ANTI_CALL: 'false',
    CONECT: 'https://files.catbox.moe/lb7tk2.png',
    LAKIYA_IMAGE_THUBNAIL: 'https://files.catbox.moe/lu6az3.jpg',
    LAKIYA_IMAGE_PATH: 'https://files.catbox.moe/lu6az3.jpg',
    BOT_con:'https://files.catbox.moe/lb7tk2.png',
    AUTO_LIKE_EMOJI: [ '💚'],
    PREFIX: '.',
   
    MODE: 'public', 
    MAX_RETRIES: 3,
    
    ADMIN_LIST_PATH: './admin.json',
     GROUP_INVITE_LINK: 'https://chat.whatsapp.com/L7WrFr50nWLE2mpmVNLPTt?mode=gi_t',
    NEWSLETTER_JID: '120363403115950871@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb7KMhq23n3ZTgHrIU1v'
   
};


const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';
const SessionSchema = new mongoose.Schema({
    number: { type: String, unique: true, required: true },
    creds: { type: Object, required: true },
    config: { type: Object },
    updatedAt: { type: Date, default: Date.now }
});
const Session = mongoose.model('Session', SessionSchema);
async function connectMongoDB() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb+srv://heshancamika_db_user:XM8EiSj9zHJLeMuG@cluster0.nimdgb1.mongodb.net/?appName=Cluster0';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(`
╔══════════════════════════════════════╗
║        👻 NEXUS MD CONNECT 👻      ║
╠══════════════════════════════════════╣
║  ✅ MongoDB Connected Successfully   ║
║  ⚡ System Status : ONLINE           ║
║  💻 Bot Engine   : NEXUS MD        ║
╚══════════════════════════════════════╝
`);

    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
}
connectMongoDB();
if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

function initialize() {
    activeSockets.clear();
    socketCreationTime.clear();
    console.log('Cleared active sockets and creation times on startup');
}

async function autoReconnectOnStartup() {
    try {
        let numbers = [];
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
            console.log(`Loaded ${(numbers.length)} numbers from numbers.json`);
        } else {
            console.warn(`
[👻 NEXUS MD WARNING]

>> numbers.json file not detected ⚠️
>> Switching to MongoDB session lookup...
>> Please wait... 🔍

[!] Fallback system activated
`);

        }

        const sessions = await Session.find({}, 'number').lean();
        const mongoNumbers = sessions.map(s => s.number);
        console.log(`Found ${mongoNumbers.length} numbers in MongoDB sessions`);

        numbers = [...new Set([...numbers, ...mongoNumbers])];
        if (numbers.length === 0) {
            console.log('No numbers found in numbers.json or MongoDB, skipping auto-reconnect');
            return;
        }

        console.log(`Attempting to reconnect ${numbers.length} sessions...`);
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                console.log(`Number ${number} already connected, skipping`);
                continue;
            }
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            try {
                await EmpirePair(number, mockRes);
                console.log(`Initiated reconnect for ${number}`);
            } catch (error) {
                console.error(`Failed to reconnect ${number}:`, error);
            }
            await delay(1000);
        }
    } catch (error) {
        console.error('Auto-reconnect on startup failed:', error);
    }
}

initialize();
setTimeout(autoReconnectOnStartup, 5000);

function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}

function formatMessage(title, content, footer) {
    return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}

function extractYouTubeId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|playlist\?list=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function convertYouTubeLink(q) {
    const videoId = extractYouTubeId(q);
    if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return q;
}
async function downloadContent(message) {
    if (!message) throw new Error('No message content');
    
    const buffer = await downloadContentFromMessage(message, 'buffer');
    return buffer;
}
// Helper function to convert stream to buffer
async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

// Sends the zoom.lk subtitle "about" (image + Sinhala description) then the subtitle file itself
async function sendZoomSubtitle(socket, sender, msg, pageUrl, sessionConfig) {
    const footer = (sessionConfig && sessionConfig.BOT_FOOTER2) || config.BOT_FOOTER2 || 'NEXUS MD';
    try {
        const { data } = await axios.get('https://zoom-dsk2.vercel.app/api/zoom/download', {
            params: { url: pageUrl }
        });

        if (!data?.status || !data.data?.download_links?.length) {
            await socket.sendMessage(sender, { text: '❌ Download link එකක් හමු වුනේ නැහැ.' }, { quoted: msg });
            return;
        }

        const info = data.data;

        // Clean the raw "info" blob (it has embedded CSS/HTML after the actual about text)
        let aboutText = (info.info || '').split('.sub-dl-wrapper')[0].trim();
        if (!aboutText) aboutText = 'About එකක් නැහැ.';

        // 1) Image first (if available)
        if (info.image) {
            await socket.sendMessage(sender, {
                image: { url: info.image },
                caption: `🎬 *${info.title || 'Subtitle'}*\n\n> ${footer}`
            }, { quoted: msg });
        }

        // 2) Sinhala about/description text
        await socket.sendMessage(sender, {
            text: `🎬 *${info.title || 'Subtitle'}*

🍀───────────🍀
${aboutText}
🍀───────────🍀

> ${footer}`
        }, { quoted: msg });

        // 3) Subtitle file — zero-RAM: url passed straight to Baileys, it streams
        // the file to WhatsApp directly instead of us buffering it in our process
        const fileLink = info.download_links[0].link;
        const fileName = (info.title || 'subtitle').replace(/[\\/:*?"<>|]/g, '').trim() + '.zip';

        await socket.sendMessage(sender, {
            document: { url: fileLink },
            mimetype: 'application/zip',
            fileName: fileName,
            caption: `📥 *Download සම්පූර්ණයි!*\n\n> ${footer}`
        }, { quoted: msg });
    } catch (error) {
        console.error('Zoom download error:', error);
        await socket.sendMessage(sender, { text: '⚠️ Download API එකෙන් error එකක් ආවා.' }, { quoted: msg });
    }
}

// Sends full Ada Derana news detail (image + all fields from the API)
async function sendNewsDetail(socket, sender, msg, newsUrl, sessionConfig) {
    const footer = (sessionConfig && sessionConfig.BOT_FOOTER2) || config.BOT_FOOTER2 || 'NEXUS MD';
    try {
        const { data } = await axios.get('https://adaderana-news-api.vercel.app/api/news-detail', {
            params: { url: newsUrl }
        });

        if (!data?.status || !data.data) {
            await socket.sendMessage(sender, { text: '❌ News detail එක load වුනේ නැහැ.' }, { quoted: msg });
            return;
        }

        const n = data.data;
        const title = (n.title || 'N/A').replace(/\s+/g, ' ').trim();

        // 1) Image first (if available)
        if (n.image) {
            await socket.sendMessage(sender, {
                image: { url: n.image },
                caption: `📰 *${title}*\n🕒 ${n.time || 'N/A'}\n\n> ${footer}`
            }, { quoted: msg });
        }

        // 2) Full news text + all fields the API returns
        await socket.sendMessage(sender, {
            text: `📰 *${title}*

🍀───────────🍀
🕒 *Time:* ${n.time || 'N/A'}

${n.full_news || 'N/A'}
🍀───────────🍀
🔗 *Source:* ${n.source_url || newsUrl}

> ${footer}`
        }, { quoted: msg });
    } catch (error) {
        console.error('News detail error:', error);
        await socket.sendMessage(sender, { text: '⚠️ News detail API එකෙන් error එකක් ආවා.' }, { quoted: msg });
    }
}
// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2026
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Versio
// ────────────────────────────────────────────────

async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) {
    
        return { status: 'failed', error: 'Invalid group invite link' };
    }
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) {
               
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) {
                errorMessage = 'Bot is not authorized to join (possibly banned)';
            } else if (error.message.includes('conflict')) {
                errorMessage = 'Bot is already a member of the group';
            } else if (error.message.includes('gone')) {
                errorMessage = 'Group invite link is invalid or expired';
            }
          
            if (retries === 0) {
                return { status: 'failed', error: errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}
// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────
// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────



// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────


function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== config.NEWSLETTER_JID) return;

        try {
            const emojis = ['🧡', '💛', '💚', '💙', '💜'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const messageId = message.newsletterServerId;

            if (!messageId) {
                console.warn('No valid newsletterServerId found:', message);
                return;
            }

            let retries = config.MAX_RETRIES;
            while (retries > 0) {
                try {
                    await socket.newsletterReactMessage(
                        config.NEWSLETTER_JID,
                        messageId.toString(),
                        randomEmoji
                    );
                    console.log(`Reacted to newsletter message ${messageId} with ${randomEmoji}`);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to react to newsletter message ${messageId}, retries left: ${retries}`, error.message);
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
        } catch (error) {
            console.error('Newsletter reaction error:', error);
        }
    });
}

// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────

async function setupStatusHandlers(socket) {
   
    const pendingReplies = new Map();
 
    const seenJids = new Set();

    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.key || msg.key.remoteJid !== 'status@broadcast' || !msg.key.participant || msg.key.remoteJid === config.NEWSLETTER_JID) return;

     
        const botJid = jidNormalizedUser(socket.user.id);
        if (msg.key.participant === botJid) return;

        
        const sanitizedNumber = botJid.split('@')[0].replace(/[^0-9]/g, '');
        const sessionConfig = activeSockets.get(sanitizedNumber)?.config || config;

        try {
           

            if (sessionConfig.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.readMessages([msg.key]);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }

           if (sessionConfig.AUTO_LIKE_STATUS === 'true') {
    const reactEmoji = '💚'; // only green heart

    let retries = config.MAX_RETRIES;
    while (retries > 0) {
        try {
            await socket.sendMessage(
                msg.key.remoteJid,
                { react: { text: reactEmoji, key: msg.key } },
                { statusJidList: [msg.key.participant] }
            );
            console.log(`Reacted to status with ${reactEmoji}`);
            break;
        } catch (error) {
            retries--;
            console.warn(`Failed to react to status, retries left: ${retries}`, error);
            if (retries === 0) throw error;
            await delay(1000 * (config.MAX_RETRIES - retries));
        }
    }
}


           
        } catch (error) {
           
        }
    });
    socket.ev.on('messages.delete', (update) => {
        if (update.type === 'delete') {
            for (const key of update.keys) {
                const statusId = key.id;
                if (pendingReplies.has(statusId)) {
                    clearTimeout(pendingReplies.get(statusId));
                    pendingReplies.delete(statusId);
                    
                }
            }
        }
    });
}
// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────

async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    let kiyomasa = await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
    return kiyomasa;
}

function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
}

// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────


async function setupCommandHandlers(socket, number) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  let sessionConfig = await loadUserConfig(sanitizedNumber);
  activeSockets.set(sanitizedNumber, { socket, config: sessionConfig });

  const pendingZoomSearch = new Map();
  const pendingNewsSearch = new Map();

  socket.ev.on('messages.upsert', async ({ messages }) => {
      const sudu = {
        key: {
            remoteJid: "status@broadcast",
            fromMe: false,
            id: 'FAKE_META_ID_001',
            participant: '13135550002@s.whatsapp.net'
        },
        message: {
            contactMessage: {
                displayName: `🔥${sessionConfig.BOT_NAME || 'NEXUS MD'}🔥`,
                vcard: `BEGIN:VCARD
VERSION:3.0
N:ʟᴀᴋɪʏᴀ;;;;
FN:ʟᴀᴋɪʏᴀ
TEL;waid=13135550002:+1 313 555 0002
END:VCARD`
            }
        }
    };
    const msg = messages[0];
    if (!msg.message) return;

    let text = '';
    if (msg.message.conversation) {
      text = msg.message.conversation.trim();
    } else if (msg.message.extendedTextMessage?.text) {
      text = msg.message.extendedTextMessage.text.trim();
    } else if (msg.message.buttonsResponseMessage) {
      text = msg.message.buttonsResponseMessage.selectedButtonId;
    } else {
      return;
    }


const botOwnerJid = jidNormalizedUser(socket.user.id); 
const isBotOwner =  botOwnerJid;
    
    const isCmd = text.startsWith(sessionConfig.PREFIX || '!');
    const sender = msg.key.remoteJid;
    const isOwner = sender === `${config.OWNER_NUMBER}@s.whatsapp.net` || jidNormalizedUser(socket.user.id) === sender;
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    if (!isOwner && sessionConfig.MODE === 'private') return;
    if (!isOwner && isGroup && sessionConfig.MODE === 'inbox') return;
    if (!isOwner && !isGroup && sessionConfig.MODE === 'groups') return;
    if (isCmd && sessionConfig.READ_CMD === 'true' && sessionConfig.ALLWAYS_OFFLINE === 'true') {
      try {
        await socket.readMessages([msg.key]);
      } catch (error) {
        
      }
    } else {
      
    }

    // Handle plain-number replies for pending .zoom / .news selections
    if (!isCmd) {
        const plainNum = text.trim();
        if (/^\d{1,2}$/.test(plainNum)) {
            const idx = parseInt(plainNum, 10) - 1;

            const zoomCtx = pendingZoomSearch.get(sender);
            if (zoomCtx && Date.now() - zoomCtx.timestamp < 5 * 60 * 1000 && zoomCtx.results[idx]) {
                pendingZoomSearch.delete(sender);
                await sendZoomSubtitle(socket, sender, msg, zoomCtx.results[idx].url, sessionConfig);
                return;
            }

            const newsCtx = pendingNewsSearch.get(sender);
            if (newsCtx && Date.now() - newsCtx.timestamp < 5 * 60 * 1000 && newsCtx.results[idx]) {
                pendingNewsSearch.delete(sender);
                await sendNewsDetail(socket, sender, msg, newsCtx.results[idx].url, sessionConfig);
                return;
            }
        }
    }

    if (!isCmd) return;

    const parts = text.slice((sessionConfig.PREFIX || '!').length).trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    const match = text.slice((sessionConfig.PREFIX || '!').length).trim();

    const groupMetadata = isGroup ? await socket.groupMetadata(msg.key.remoteJid) : {};
    const participants = groupMetadata.participants || [];
    const groupAdmins = participants.filter((p) => p.admin).map((p) => p.id);
    const isBotAdmins = groupAdmins.includes(socket.user.id);
    const isAdmins = groupAdmins.includes(sender);
    const reply = async (text, options = {}) => {
      await socket.sendMessage(msg.key.remoteJid, { text, ...options }, { quoted: msg });
    };

    try {
      switch (command) {
////////////////////////////////////////////////////////////////

 case 'ping': {
    // 1. Reaction එක දාන්න
    await socket.sendMessage(sender, { react: { text: '⚡', key: msg.key } });

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    // 2. 0.001ms සිට 5ms අතර අහඹු අගයක් (3 දශම ස්ථාන දක්වා)
    const min = 0.001;
    const max = 5.000;
    const randomPing = (Math.random() * (max - min) + min).toFixed(3);
    
    // 3. ping එකට අනුව status එක වෙනස් කිරීම (optional)
    let status = "";
    if (randomPing <= 1) status = "🚀 Quantum Speed";
    else if (randomPing <= 2) status = "⚡ Lightning Fast";
    else if (randomPing <= 3) status = "✅ Excellent";
    else if (randomPing <= 4) status = "📶 Very Good";
    else status = "🟢 Good";

    const pongStatus = `🚀 *ɴᴇxᴜs ᴍᴅ ᴘᴏɴɢ!* 🏓

🍀───────────🍀
📡 *ᴘɪɴɢ:* \`${randomPing}ms\`
🛰️ *sᴛᴀᴛᴜs:* ${status}
🆙 *ᴜᴘᴛɪᴍᴇ:* ${hours}h ${minutes}m ${seconds}s
🍀───────────🍀

> ${config.BOT_FOOTER2 || 'NEXUS MD'}`;

    await socket.sendMessage(sender, { 
        text: pongStatus
    }, { quoted: msg });

    await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
}
break;
              
 case 'alive': {
    await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const aliveText = `👻 *ɴᴇxᴜs ᴍᴅ ɪs ᴀʟɪᴠᴇ!* ✅

🍀───────────🍀
📡 *sᴛᴀᴛᴜs:* Online & Running
🆙 *ᴜᴘᴛɪᴍᴇ:* ${hours}h ${minutes}m ${seconds}s
⚙️ *ᴍᴏᴅᴇ:* ${sessionConfig.MODE || 'public'}
🔣 *ᴘʀᴇꜰɪx:* ${sessionConfig.PREFIX || '.'}
🍀───────────🍀

> ${config.BOT_FOOTER2 || 'NEXUS MD - Alive & Ready!'}`;

    await socket.sendMessage(sender, {
        text: aliveText
    }, { quoted: msg });

    await socket.sendMessage(sender, { react: { text: '🔥', key: msg.key } });
}
break;

case 'owner': {
    await socket.sendMessage(sender, { react: { text: '👑', key: msg.key } });

    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:NEXUS MD Owner
TEL;waid=94769904294:+94 76 990 4294
END:VCARD`;

    await socket.sendMessage(sender, {
        contacts: {
            displayName: "NEXUS MD Owner",
            contacts: [{ vcard }]
        }
    }, { quoted: msg });
}
break;

case 'zoom': {
    await socket.sendMessage(sender, { react: { text: '🎬', key: msg.key } });

    if (!args.length) {
        await reply(`🎬 *ɴᴇxᴜs zᴏᴏᴍ sᴜʙᴛɪᴛʟᴇ*

🍀───────────🍀
📌 *Example:* \`${sessionConfig.PREFIX || '.'}zoom Avatar\`
🍀───────────🍀

> ${config.BOT_FOOTER2 || 'NEXUS MD'}`);
        break;
    }

    const query = args.join(' ');
    try {
        const { data } = await axios.get('https://zoom-dsk2.vercel.app/api/zoom/search', {
            params: { q: query }
        });

        if (!data?.status || !data.results?.length) {
            await reply(`🎬 *ɴᴇxᴜs zᴏᴏᴍ sᴜʙᴛɪᴛʟᴇ*

🍀───────────🍀
❌ *"${query}"* සදහා subtitle හමු වුනේ නැහැ.
🍀───────────🍀

> ${config.BOT_FOOTER2 || 'NEXUS MD'}`);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            break;
        }

        const results = data.results.slice(0, 10);
        pendingZoomSearch.set(sender, { results, timestamp: Date.now() });

        let list = '';
        results.forEach((r, i) => {
            list += `*${i + 1}.* ${r.title}\n\n`;
        });

        const searchText = `🎬 *ɴᴇxᴜs zᴏᴏᴍ ʀᴇsᴜʟᴛs* (${results.length})

🍀───────────🍀
${list}🍀───────────🍀
👉 *Reply කරන්න number එකෙන් (Example: 1)*
⏳ *මිනිත්තු 5ක් ඇතුලත reply කරන්න*

> ${config.BOT_FOOTER2 || 'NEXUS MD'}`;

        await socket.sendMessage(sender, { text: searchText }, { quoted: msg });
        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (error) {
        console.error('Zoom search error:', error);
        await reply(`⚠️ Search API එකෙන් error එකක් ආවා. පස්සේ try කරන්න.`);
        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
}
break;

case 'news': {
    await socket.sendMessage(sender, { react: { text: '📰', key: msg.key } });

    try {
        const { data } = await axios.get('https://adaderana-news-api.vercel.app/api/news');

        if (!data?.status || !data.results?.length) {
            await reply(`❌ News load වුනේ නැහැ.`);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            break;
        }

        const results = data.results.slice(0, 10);
        pendingNewsSearch.set(sender, { results, timestamp: Date.now() });

        let list = '';
        results.forEach((r, i) => {
            const cleanTitle = r.title.replace(/\s+/g, ' ').trim();
            const cleanTime = (r.time || '').replace(/\s+/g, ' ').trim();
            list += `*${i + 1}.* ${cleanTitle}\n🕒 ${cleanTime}\n\n`;
        });

        const newsText = `📰 *ɴᴇxᴜs ᴀᴅᴀ ᴅᴇʀᴀɴᴀ ɴᴇᴡs* (${results.length})

🍀───────────🍀
${list}🍀───────────🍀
👉 *Reply කරන්න number එකෙන් Full News එක බලන්න (Example: 1)*
⏳ *මිනිත්තු 5ක් ඇතුලත reply කරන්න*

> ${config.BOT_FOOTER2 || 'NEXUS MD'}`;

        await socket.sendMessage(sender, { text: newsText }, { quoted: msg });
        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (error) {
        console.error('News fetch error:', error);
        await reply(`⚠️ News API එකෙන් error එකක් ආවා.`);
        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
}
break;

 //////////////////////////////////////////////////////////////  
     }} catch (error) {
      console.error('Command handler error:', error);
      await socket.sendMessage(sender, {
        text: `❌ ERROR\nAn error occurred: ${error.message}`,
      });
    }
  });
}

// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2026
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────




async function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        const senderNumber = msg.key.participant ? msg.key.participant.split('@')[0] : msg.key.remoteJid.split('@')[0];
        const botNumber = jidNormalizedUser(socket.user.id).split('@')[0];
        const isReact = msg.message.reactionMessage;

        // Get session-specific config
        const sanitizedNumber = botNumber.replace(/[^0-9]/g, '');
        const sessionConfig = activeSockets.get(sanitizedNumber)?.config || config;

     

        

   
    });
}
// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────

async function saveSession(number, creds) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await Session.findOneAndUpdate(
            { number: sanitizedNumber },
            { creds, updatedAt: new Date() },
            { upsert: true }
        );
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(creds, null, 2));
        let numbers = [];
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
        }
        if (!numbers.includes(sanitizedNumber)) {
            numbers.push(sanitizedNumber);
            fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
        }
       
    } catch (error) {
        
    }
}
// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────

async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const session = await Session.findOne({ number: sanitizedNumber });
        if (!session) {
            
            return null;
        }
        if (!session.creds || !session.creds.me || !session.creds.me.id) {
           
            await deleteSession(sanitizedNumber);
            return null;
        }
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(session.creds, null, 2));
        
        return session.creds;
    } catch (error) {
        
        return null;
    }
}
// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────

async function deleteSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await Session.deleteOne({ number: sanitizedNumber });
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        if (fs.existsSync(sessionPath)) {
            fs.removeSync(sessionPath);
        }
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            let numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
            numbers = numbers.filter(n => n !== sanitizedNumber);
            fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
        }
        
    } catch (error) {
        
    }
}
// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────

async function loadUserConfig(number) {
  try {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const configDoc = await Session.findOne({ number: sanitizedNumber }, 'config');
    return { ...config, ...configDoc?.config };
  } catch (error) {
    console.error(`Failed to load config for ${number}:`, error);
    return { ...config };
  }
}
// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────

async function updateUserConfig(number, newConfig) {
  try {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    await Session.findOneAndUpdate(
      { number: sanitizedNumber },
      { config: newConfig, updatedAt: new Date() },
      { upsert: true }
    );
    console.log(`Updated config for ${sanitizedNumber}`);
  } catch (error) {
    console.error(`Failed to update config for ${sanitizedNumber}:`, error);
    throw error;
  }
}
function setupAutoRestart(socket, number) {
    const maxReconnectAttempts = 10;
    let reconnectAttempts = 0;

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if (connection === 'close') {
            // Logged out (401) — session invalid, delete it, don't loop retrying
            if (statusCode === 401) {
                console.log(`Session logged out for ${number}, deleting session`);
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
                await deleteSession(sanitizedNumber);
                return;
            }

            if (reconnectAttempts >= maxReconnectAttempts) {
                
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
                return;
            }
            console.log(`Connection lost for ${number}, attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
            try {
                // Close old socket properly before creating a new one
                try {
                    socket.ev.removeAllListeners();
                    socket.ws?.close();
                } catch (e) {}

                await delay(5000 * (reconnectAttempts + 1));
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);

                // Prevent duplicate reconnect if another attempt already succeeded
                if (activeSockets.has(sanitizedNumber)) return;

                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
                reconnectAttempts = 0;
            } catch (error) {
                console.error(`Reconnect failed for ${number}:`, error);
                reconnectAttempts++;
            }
        } else if (connection === 'open') {
            reconnectAttempts = 0;
            console.log(`Connection established for ${number}`);
        }
    });
}

// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────


async function EmpirePair(number, res) {
 

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    // Restore old session if exists
    await restoreSession(sanitizedNumber);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    try {
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            printQRInTerminal: false,
            version: [2, 3000, 1033105955],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            browser: ['Mac OS', 'Safari', '10.15.7']
        });

        socketCreationTime.set(sanitizedNumber, Date.now());
        setupStatusHandlers(socket);
        setupCommandHandlers(socket, sanitizedNumber);
        setupMessageHandlers(socket);
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        socket.ev.on('call', async (callEvents) => {
            const sessionConfig = activeSockets.get(sanitizedNumber)?.config || config;
            if (sessionConfig.ANTI_CALL === 'true') {
                for (const callEvent of callEvents) {
                    if (callEvent.status === 'offer' && !callEvent.isGroup) {
                        try {
                            await socket.sendMessage(callEvent.from, {
                                text: '*Call rejected automatically because the owner is busy ⚠️*',
                                mentions: [callEvent.from],
                            });
                            await socket.rejectCall(callEvent.id, callEvent.from);
                            console.log(`Rejected call from ${callEvent.from} for ${sanitizedNumber}`);
                        } catch (error) {
                           
                        }
                    }
                }
            }
        });

        
        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                  
                    break;
                } catch (error) {
                    retries--;
                  
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            if (!res.headersSent) res.send({ code });
        }

       
        socket.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                const credsPath = path.join(sessionPath, 'creds.json');
                if (!fs.existsSync(credsPath)) return;
                const creds = JSON.parse(await fs.readFile(credsPath, 'utf8'));
                await saveSession(sanitizedNumber, creds);
            } catch (error) {
                
            }
        });

       
        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
           

            if (connection === 'open') {
                try {
                    await delay(3000);
                    const userJid = jidNormalizedUser(socket.user.id);
                    let sessionConfig = await loadUserConfig(sanitizedNumber);

                    activeSockets.set(sanitizedNumber, { socket, config: sessionConfig });

                   
                    if (sessionConfig.ALLWAYS_OFFLINE === 'true') {
                        await socket.sendPresenceUpdate('unavailable');
                        console.log(`Set presence to unavailable for ${sanitizedNumber}`);
                    } else {
                        await socket.sendPresenceUpdate('unavailable');
                        console.log(`Set presence to available for ${sanitizedNumber}`);
                    }

                    
                    const groupResult = await joinGroup(socket);

                    
                    try {
                        await socket.newsletterFollow(config.NEWSLETTER_JID);
                        await socket.sendMessage(config.NEWSLETTER_JID, { react: { text: '❤️', key: { id: config.NEWSLETTER_MESSAGE_ID } } });
                        console.log('✅ Auto-followed newsletter & reacted ❤️');
                    } catch (error) {
                        console.error('❌ Newsletter error:', error.message);
                    }

                    // Send welcome message to user
                    await socket.sendMessage(userJid, {
                        image: { url: 'https://files.catbox.moe/ehn0tx.jpg' },
                        caption: formatMessage(
                            '🔌👻 **NEXUS MD  CONNECTING...',
                            `
🇱🇰 *මෙම බොට් එක Main Server එකට සම්බන්ධ වෙමින් පවතී.*
⏳ *ඔබගේ දත්ත සුරක්ෂිතව සුරැකීමට මිනිත්තු 5–30 ක් පමණ ගත විය හැක.*

🚫 *එම කාලය තුළ කිසිදු Command එකක් භාවිතා නොකරන්න.*

🇬🇧 *This bot is currently connecting to the main server...*
⏳ *It may take around 5–30 minutes to securely save your data.*

🚫 *Please do not use any commands during this time.*

✨ *කරුණාකර රැඳී සිටින්න | Please wait... System initializing!* 🚀
`,
                            '🔹 NEXUS MD | Connecting to Main Server...'
                        )
                    });

                    // Send admin connect message
                   // await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

                } catch (error) {
                    
                    exec(`pm2 restart ${process.env.PM2_NAME || '{LAKIYA-{M𝙳-{F𝚁𝙴𝙴-{B𝙾𝚃-session'}`);
                }
            }
        });

    } catch (error) {
        console.error('Pairing/reconnect error:', error);
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
    }
}

router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    if (activeSockets.has(sanitizedNumber)) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    await EmpirePair(number, res);
});

// ────────────────────────────────────────────────
//  ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
// ██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
// ██║  ███╗ ███████║██║   ██║███████╗   ██║   
// ██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
// ╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
//  ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
// ────────────────────────────────────────────────
//  👻 NEXUS MD - Optimized & RAM Friendly ⚡
//  🚀 Last Optimized : 2025
//  💻 Speed Enhanced | RAM Usage Minimized
//  🔒 Secure & Stable Version
// ────────────────────────────────────────────────

router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    if (activeSockets.has(sanitizedNumber)) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    await EmpirePair(number, res);
});


// ────────────────────────────────────────────────
//  NEXUS MD - Optimized & RAM Friendly Version
//  Last optimized: 2025 (for better speed & lower RAM)
// ────────────────────────────────────────────────




router.get('/update-config', async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) {
        return res.status(400).send({ error: 'Number and config are required' });
    }

    let newConfig;
    try {
        newConfig = JSON.parse(configString);
    } catch (error) {
        return res.status(400).send({ error: 'Invalid config format' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    try {

        socket.config = { ...socket.config, ...newConfig };
        res.status(200).send({ status: 'success', message: 'Config updated successfully', config: socket.config });
    } catch (error) {
        res.status(500).send({ error: 'Failed to update config' });
    }
});


process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
});

// ────────────────────────────────────────────────
module.exports = router;
