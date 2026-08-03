/**
 * MongoDB data engine.
 * Keeps the existing data-layer API so plugins do not need rewriting.
 * All bot state is stored in one MongoDB collection; GitHub is not used.
 */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const KEYS = ['user','premium','banned','admin','creds','groups','settings','sessions'];
const defaults = { user:{}, premium:[], banned:[], admin:()=>config.OWNER_NUMBERS.slice(), creds:{}, groups:{}, settings:{}, sessions:{} };
const cache = new Map();
const dirty = new Set();
let client, collection, authCollection, ready = false, lastError = null, flushTimer;
const now = () => new Date().toISOString();
function defaultFor(key) { const v = defaults[key]; return typeof v === 'function' ? v() : JSON.parse(JSON.stringify(v)); }

async function init() {
  const uri = String(config.MONGODB_URI || '').trim();
  if (!uri) {
    lastError = { code:'MONGODB_NOT_CONFIGURED', human:'MONGODB_URI is not configured.', fix:['Set MONGODB_URI, MONGODB_USERNAME and MONGODB_PASSWORD as Heroku config vars.'] };
    throw new Error(lastError.code);
  }
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(config.MONGODB_DB || 'ghost-mini-ofc');
  collection = db.collection('bot_data');
  authCollection = db.collection('auth_data');
  const docs = await collection.find({}).toArray();
  for (const key of KEYS) {
    const doc = docs.find(x => x._id === key);
    cache.set(key, doc ? doc.value : defaultFor(key));
  }
  // Store each Baileys session separately so a large multi-session creds
  // object never hits MongoDB's 16 MB document limit.
  const authDocs = await authCollection.find({}).toArray();
  if (authDocs.length) cache.set('creds', Object.fromEntries(authDocs.map(x => [x._id, x.value])));
  else if (docs.some(x => x._id === 'creds' && x.value && Object.keys(x.value).length)) dirty.add('creds');
  // Optional one-time local bootstrap. It never overwrites existing Mongo data.
  if (!docs.length && config.MONGODB_IMPORT_LOCAL) {
    const dir = path.join(__dirname, '..', 'database');
    for (const key of KEYS) {
      try { const file = path.join(dir, `${key}.json`); if (fs.existsSync(file)) cache.set(key, JSON.parse(fs.readFileSync(file,'utf8'))); } catch (_) {}
      dirty.add(key);
    }
    await flush(true);
  }
  ready = true; lastError = null;
  console.log(`[MONGO] Connected -> ${config.MONGODB_DB || 'ghost-mini-ofc'}.bot_data`);
  flushTimer = setInterval(() => flush(false).catch(e => console.error('[MONGO] flush:', e.message)), config.MONGODB_FLUSH_MS || 5000);
  flushTimer.unref?.();
}
function get(key) { if (!cache.has(key)) cache.set(key, defaultFor(key)); return cache.get(key); }
function set(key, value, immediate = false) { cache.set(key, value); dirty.add(key); if (immediate) return flush(true); schedule(); return value; }
function update(key, mutator, immediate = false) { const value = get(key); const result = mutator(value); dirty.add(key); if (immediate) return flush(true); schedule(); return result; }
function schedule() { if (!flushTimer?._mongoDebounce) { const t=setTimeout(()=>flush(false), config.MONGODB_FLUSH_MS || 5000); t.unref?.(); t._mongoDebounce=true; } }
async function flush(force = false) {
  if (!collection || !dirty.size) return;
  const keys = [...dirty]; dirty.clear();
  try {
    await Promise.all(keys.filter(key => key !== 'creds').map(key =>
      collection.updateOne({_id:key}, {$set:{value:get(key), updatedAt:now()}}, {upsert:true})
    ));
    if (keys.includes('creds')) {
      const entries = Object.entries(get('creds') || {});
      if (entries.length) await authCollection.bulkWrite(entries.map(([id, value]) => ({
        replaceOne: { filter: {_id:id}, replacement: {_id:id, value, updatedAt:now()}, upsert:true }
      })));
      await authCollection.deleteMany(entries.length ? {_id: {$nin: entries.map(([id]) => id)}} : {});
    }
  }
  catch (e) { keys.forEach(k=>dirty.add(k)); lastError={code:'MONGODB_WRITE_FAILED',human:e.message,fix:['Check MongoDB network access and credentials.']}; if (force) throw e; }
}
async function shutdown() { await flush(true).catch(()=>{}); await client?.close().catch(()=>{}); ready=false; }
const isReady=()=>ready;
const getLastError=()=>lastError;
const getStats=()=>({ ready, dirty:dirty.size, cached:cache.size, provider:'mongodb', database:config.MONGODB_DB || 'ghost-mini-ofc' });
module.exports={ init,get,set,update,flush,shutdown,isReady,getLastError,getStats };
