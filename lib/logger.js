const chalk = require('chalk');
const moment = require('moment');

function timestamp() {
  return chalk.gray(`[${moment().format('YYYY-MM-DD HH:mm:ss')}]`);
}

module.exports = {
  info: (msg) => console.log(`${timestamp()} ${chalk.cyanBright('ℹ INFO ')} ${msg}`),
  success: (msg) => console.log(`${timestamp()} ${chalk.greenBright('✔ OK   ')} ${msg}`),
  warn: (msg) => console.log(`${timestamp()} ${chalk.yellowBright('⚠ WARN ')} ${msg}`),
  error: (msg) => console.log(`${timestamp()} ${chalk.redBright('✖ ERROR')} ${msg}`),
  bot: (msg) => console.log(`${timestamp()} ${chalk.magentaBright('🤖 BOT  ')} ${msg}`),
  banner: (botName) => {
    console.log(chalk.hex('#00ffcc')(`
╔═══════════════════════════════════════════╗
║           ${botName.padEnd(33)} ║
║        WhatsApp Multi Device Bot           ║
║          Powered by Baileys + MongoDB      ║
╚═══════════════════════════════════════════╝
`));
  },
};
