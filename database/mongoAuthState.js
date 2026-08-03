const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { getDB } = require('./db');
const config = require('../config/config');
const logger = require('../lib/logger');

/**
 * Baileys requires a stateful auth store (creds + signal keys).
 * Instead of writing these to /sessions on disk, we persist every
 * key/value into a single MongoDB collection so the bot is fully
 * stateless on the filesystem -> works on Heroku/Railway/Render dynos
 * that wipe disk on restart, and supports multi-device session backup.
 */
async function useMongoDBAuthState(sessionId = config.SESSION_ID) {
  const db = getDB();
  const collection = db.collection('auth_state');

  const docId = (key) => `${sessionId}:${key}`;

  const readData = async (key) => {
    const doc = await collection.findOne({ _id: docId(key) });
    if (!doc || !doc.value) return null;
    try {
      return JSON.parse(doc.value, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const writeData = async (key, value) => {
    const serialized = JSON.stringify(value, BufferJSON.replacer);
    await collection.updateOne(
      { _id: docId(key) },
      { $set: { value: serialized, updatedAt: new Date() } },
      { upsert: true }
    );
  };

  const removeData = async (key) => {
    await collection.deleteOne({ _id: docId(key) });
  };

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    },
    // Wipes this session completely (used by .shutdown / logout / relogin)
    clearSession: async () => {
      await collection.deleteMany({ _id: { $regex: `^${sessionId}:` } });
      logger.warn(`Session "${sessionId}" cleared from MongoDB`);
    },
  };
}

module.exports = { useMongoDBAuthState };
