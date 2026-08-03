const express = require('express');
const path = require('path');
const config = require('../config/config');
const logger = require('../lib/logger');
const { getAllCommands } = require('../lib/commandHandler');

function createServer(botState) {
  // botState = { sock, connected, pairingCode, qr, startedAt }
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
  app.get('/pair', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'pair.html')));
  app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'docs.html')));
  app.get('/about', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'about.html')));
  app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'contact.html')));

  app.get('/api/status', (req, res) => {
    res.json({
      botName: config.BOT_NAME,
      connected: !!botState.connected,
      uptimeMs: Date.now() - botState.startedAt,
      pairingMethod: config.PAIRING_METHOD,
    });
  });

  app.get('/api/commands', (req, res) => {
    const cmds = getAllCommands().map((c) => ({
      name: c.name,
      category: c.category,
      description: c.description,
      ownerOnly: !!c.ownerOnly,
    }));
    res.json(cmds);
  });

  // Request a fresh pairing code for a phone number
  app.post('/api/pair', async (req, res) => {
    try {
      const { number } = req.body;
      if (!number) return res.status(400).json({ error: 'Phone number required (with country code, no +).' });
      if (!botState.requestPairingCode) return res.status(503).json({ error: 'Bot socket not ready yet, try again shortly.' });

      const code = await botState.requestPairingCode(number);
      res.json({ code });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Current QR (base64 data URL) if using QR pairing mode
  app.get('/api/qr', (req, res) => {
    if (!botState.qr) return res.status(404).json({ error: 'No QR available right now.' });
    res.json({ qr: botState.qr });
  });

  const server = app.listen(config.PORT, () => {
    logger.success(`Dashboard & pairing site running -> http://localhost:${config.PORT}`);
  });

  return server;
}

module.exports = { createServer };
