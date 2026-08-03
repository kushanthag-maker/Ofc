const jokes = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'Why did the developer go broke? Because he used up all his cache.',
  '99 little bugs in the code, 99 little bugs. Take one down, patch it around, 127 little bugs in the code.',
];
const facts = [
  'Honey never spoils — archaeologists have found 3000-year-old honey that is still edible.',
  'A day on Venus is longer than a year on Venus.',
  'Octopuses have three hearts.',
];
const truths = [
  "What's the most embarrassing thing you've done in front of a crush?",
  'What is one secret you have never told anyone?',
  "What's the biggest lie you've ever told your parents?",
];
const dares = [
  'Send a voice note singing your favorite song.',
  'Text the last person you called and say "I miss you".',
  'Change your profile picture to whatever the group picks for the next hour.',
];
const quotes = [
  'The only way to do great work is to love what you do. — Steve Jobs',
  "Code is like humor. When you have to explain it, it's bad. — Cory House",
  'First, solve the problem. Then, write the code. — John Johnson',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = [
  {
    name: 'joke',
    category: 'fun',
    description: 'Get a random joke',
    execute: async (sock, m, args, ctx) => ctx.reply(`😂 ${pick(jokes)}`),
  },
  {
    name: 'fact',
    category: 'fun',
    description: 'Get a random fact',
    execute: async (sock, m, args, ctx) => ctx.reply(`💡 ${pick(facts)}`),
  },
  {
    name: 'truth',
    category: 'fun',
    description: 'Get a truth question for Truth or Dare',
    execute: async (sock, m, args, ctx) => ctx.reply(`🤔 *Truth:* ${pick(truths)}`),
  },
  {
    name: 'dare',
    category: 'fun',
    description: 'Get a dare for Truth or Dare',
    execute: async (sock, m, args, ctx) => ctx.reply(`🔥 *Dare:* ${pick(dares)}`),
  },
  {
    name: 'quote',
    category: 'fun',
    description: 'Get an inspirational quote',
    execute: async (sock, m, args, ctx) => ctx.reply(`📜 ${pick(quotes)}`),
  },
  {
    name: 'ship',
    category: 'fun',
    description: 'Ship two people together. Usage: .ship @user1 @user2',
    execute: async (sock, m, args, ctx) => {
      const percent = Math.floor(Math.random() * 101);
      const bar = '💖'.repeat(Math.round(percent / 10)).padEnd(10, '🤍');
      await ctx.reply(`💘 *Ship Result:* ${percent}%\n${bar}`);
    },
  },
  {
    name: 'hack',
    category: 'fun',
    description: 'Fake "hacking" animation for laughs (harmless joke command)',
    execute: async (sock, m, args, ctx) => {
      const target = args.join(' ') || 'the target';
      await ctx.reply(
        `💻 Hacking ${target}...\n[■■■■■■■■■■] 100%\n😂 Just kidding — this is a joke command, no real hacking here!`
      );
    },
  },
  {
    name: 'flip',
    category: 'fun',
    description: 'Flip a coin',
    execute: async (sock, m, args, ctx) => ctx.reply(`🪙 ${Math.random() < 0.5 ? 'Heads' : 'Tails'}!`),
  },
  {
    name: 'dice',
    category: 'fun',
    description: 'Roll a dice',
    execute: async (sock, m, args, ctx) => ctx.reply(`🎲 You rolled a *${Math.floor(Math.random() * 6) + 1}*`),
  },
];
