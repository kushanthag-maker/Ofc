const { getDB } = require('../database/db');

async function isBlocked(jid) {
  const db = getDB();
  const found = await db.collection('blocked_users').findOne({ jid });
  return !!found;
}

async function blockUser(jid) {
  const db = getDB();
  await db.collection('blocked_users').updateOne(
    { jid },
    { $set: { jid, blockedAt: new Date() } },
    { upsert: true }
  );
}

async function unblockUser(jid) {
  const db = getDB();
  await db.collection('blocked_users').deleteOne({ jid });
}

module.exports = { isBlocked, blockUser, unblockUser };
