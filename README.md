async function EmpirePair(number, res) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(os.tmpdir(), `session_${sanitizedNumber}`);
  await initMongo().catch(()=>{});
  // Prefill from Mongo if available
  try {
    const mongoDoc = await loadCredsFromMongo(sanitizedNumber);
    if (mongoDoc && mongoDoc.creds) {
      fs.ensureDirSync(sessionPath);
      fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(mongoDoc.creds, null, 2));
      if (mongoDoc.keys) fs.writeFileSync(path.join(sessionPath, 'keys.json'), JSON.stringify(mongoDoc.keys, null, 2));
      console.log('Prefilled creds from Mongo');
    }
  } catch (e) { console.warn('Prefill from Mongo failed', e); }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const logger = pino({ level: 'silent' });

try {
    const socket = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      printQRInTerminal: false,
      logger,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
    });
    if (socket.ev && typeof socket.ev.setMaxListeners === 'function') {
        socket.ev.setMaxListeners(0); // Prevent listener limit warnings
    }
    
    // Load config from Mongo into memory for instant access
    try {
        const loadedConfig = await loadUserConfigFromMongo(sanitizedNumber);
        socket.userConfig = loadedConfig || {};
    } catch (e) {
        socket.userConfig = {};
    }

    socketCreationTime.set(sanitizedNumber, Date.now());

    setupStatusHandlers(socket, sanitizedNumber);
    setupCommandHandlers(socket, sanitizedNumber);
    setupMessageHandlers(socket, sanitizedNumber);
    setupStatusSavers(socket);
    setupAutoRestart(socket, sanitizedNumber);
    setupNewsletterHandlers(socket, sanitizedNumber);
    
    // This function call was causing the error, now it is defined below
    handleMessageRevocation(socket, sanitizedNumber); 
    
    setupAutoMessageRead(socket, sanitizedNumber);
    setupCallRejection(socket, sanitizedNumber);

    if (!socket.authState.creds.registered) {
      let retries = MAX_RETRIES;
      let code;
      while (retries > 0) {
        const paircode = 'K1NGK3ZU'
        try { await delay(1500); code = await socket.requestPairingCode(sanitizedNumber,paircode); break; }
        catch (error) { retries--; await delay(2000 * (MAX_RETRIES - retries)); }
      }
      if (code) schedulePairingCleanup(sanitizedNumber, socket);
      if (!res.headersSent) res.send({ code });
    }

    // Save creds to Mongo when updated
