/**
 * ==========================================================
 *  THE GHOST MINI OFC
 *  Ultra fast modern multi-device WhatsApp bot
 *  © POWERD BY SASA DEV OFC </>
 * ==========================================================
 */
process.env.TZ = process.env.TZ || 'Asia/Colombo';

const path = require('path');
const config = require('./config');
const db = require('./lib/database');
const diag = require('./lib/diag');
const { loadPlugins, stats } = require('./lib/command');
const { restoreSessions } = require('./lib/connection');
const startServer = require('./server');

const banner = `
╔══════════════════════════════════════════════╗
║            THE GHOST MINI OFC                ║
║      Ultra Fast Modern WhatsApp Bot          ║
║      © POWERD BY SASA DEV OFC </>            ║
╚══════════════════════════════════════════════╝`;

async function boot() {
  console.log(banner);
  console.log(`[BOOT] Node ${process.version} | TZ ${process.env.TZ}`);

  /* Keep an observable process heartbeat. This prevents accidental process
     exits and makes Heroku logs show that the app is alive every 3 minutes.
     Hosting-plan sleep rules are external and cannot be disabled by Node. */
  setInterval(() => {
    console.log(`[KEEPALIVE] alive | uptime ${Math.floor(process.uptime())}s | sessions ${require('./lib/connection').sessions.size}`);
  }, 180000);

  /* 1. Plugins (fast, synchronous) */
  const loaded = loadPlugins(path.join(__dirname, 'plugins'));
  const s = stats();
  console.log(`[BOOT] Loaded ${loaded} plugin file(s) -> ${s.total} commands in ${s.categories} categories`);

  /* 2. Web server first, so the pairing site is instantly reachable */
  startServer();

  /* 3. Database (non blocking - the site stays up even if Atlas is slow) */
  db.connectDB()
    .then(() => {
      console.log('[BOOT] Database ready. Restoring saved sessions...');
      setTimeout(() => restoreSessions().catch(e => console.error('[BOOT]', e.message)), 1500);
    })
    .catch((e) => {
      const d = db.getLastError && db.getLastError();
      diag.recordError('database', e, d ? d.code : '');
      console.error('[BOOT] MongoDB database unavailable:', d ? d.human : e.message);
      if (d) d.fix.forEach((f, i) => console.error('        ' + (i + 1) + '. ' + f));
    });

  console.log('[BOOT] THE GHOST MINI OFC is ready.');
}

/* ---- crash guards: never let the bot die ---- */
process.on('uncaughtException', (err) => {
  const msg = String(err?.message || err);
  if (/Socket connection timeout|rate-overlimit|Connection Closed|Timed Out|conflict|EPIPE|ECONNRESET/i.test(msg)) return;
  diag.recordError('uncaughtException', err);
  console.error('[UNCAUGHT]', msg);
});

process.on('unhandledRejection', (err) => {
  const msg = String(err?.message || err);
  if (/Socket connection timeout|rate-overlimit|Connection Closed|Timed Out|conflict|EPIPE|ECONNRESET/i.test(msg)) return;
  diag.recordError('unhandledRejection', err);
  console.error('[UNHANDLED]', msg);
});

/* flush pending database writes before the dyno dies */
let exiting = false;
async function gracefulExit(sig) {
  if (exiting) return;
  exiting = true;
  console.log(`[EXIT] ${sig} received - saving database...`);
  try { await db.shutdown(); } catch (_) {}
  process.exit(0);
}
process.on('SIGTERM', () => gracefulExit('SIGTERM'));
process.on('SIGINT', () => gracefulExit('SIGINT'));

boot();
