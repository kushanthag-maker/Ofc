# 🤖 DCL MINI — Professional WhatsApp Multi Device Bot

Baileys-based, MongoDB-backed WhatsApp bot with a pairing website, modular commands, and 24/7-ready deployment configs.

## ⚠️ Before you do anything: rotate your MongoDB password

If you ever pasted a real `mongodb+srv://user:password@...` string into a chat, doc, or public repo,
**change that database user's password in MongoDB Atlas right now** (Database Access → Edit → New Password).
Never commit `.env` or hardcode credentials in source files — this project reads everything from `.env`.

## 📁 Folder Structure

```
dcl-mini/
├── commands/         # one file per category, exports an array of command objects
├── events/           # group-participants-update (welcome/goodbye), antilink/antibadword filters
├── database/         # MongoDB connection + custom Baileys auth state (session storage)
├── lib/              # logger, command loader, settings/group-settings helpers
├── config/           # loads & validates .env
├── middlewares/      # anti-spam rate limiter, block list
├── sessions/         # unused on disk — sessions live in MongoDB, kept for structure only
├── public/           # pairing website (HTML/CSS/JS)
├── website/           # express server for the dashboard + pairing API
├── index.js          # entry point — connects Baileys, loads commands, starts website
├── ecosystem.config.js  # PM2
├── Dockerfile / docker-compose.yml
├── Procfile / app.json # Heroku
└── .env.example
```

## 🚀 Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in `MONGODB_URI` (from MongoDB Atlas → Connect → Drivers), `OWNER_NUMBER`, etc.

3. **Run locally**
   ```bash
   npm start
   ```
   - If `PAIRING_METHOD=code`: the terminal will prompt for your number, or open the website's `/pair` page and enter it there.
   - If `PAIRING_METHOD=qr`: a QR prints in the terminal, and is also available at `/pair` on the website.

4. **Open the dashboard**: `http://localhost:3000`

## 💾 How MongoDB session storage works

`database/mongoAuthState.js` implements a custom Baileys `AuthenticationState` that reads/writes
every credential and signal key as a document in the `auth_state` MongoDB collection instead of
files on disk (`useMultiFileAuthState`'s usual behavior). This means:

- Restarting on Heroku/Railway (which wipe the filesystem) does **not** log the bot out.
- You can move the bot between servers without copying session files.
- Multiple bot instances could theoretically share the same DB via different `SESSION_ID` values.

## 🧩 Adding new commands

Each file in `commands/` exports an array of command objects:

```js
module.exports = [
  {
    name: 'example',
    category: 'utility',
    description: 'What this does',
    ownerOnly: false,       // optional
    aliases: ['ex'],        // optional
    execute: async (sock, msg, args, ctx) => {
      await ctx.reply('Hello!');
    },
  },
];
```

`ctx` gives you: `from`, `sender`, `isGroup`, `isOwner`, `isSenderAdmin`, `isBotAdmin`, `mentionedJid`,
`reply(text|content)`, and `downloadQuotedMedia()`.

## 🔌 Commands that need your own API keys

`.ai`, `.chat`, `.gpt`, `.translate`, `.image`, `.code`, `.explain` need `OPENAI_API_KEY`.
`.weather` needs `WEATHER_API_KEY` (OpenWeatherMap). `.news` needs `NEWS_API_KEY` (NewsAPI).
`.play`, `.video`, `.tiktok`, `.facebook`, `.instagram`, `.twitter`, `.spotify`, `.pinterest`, `.apk`
in `commands/download.js` are wired as clean integration points — plug in your preferred downloader
API/provider (these change often, so no specific provider is hardcoded). `.mediafire` works out of the box.

## 🚢 Deployment

**PM2 (VPS)**
```bash
npm i -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

**Docker**
```bash
docker compose up -d --build
```

**Heroku** — push with `app.json` present, set config vars, uses `Procfile` (worker dyno, not web,
since Baileys needs a persistent process — but the built-in Express server still serves the pairing site).

**Railway / Render** — set `MONGODB_URI` and other env vars in the dashboard, start command `node index.js`.

## 🛡️ Notes on the security features included

- **Anti-spam**: rate limiter in `middlewares/antiSpam.js` (5 commands / 10s per user, then cooldown).
- **Anti-crash**: `unhandledRejection`/`uncaughtException` handlers in `index.js` stop one bad command from killing the process.
- **Block list**: stored in MongoDB, checked before every command.
- **Anti-link / anti-badword**: per-group toggles in `commands/group.js`, enforced in `events/groupFilters.js`.

`isBotAdmin` detection in `index.js` is a simplified heuristic — for group-changing commands in
production, double check bot admin status against `metadata.participants` more strictly before relying on it at scale.

## 📜 License

MIT — build on top of this freely.
