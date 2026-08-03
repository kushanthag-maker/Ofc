const { getDB } = require('../database/db');

async function getGroupSetting(gid, key) {
  const db = getDB();
  const doc = await db.collection('group_settings').findOne({ _id: gid });
  return doc?.[key];
}

async function setGroupSetting(gid, key, value) {
  const db = getDB();
  await db.collection('group_settings').updateOne(
    { _id: gid },
    { $set: { [key]: value } },
    { upsert: true }
  );
}

module.exports = { getGroupSetting, setGroupSetting };
