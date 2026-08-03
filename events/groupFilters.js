const { getGroupSetting } = require('../lib/groupSettings');

const LINK_REGEX = /(https?:\/\/|www\.|chat\.whatsapp\.com)/i;
const BAD_WORDS = ['badword1', 'badword2']; // extend this list as needed

/**
 * Returns true if the message was deleted/handled (caller should stop
 * further processing), false if the message should continue normally.
 */
async function applyGroupFilters(sock, ctx, text) {
  if (!ctx.isGroup || ctx.isSenderAdmin || ctx.isOwner) return false;

  const antilinkOn = await getGroupSetting(ctx.from, 'antilink');
  if (antilinkOn && LINK_REGEX.test(text)) {
    await sock.sendMessage(ctx.from, { delete: ctx.key });
    await sock.groupParticipantsUpdate(ctx.from, [ctx.sender], 'remove').catch(() => {});
    await sock.sendMessage(ctx.from, { text: `🔗 Link detected — @${ctx.sender.split('@')[0]} was removed.`, mentions: [ctx.sender] });
    return true;
  }

  const antibadwordOn = await getGroupSetting(ctx.from, 'antibadword');
  if (antibadwordOn && BAD_WORDS.some((w) => text.toLowerCase().includes(w))) {
    await sock.sendMessage(ctx.from, { delete: ctx.key });
    await sock.sendMessage(ctx.from, { text: `🤬 Message removed — please keep the group clean, @${ctx.sender.split('@')[0]}.`, mentions: [ctx.sender] });
    return true;
  }

  return false;
}

module.exports = { applyGroupFilters };
