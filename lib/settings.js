const { getDB } = require('../database/db');

async function getSettings() {
  const db = getDB();
  const doc = await db.collection('bot_settings').findOne({ _id: 'settings' });
  return doc || {};
}

async function toggleSetting(key) {
  const db = getDB();
  const current = await getSettings();
  const newValue = !current[key];
  await db.collection('bot_settings').updateOne(
    { _id: 'settings' },
    { $set: { [key]: newValue } },
    { upsert: true }
  );
  return newValue;
}

module.exports = { getSettings, toggleSetting };
