const { getGroupSetting } = require('../lib/groupSettings');

async function handleGroupParticipantsUpdate(sock, update) {
  const { id: gid, participants, action } = update;

  try {
    if (action === 'add') {
      const welcomeOn = await getGroupSetting(gid, 'welcome');
      if (!welcomeOn) return;
      const metadata = await sock.groupMetadata(gid);
      for (const jid of participants) {
        await sock.sendMessage(gid, {
          text: `👋 Welcome @${jid.split('@')[0]} to *${metadata.subject}*!\nRead the group description & enjoy your stay 🎉`,
          mentions: [jid],
        });
      }
    }

    if (action === 'remove') {
      const goodbyeOn = await getGroupSetting(gid, 'goodbye');
      if (!goodbyeOn) return;
      for (const jid of participants) {
        await sock.sendMessage(gid, { text: `👋 @${jid.split('@')[0]} has left the group. Goodbye!`, mentions: [jid] });
      }
    }
  } catch {
    // silently ignore - non-critical feature
  }
}

module.exports = { handleGroupParticipantsUpdate };
