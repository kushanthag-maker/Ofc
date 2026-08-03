const { MongoClient } = require('mongodb');
const config = require('../config/config');
const logger = require('../lib/logger');

let client;
let db;

async function connectDB() {
  if (db) return db;

  client = new MongoClient(config.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000,
  });

  await client.connect();
  db = client.db(); // uses DB name from the URI, falls back to 'test' if none given
  logger.success(`MongoDB connected -> database: ${db.databaseName}`);

  // Helpful indexes
  await db.collection('auth_state').createIndex({ _id: 1 });
  await db.collection('blocked_users').createIndex({ jid: 1 }, { unique: true });
  await db.collection('bot_stats').createIndex({ _id: 1 });

  return db;
}

function getDB() {
  if (!db) throw new Error('Database not connected yet. Call connectDB() first.');
  return db;
}

async function closeDB() {
  if (client) await client.close();
}

process.on('SIGINT', async () => {
  await closeDB();
  process.exit(0);
});

module.exports = { connectDB, getDB, closeDB };