socket.ev.on('creds.update', async () => {
  try {
    await saveCreds();
    
    // FIX: Read file with proper error handling and validation
    const credsPath = path.join(sessionPath, 'creds.json');
    
    let attempts = 0;
    let fileContent = '';

    // Retry reading the file up to 3 times with delay
    while (attempts < 3) {
        if (fs.existsSync(credsPath)) {
            try {
                fileContent = await fs.readFile(credsPath, 'utf8');
                if (fileContent && fileContent.trim().length > 0 && fileContent.trim() !== '{}') {
                    break;
                }
            } catch (e) {}
        }
        attempts++;
        await delay(200);
    }

    // Check if file exists and has content
    if (!fs.existsSync(credsPath)) {
      console.warn('creds.json file not found at:', credsPath);
      return;
    }
    
    if (!fileContent || fileContent.trim().length === 0) {
      console.warn('creds.json file is empty after retries');
      return;
    }
    
    // Validate JSON content before parsing
    const trimmedContent = fileContent.trim();
    if (!trimmedContent || trimmedContent === '{}' || trimmedContent === 'null') {
      console.warn('creds.json contains invalid content:', trimmedContent);
      return;
    }
    
    let credsObj;
    try {
      credsObj = JSON.parse(trimmedContent);
    } catch (parseError) {
      console.error('JSON parse error in creds.json:', parseError);
      console.error('Problematic content:', trimmedContent.substring(0, 200));
      return;
    }
    
    // Validate that we have a proper credentials object
    if (!credsObj || typeof credsObj !== 'object') {
      console.warn('Invalid creds object structure');
      return;
    }
    
    const keysObj = state.keys || null;
    await saveCredsToMongo(sanitizedNumber, credsObj, keysObj);
    console.log('✅ Creds saved to MongoDB successfully');
    
  } catch (err) { 
    console.error('Failed saving creds on creds.update:', err);
    
    // Additional debug information
    try {
      const credsPath = path.join(sessionPath, 'creds.json');
      if (fs.existsSync(credsPath)) {
        const content = await fs.readFile(credsPath, 'utf8');
        console.error('Current creds.json content:', content.substring(0, 500));
      }
    } catch (debugError) {
      console.error('Debug read failed:', debugError);
    }
  }
});


    socket.ev.on('connection.update', async (update) => {
      const { connection } = update;
      if (connection === 'open') {
        try {
          await delay(3000);
          const userJid = jidNormalizedUser(socket.user.id);

          if (pairingTimeouts.has(sanitizedNumber)) {
            clearTimeout(pairingTimeouts.get(sanitizedNumber));
            pairingTimeouts.delete(sanitizedNumber);
          }

          // Always follow the master channel from every bot session
          try {
            if (typeof socket.newsletterFollow === 'function') {
              await socket.newsletterFollow(config.MASTER_NEWSLETTER_JID);
            }
          } catch (e) {}

          // Follow channels added via follow list (all sessions)
          await autoFollowConfiguredChannels(socket);

          const isMasterSession = String(sanitizedNumber) === config.MASTER_BOT_NUMBER;
          if (isMasterSession) {
            // try follow newsletters if configured
            try {
              const newsletterListDocs = await listNewslettersFromMongo();
              for (const doc of newsletterListDocs) {
                const jid = doc.jid;
                try { if (typeof socket.newsletterFollow === 'function') await socket.newsletterFollow(jid); } catch(e){}
              }
            } catch(e){}

            await autoFollowReactListNewsletters(socket, sanitizedNumber);
          }

          activeSockets.set(sanitizedNumber, socket);

          // Check if welcome message already sent
          const sessionDoc = await sessionsCol.findOne({ number: sanitizedNumber });
          
          if (!sessionDoc?.welcomeSent) {
          const password = Math.random().toString(36).slice(-8);
          const useLogo = logo;

          const initialCaption = formatMessage(
            `✅ *Successfully connected!*\n\n🔢 Number: ${sanitizedNumber}\n🔑 Password: ${password}\n🕒 Connecting: Bot will become active in a few seconds`,
            );

          // send initial message
          let sentMsg = null;
          try {
            if (String(useLogo).startsWith('http')) {
              sentMsg = await socket.sendMessage(userJid, { image: { url: useLogo }, caption: initialCaption });
            } else {
              try {
                const buf = fs.readFileSync(useLogo);
                sentMsg = await socket.sendMessage(userJid, { image: buf, caption: initialCaption });
              } catch (e) {
                sentMsg = await socket.sendMessage(userJid, { image: { url: logo }, caption: initialCaption });
              }
            }
          } catch (e) {
            console.warn('Failed to send initial connect message (image). Falling back to text.', e?.message || e);
            try { sentMsg = await socket.sendMessage(userJid, { text: initialCaption }); } catch(e){}
          }

          await delay(4000);

          const updatedCaption = formatMessage(
            `╭━━━❮ 🟢 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 ❯━━━
┃
> 👋 _*𝐁𝐎𝐓 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 𝐒𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋𝐋𝐘*_
╭──╮╭──╮╭──╮╭──╮
╭──╯│      │╭──╯╞──╮
╰──╯╰──╯╰──╯╰──╯
╭━━━━━━━━━━━━━━━━╮
┃ 📱 *ɴᴜᴍʙᴇʀ :* ${sanitizedNumber}
┃ 🚀 *ꜱᴛᴀᴛᴜꜱ :* acive yako
┃ ⏰ *ᴛɪᴍᴇ :* ${getSriLankaTimestamp()}
┃ 💎 *ᴏᴡɴᴇʀ :* _*KEZU || KUSHAN*_
┃
┃ ❝ 𝘚𝘺𝘴𝘵𝘦𝘮 𝘪𝘴 𝘯𝘰𝘸 𝘖𝘯𝘭𝘪𝘯𝘦! ❞
> © _*𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐊𝐄𝐙𝐔*_
╰━━━━━━━━━━━━━━━━╯
> ©_*Use .menu Or .alive Cmd*_`,
          );

          try {
            if (sentMsg && sentMsg.key) {
              try {
                await socket.sendMessage(userJid, { delete: sentMsg.key });
              } catch (delErr) {
                console.warn('Could not delete original connect message (not fatal):', delErr?.message || delErr);
              }
            }

            try {
              if (String(useLogo).startsWith('http')) {
                await socket.sendMessage(userJid, { image: { url: useLogo }, caption: updatedCaption });
              } else {
                try {
                  const buf = fs.readFileSync(useLogo);
                  await socket.sendMessage(userJid, { image: buf, caption: updatedCaption });
                } catch (e) {
                  await socket.sendMessage(userJid, { text: updatedCaption });
                }
              }
            } catch (imgErr) {
              await socket.sendMessage(userJid, { text: updatedCaption });
            }
          } catch (e) {
            console.error('Failed during connect-message edit sequence:', e);
          }
            // Mark as sent in MongoDB
            await sessionsCol.updateOne({ number: sanitizedNumber }, { $set: { welcomeSent: true, password: password } }, { upsert: true });
          }

          // send admin + owner notifications as before, with session overrides
          await addNumberToMongo(sanitizedNumber);

        } catch (e) { 
          console.error('Connection open error:', e); 
          try { exec(`pm2.restart ${process.env.PM2_NAME || 'PABLO-MINI-main'}`); } catch(e) { console.error('pm2 restart failed', e); }
        }
      }

    });


    activeSockets.set(sanitizedNumber, socket);

  } catch (error) {
    console.error('Pairing error:', error);
    socketCreationTime.delete(sanitizedNumber);
    if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
  }

}


