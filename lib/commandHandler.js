const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

const commands = new Map();
const aliases = new Map();

function loadCommands() {
  commands.clear();
  aliases.clear();

  const commandsDir = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    try {
      delete require.cache[require.resolve(path.join(commandsDir, file))];
      const mod = require(path.join(commandsDir, file));
      const list = Array.isArray(mod) ? mod : [mod];

      for (const cmd of list) {
        if (!cmd || !cmd.name) continue;
        commands.set(cmd.name, cmd);
        (cmd.aliases || []).forEach((a) => aliases.set(a, cmd.name));
      }
    } catch (err) {
      logger.error(`Failed to load command file "${file}": ${err.message}`);
    }
  }

  logger.success(`Loaded ${commands.size} commands from ${files.length} files`);
  return commands;
}

function getCommand(name) {
  const resolvedName = aliases.get(name) || name;
  return commands.get(resolvedName);
}

function getAllCommands() {
  return [...commands.values()];
}

module.exports = { loadCommands, getCommand, getAllCommands };
