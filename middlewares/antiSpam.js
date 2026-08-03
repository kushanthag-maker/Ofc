const NodeCache = require('node-cache');

// Tracks how many commands a jid has fired in the last WINDOW_SECONDS
const cache = new NodeCache({ stdTTL: 10, checkperiod: 5 });

const MAX_COMMANDS = 5; // per window
const WINDOW_SECONDS = 10;
const cooldownCache = new NodeCache({ stdTTL: 30 });

/**
 * Returns { allowed: boolean, warn: boolean }
 * - allowed=false, warn=true  -> first time hitting the limit, send one warning
 * - allowed=false, warn=false -> already warned & still on cooldown, silently ignore
 */
function checkSpam(jid) {
  if (cooldownCache.get(jid)) {
    return { allowed: false, warn: false };
  }

  const count = (cache.get(jid) || 0) + 1;
  cache.set(jid, count, WINDOW_SECONDS);

  if (count > MAX_COMMANDS) {
    cooldownCache.set(jid, true, 30);
    return { allowed: false, warn: true };
  }

  return { allowed: true, warn: false };
}

module.exports = { checkSpam };