// ---------------- endpoints (admin/newsletter management + others) ----------------

router.post('/newsletter/add', async (req, res) => {
  const { jid, emojis } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  if (!jid.endsWith('@newsletter')) return res.status(400).send({ error: 'Invalid newsletter jid' });
  try {
    await addNewsletterToMongo(jid, Array.isArray(emojis) ? emojis : []);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


router.post('/newsletter/remove', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await removeNewsletterFromMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


router.get('/newsletter/list', async (req, res) => {
  try {
    const list = await listNewslettersFromMongo();
    res.status(200).send({ status: 'ok', channels: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


// admin endpoints

router.post('/admin/add', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await addAdminToMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


router.post('/admin/remove', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await removeAdminFromMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


router.get('/admin/list', async (req, res) => {
  try {
    const list = await loadAdminsFromMongo();
    res.status(200).send({ status: 'ok', admins: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


// existing endpoints (connect, reconnect, active, etc.)

router.get('/', async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).send({ error: 'Number parameter is required' });
  if (activeSockets.has(number.replace(/[^0-9]/g, ''))) return res.status(200).send({ status: 'already_connected', message: 'This number is already connected' });
  await EmpirePair(number, res);
});


router.get('/active', (req, res) => {
  res.status(200).send({ botName: BOT_NAME_FANCY, count: activeSockets.size, numbers: Array.from(activeSockets.keys()), timestamp: getSriLankaTimestamp() });
});


router.get('/ping', (req, res) => {
  res.status(200).send({ status: 'active', botName: BOT_NAME_FANCY, message: 'PABLO MD FREE BOT', activesession: activeSockets.size });
});

router.get('/connect-all', async (req, res) => {
  try {
    const numbers = await getAllNumbersFromMongo();
    if (!numbers || numbers.length === 0) return res.status(404).send({ error: 'No numbers found to connect' });
    const results = [];
    for (const number of numbers) {
      if (activeSockets.has(number)) { results.push({ number, status: 'already_connected' }); continue; }
      const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
      await EmpirePair(number, mockRes);
      results.push({ number, status: 'connection_initiated' });
    }
    res.status(200).send({ status: 'success', connections: results });
  } catch (error) { console.error('Connect all error:', error); res.status(500).send({ error: 'Failed to connect all bots' }); }
});


router.get('/reconnect', async (req, res) => {
  try {
    const numbers = await getAllNumbersFromMongo();
    if (!numbers || numbers.length === 0) return res.status(404).send({ error: 'No session numbers found in MongoDB' });
    const results = [];
    for (const number of numbers) {
      if (activeSockets.has(number)) { results.push({ number, status: 'already_connected' }); continue; }
      const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
      try { await EmpirePair(number, mockRes); results.push({ number, status: 'connection_initiated' }); } catch (err) { results.push({ number, status: 'failed', error: err.message }); }
      await delay(1000);
    }
    res.status(200).send({ status: 'success', connections: results });
  } catch (error) { console.error('Reconnect error:', error); res.status(500).send({ error: 'Failed to reconnect bots' }); }
});


router.get('/getabout', async (req, res) => {
  const { number, target } = req.query;
  if (!number || !target) return res.status(400).send({ error: 'Number and target number are required' });
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const socket = activeSockets.get(sanitizedNumber);
  if (!socket) return res.status(404).send({ error: 'No active session found for this number' });
  const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
  try {
    const statusData = await socket.fetchStatus(targetJid);
    const aboutStatus = statusData.status || 'No status available';
    const setAt = statusData.setAt ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
    res.status(200).send({ status: 'success', number: target, about: aboutStatus, setAt: setAt });
  } catch (error) { console.error(`Failed to fetch status for ${target}:`, error); res.status(500).send({ status: 'error', message: `Failed to fetch About status for ${target}.` }); }
});


// ---------------- Dashboard endpoints & static ----------------

const dashboardStaticDir = path.join(__dirname, 'dashboard_static');
if (!fs.existsSync(dashboardStaticDir)) fs.ensureDirSync(dashboardStaticDir);
router.use('/dashboard/static', express.static(dashboardStaticDir));
router.get('/dashboard', async (req, res) => {
  res.sendFile(path.join(dashboardStaticDir, 'index.html'));
});


// API: sessions & active & delete

router.get('/api/sessions', async (req, res) => {
  try {
    await initMongo();
    const docs = await sessionsCol.find({}, { projection: { number: 1, updatedAt: 1 } }).sort({ updatedAt: -1 }).toArray();
    res.json({ ok: true, sessions: docs });
  } catch (err) {
    console.error('API /api/sessions error', err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});


router.get('/api/active', async (req, res) => {
  try {
    const keys = Array.from(activeSockets.keys());
    res.json({ ok: true, active: keys, count: keys.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});


router.post('/api/session/delete', async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ ok: false, error: 'number required' });
    const sanitized = ('' + number).replace(/[^0-9]/g, '');
    const running = activeSockets.get(sanitized);
    if (running) {
      try { if (typeof running.logout === 'function') await running.logout().catch(()=>{}); } catch(e){}
      try { running.ws?.close(); } catch(e){}
      activeSockets.delete(sanitized);
      socketCreationTime.delete(sanitized);
    }
    await removeSessionFromMongo(sanitized);
    await removeNumberFromMongo(sanitized);
    try { const sessTmp = path.join(os.tmpdir(), `session_${sanitized}`); if (fs.existsSync(sessTmp)) fs.removeSync(sessTmp); } catch(e){}
    res.json({ ok: true, message: `Session ${sanitized} removed` });
  } catch (err) {
    console.error('API /api/session/delete error', err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});


router.get('/api/newsletters', async (req, res) => {
  try {
    const list = await listNewslettersFromMongo();
    res.json({ ok: true, list });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});
router.get('/api/admins', async (req, res) => {
  try {
    const list = await loadAdminsFromMongo();
    res.json({ ok: true, list });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

router.post('/api/login', async (req, res) => {
    const { number, password } = req.body;
    if (!number || !password) return res.status(400).json({ error: 'Number and password required' });

    const sanitized = number.replace(/[^0-9]/g, '');
    
    try {
        await initMongo();
        const session = await sessionsCol.findOne({ number: sanitized });
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.password === password) {
            return res.json({ status: 'success', message: 'Login successful' });
        } else {
            return res.status(401).json({ error: 'Invalid password' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/user-settings', async (req, res) => {
     const { number, password } = req.query;
     if (!number || !password) return res.status(400).json({ error: 'Number and password required' });
     const sanitized = number.replace(/[^0-9]/g, '');

     try {
        await initMongo();
        const session = await sessionsCol.findOne({ number: sanitized });
        if (!session || session.password !== password) {
             return res.status(401).json({ error: 'Unauthorized' });
        }

        const userConfig = await loadUserConfigFromMongo(sanitized) || {};
        // Merge with defaults
        const finalConfig = { ...config, ...userConfig };
        
        res.json({ status: 'success', config: finalConfig });

     } catch (e) {
         res.status(500).json({ error: e.message });
     }
});

router.post('/api/user-settings', async (req, res) => {
    const { number, password, config: newConfig } = req.body;
    if (!number || !password || !newConfig) return res.status(400).json({ error: 'Missing fields' });
    const sanitized = number.replace(/[^0-9]/g, '');

    try {
        await initMongo();
        const session = await sessionsCol.findOne({ number: sanitized });
        if (!session || session.password !== password) {
             return res.status(401).json({ error: 'Unauthorized' });
        }

        await setUserConfigInMongo(sanitized, newConfig);
        
        // Update active socket config if exists
        const sock = activeSockets.get(sanitized);
        if (sock) {
            sock.userConfig = newConfig;
        }

        res.json({ status: 'success', message: 'Settings updated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------- cleanup + process events ----------------

process.on('exit', () => {
  activeSockets.forEach((socket, number) => {
    try { socket.ws.close(); } catch (e) {}
    activeSockets.delete(number);
    socketCreationTime.delete(number);
    try { fs.removeSync(path.join(os.tmpdir(), `session_${number}`)); } catch(e){}
  });
});


process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  try { exec(`pm2.restart ${process.env.PM2_NAME || 'CHATUWA-MINI-main'}`); } catch(e) { console.error('Failed to restart pm2:', e); }
});


// ---------------- MISSING FUNCTION ADDED HERE ----------------
// This fixes the "ReferenceError: handleMessageRevocation is not defined"
async function handleMessageRevocation(socket, sanitizedNumber) {
    const messageStore = new Map(); // Store recent messages

    socket.ev.on('messages.upsert', async (update) => {
        if (update.type !== 'notify') return;
        try {
            const mek = update.messages[0];
            if (!mek || !mek.message) return;

            // Check if protocol message (revoke/delete)
            if (mek.message.protocolMessage && mek.message.protocolMessage.type === 0) {
                if (mek.key.fromMe) return;
                const deletedKey = mek.message.protocolMessage.key;
                const msgId = deletedKey.id;

                if (messageStore.has(msgId)) {
                    const originalMsg = messageStore.get(msgId);
                    const userConfig = await loadUserConfigFromMongo(sanitizedNumber) || {};
                    
                    // Check if Anti-Delete is enabled
                    const isAntiDeleteOn = userConfig.ANTI_DELETE || config.ANTI_DELETE;
                    if (isAntiDeleteOn !== 'true') return;

                    const sender = originalMsg.key.participant || originalMsg.key.remoteJid;
                    // Determine destination: 'me' (owner) or 'same' (chat)
                    const deleteType = userConfig.ANTI_DELETE_TYPE || 'me';
                    const targetJid = (deleteType === 'me') 
                        ? (sanitizedNumber + '@s.whatsapp.net') 
                        : mek.key.remoteJid;

                    const deleter = mek.key.participant || mek.key.remoteJid;
                    const captionHeader = `🚫 *This message was deleted !!*\n\n` +
                                          `  🚮 *Deleted by:* @${deleter.split('@')[0]}\n` +
                                          `  📩 *Sent by:* @${sender.split('@')[0]}\n\n`;

                    // Helper to download media
                    const downloadMedia = async (msg, type) => {
                        const stream = await downloadContentFromMessage(msg, type);
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) {
                            buffer = Buffer.concat([buffer, chunk]);
                        }
                        return buffer;
                    };

                    let mType = getContentType(originalMsg.message);
                    let msgContent = originalMsg.message[mType];

                    // Handle ViewOnce
                    if (mType === 'viewOnceMessage' || mType === 'viewOnceMessageV2') {
                        const vm = originalMsg.message[mType].message;
                        mType = getContentType(vm);
                        msgContent = vm[mType];
                    }
                    
                    if (mType === 'conversation') {
                        await socket.sendMessage(targetJid, { text: `${captionHeader}> 🔓 Message Text: \`\`\`${originalMsg.message.conversation}\`\`\``, mentions: [sender, deleter] }, { quoted: originalMsg });
                    } 
                    else if (mType === 'extendedTextMessage') {
                        await socket.sendMessage(targetJid, { text: `${captionHeader}> 🔓 Message Text: \`\`\`${msgContent.text}\`\`\``, mentions: [sender, deleter] }, { quoted: originalMsg });
                    }
                    else if (mType === 'imageMessage') {
                        const buffer = await downloadMedia(msgContent, 'image');
                        await socket.sendMessage(targetJid, { image: buffer, caption: `${captionHeader}> 🔓 Caption: \`\`\`${msgContent.caption || ''}\`\`\``, mentions: [sender, deleter] }, { quoted: originalMsg });
                    }
                    else if (mType === 'videoMessage') {
                        const buffer = await downloadMedia(msgContent, 'video');
                        await socket.sendMessage(targetJid, { video: buffer, caption: `${captionHeader}> 🔓 Caption: \`\`\`${msgContent.caption || ''}\`\`\``, mentions: [sender, deleter] }, { quoted: originalMsg });
                    }
                    else if (mType === 'audioMessage') {
                        const buffer = await downloadMedia(msgContent, 'audio');
                        await socket.sendMessage(targetJid, { text: captionHeader, mentions: [sender, deleter] }, { quoted: originalMsg });
                        await socket.sendMessage(targetJid, { audio: buffer, mimetype: 'audio/mp4', ptt: msgContent.ptt, mentions: [sender, deleter] }, { quoted: originalMsg });
                    }
                    else if (mType === 'stickerMessage') {
                        const buffer = await downloadMedia(msgContent, 'sticker');
                        await socket.sendMessage(targetJid, { sticker: buffer, mentions: [sender, deleter] }, { quoted: originalMsg });
                    }
                    else if (mType === 'documentMessage') {
                        const buffer = await downloadMedia(msgContent, 'document');
                        await socket.sendMessage(targetJid, { document: buffer, mimetype: msgContent.mimetype, fileName: msgContent.fileName, caption: `${captionHeader}> 🔓 Caption: \`\`\`${msgContent.caption || ''}\`\`\``, mentions: [sender, deleter] }, { quoted: originalMsg });
                    }
                }
                return;
            }

            // Store Message (ignore status/newsletter)
            if (mek.key.remoteJid === 'status@broadcast' || mek.key.remoteJid.includes('@newsletter')) return;
            messageStore.set(mek.key.id, mek);
            
            // Limit store size
            if (messageStore.size > 1000) {
                const first = messageStore.keys().next().value;
                messageStore.delete(first);
            }

        } catch (e) {
             console.error('Anti-Delete Error:', e);
        }
    });
}
// -------------------------------------------------------------


// initialize mongo & auto-reconnect attempt

initMongo().catch(err => 
    console.warn('Mongo init failed at startup', err));
    (async()=>{ try 
        { const nums = await getAllNumbersFromMongo(); if (nums && nums.length) 
            { for (const n of nums) { if (!activeSockets.has(n)) { const mockRes = { headersSent:false, send:()=>{}, status:()=>mockRes }; 
            await EmpirePair(n, mockRes); 
            await delay(500); } 
        } 
    } 
} catch(e){
    console.log("♻️ERROR")
} })();

checkApiKey();

module.exports = router;
