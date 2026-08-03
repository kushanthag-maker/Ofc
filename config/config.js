require('dotenv').config();

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is missing in your .env file. Bot cannot start without it.');
  process.exit(1);
}

module.exports = {
  MONGODB_URI: process.env.MONGODB_URI,
  BOT_NAME: process.env.BOT_NAME || 'DCL MINI',
  OWNER_NAME: process.env.OWNER_NAME || 'Owner',
  OWNER_NUMBER: process.env.OWNER_NUMBER || '',
  PREFIX: process.env.PREFIX || '.',
  PAIRING_METHOD: (process.env.PAIRING_METHOD || 'code').toLowerCase(), // 'code' | 'qr'
  PORT: process.env.PORT || 3000,
  SESSION_ID: process.env.SESSION_ID || 'dcl-mini-session',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  WEATHER_API_KEY: process.env.WEATHER_API_KEY || '',
  NEWS_API_KEY: process.env.NEWS_API_KEY || '',
  ADMIN_PANEL_PASSWORD: process.env.ADMIN_PANEL_PASSWORD || 'changeme123',
};
