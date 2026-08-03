# THE GHOST MINI OFC

Ultra fast, modern, multi-device WhatsApp bot with **338 commands**, GitHub based storage and a glassmorphism web pairing dashboard.

**© 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝚂𝙰𝚂𝙰 𝙳𝙴𝚅 𝙾𝙵𝙲 </>**

| | |
|---|---|
| Owner | Sasa Dev |
| Owner numbers | 94767106413, 94771265279 |
| Support channel | https://whatsapp.com/channel/0029Vb86hKVJUM2SYD2qNw3K |
| Commands | 338 across 14 categories |
| Database | **GitHub repository** (`database/` folder, no MongoDB) |
| API | api.sasatech.online |
| Hosting | Heroku ready |

---

## 1. Deploy to Heroku

### Option A — CLI (recommended)

```bash
cd ghost-mini-ofc
git init && git add . && git commit -m "THE GHOST MINI OFC"

heroku create ghost-mini-ofc
heroku stack:set heroku-24

# ffmpeg is required for stickers, audio effects and video tools
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git

heroku config:set \
  GITHUB_TOKEN="ghp_your_token_with_repo_scope" \
  GITHUB_OWNER="darksasa1-eng" \
  GITHUB_REPO="ghost-mini-ofc" \
  OWNER_NUMBERS="94767106413,94771265279" \
  OWNER_NAME="Sasa Dev" \
  API_KEY="d1940d8dd12e82465afd61c8fdc7fbf0" \
  TZ="Asia/Colombo"

git push heroku master
heroku ps:scale web=1
heroku open
```

### Option B — GitHub button

Push this folder to a GitHub repo, then use **Deploy to Heroku**. `app.json` already declares every config var and both buildpacks.

> **Important:** `GITHUB_TOKEN` must have the **`repo`** scope. On first boot the bot creates the `database/` folder and all eight JSON files automatically.

---

## 2. Connecting a bot

1. Open your Heroku app URL — the pairing dashboard loads.
2. Click **Connect Bot**.
3. Choose **Pairing Code** (enter number with country code, no `+`) or **QR Code**.
4. In WhatsApp: **Settings → Linked Devices → Link a Device**.
   For a pairing code, tap **Link with phone number instead**.
5. Enter the 8-character code or scan the QR before the 40-second countdown ends.
6. The bot sends a confirmation card to your inbox and **auto-follows the support channel**.
7. Type `.menu`.

Sessions live in `database/creds.json` inside your GitHub repo, so the bot reconnects itself after every restart or dyno cycle.

---

## 3. Project structure

```
ghost-mini-ofc/
├── index.js              Entry point, crash guards, boot sequence
├── server.js             Express server, pairing REST API
├── config.js             All configuration and env toggles
├── public/index.html     Single-file website (UI, terms, privacy, FAQ, pairing)
├── lib/
│   ├── connection.js     Multi-session manager, pair code + QR, auto follow
│   ├── githubdb.js       GitHub storage engine (cache + batched commits)
│   ├── githubAuth.js     Baileys auth state stored in GitHub
│   ├── database.js       Data helpers + mongoose-compatible shims
│   ├── handler.js        Message router, permissions, anti-link, AFK
│   ├── serialize.js      Message normaliser with quoted/media helpers
│   ├── command.js        Command registry and plugin loader
│   └── utils.js          Footer, API client, formatters
└── plugins/              11 files, 337 commands
    ├── menu.js       19   download.js  24   movie.js    13
    ├── group.js      45   owner.js     30   converter.js 26
    ├── tools.js      40   fun.js       34   economy.js  17
    ├── ai.js         23   misc.js      23
    └── (settings 14 + logo 14 + search 13 + main 19 counted within)
```

---

## 4. Command categories

| Category | Count | Highlights |
|---|---|---|
| group | 45 | kick, promote, tagall, antilink, warn, welcome, poll, requests |
| tools | 40 | tts, translate, weather, calc, qr, wiki, ss, ipinfo, currency, crypto |
| fun | 34 | quote, joke, ship, 8ball, truth, dare, rps, meme, trivia, wallpaper |
| owner | 30 | broadcast, ban, premium, eval, shell, restart, sessions, dbstats |
| converter | 26 | sticker, toimg, tomp3, toptt, bass, nightcore, compress, trim |
| download | 24 | tiktok, song, youtube, facebook, instagram, mediafire, gdrive, mega |
| ai | 23 | ai, imagine, codeai, essay, summarize, describe, sinhala |
| misc | 23 | vv, save, report, terms, privacy, faq, apistatus |
| main | 19 | menu, alive, ping, owner, botinfo, stats, profile |
| economy | 17 | daily, work, rob, deposit, gamble, leaderboard, shop |
| settings | 14 | autoread, antidelete, anticall, alwaysonline, autofollow |
| logo | 14 | neonlogo, firelogo, goldlogo, glitchlogo, galaxylogo, attp, ttp |
| movie | 13 | sinhalasub, cinesubz, sublk, baiscope, moviedl, multisearch |
| search | 13 | google, github, npm, imdb, anime, manga, country, quran |

Every reply carries the footer automatically — it is injected centrally in `lib/handler.js`, so new plugins inherit it with no extra code.

---

## 5. GitHub database

All data lives in the repository, no external database needed. On first
boot the bot creates `database/` and these files automatically:

| File | Contents |
|---|---|
| `user.json` | every user, economy balance, bank, XP, level, AFK, warns |
| `premium.json` | premium user numbers |
| `banned.json` | banned user numbers |
| `admin.json` | bot admins (seeded with `OWNER_NUMBERS`) |
| `creds.json` | WhatsApp session credentials and signal keys |
| `groups.json` | per-group settings (antilink, welcome, nsfw, ...) |
| `settings.json` | global toggles and command usage counters |
| `sessions.json` | session registry, numbers and connection status |

### How it stays fast

GitHub is a git host, not a database: the API allows 5000 requests/hour
and every commit costs 300-900 ms. Baileys writes signal keys on almost
every message, so committing per write would exhaust the quota within
minutes and stall the bot.

The engine therefore works **memory-first**:

- Every read is served from an in-memory cache, so commands stay instant
- Writes mark a file dirty and are flushed on a **debounce** (8s default)
- All dirty files go up as **one commit** via the Git Data API
- A 60s interval and a shutdown hook guarantee nothing is ever lost
- Failed pushes are retried and the data is re-queued, never dropped

Measured: **14 separate writes collapsed into 1 commit**, ~20 API calls
per boot. Typical usage stays far under the hourly quota.

Owner commands: `.dbstats` shows records, commit count and quota left.
`.dbsave` forces an immediate commit.

## 6. Website features

- Glassmorphism UI, dark professional theme, no emojis
- Animated gradient orbs, moving grid, twinkling starfield, film grain
- Working pairing-code **and** QR generation against live WhatsApp
- 40-second countdown ring that turns amber then red, with shake animation
- Right-click, F12, Ctrl+Shift+I/J/C, Ctrl+U and image-drag blocking
- Terms, Privacy, FAQ and live Commands pages in one SPA file
- Live stats counters pulled from `/api/stats`
- Fully responsive down to 380px, reduced-motion support

### REST API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/pair` | Start pairing. Body: `{ number, method: "code"｜"qr" }` |
| GET | `/api/pair/:id` | Poll state: `generating｜waiting｜connected｜expired｜error` |
| DELETE | `/api/pair/:id` | Log out and delete a session |
| GET | `/api/stats` | Live counters |
| GET | `/api/commands` | Full command index |
| GET | `/api/health` | Health probe |

---

## 7. Verified working

```
Baileys pairing code issued live   S7R2-VNLZ
WA protocol version                2.3000.1035194821
Commands loaded                    337 in 14 categories
Unique triggers                    778, zero conflicts
Website pages                      / /pair /commands /faq /terms /privacy  all HTTP 200

SASA TECH API live latency
  tiktok       OK   1611ms
  youtube mp3  OK   1030ms
  sinhalasub   OK    764ms
  cinesubz     OK   1041ms
  mediafire    OK    576ms
```

**API endpoint audit:** `download/*` (tiktok, youtube, fb, inster, twiter, mfire, gdrive, terabox, mega) and `movie/*` (sinhalasub, cinesubz, sublk, baiscopes, cartoon, moviesublk) are all live. The `utils/`, `ai/`, `search/` and `news/` routes advertised on the API homepage return **404 — not yet implemented server-side**, so those features were built on independent free providers instead (wttr.in, DuckDuckGo, Pollinations, TinyURL) and work today.

---

## 8. Local development

```bash
npm install
cp .env.example .env     # edit values
npm start                # http://localhost:8000
```

Requires Node 22 and ffmpeg on PATH for media commands.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Pairing code never appears | Number must include country code, no `+` or spaces |
| Code expires too fast | Raise `PAIR_CODE_TTL` (WhatsApp itself allows ~60s) |
| Sticker/audio commands fail | ffmpeg buildpack missing — add it and redeploy |
| Bot stops after ~30 min | Free Heroku dynos sleep; use an Eco/Basic dyno |
| `GITHUB_NOT_CONFIGURED` | Set `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` config vars |
| `BAD_TOKEN` | Token expired or missing `repo` scope. Generate a new one |
| `REPO_NOT_FOUND` | Check owner/repo spelling. Private repos need full `repo` scope |
| `EALLOWGIT` / `Refusing to fetch libsignal` on Heroku | Fixed: `overrides.libsignal` in package.json forces the npm-registry copy instead of a git URL. Ensure `package-lock.json` is committed. |
| Session drops repeatedly | Do not run the same session on two hosts at once |
| **"Couldn't link device"** on the phone | Almost always a stale WhatsApp Web build. The bot now detects the live build automatically — check the `[WA-VER]` line in the logs. If it looks old, set `WA_VERSION=2.3000.<current>` |
| `.support` says AI not configured | Set the `GROQ_API_KEY` config var and restart |
| `.support` returns `MODEL_GONE` | Groq retired the model. Leave `GROQ_MODEL` blank so the bot auto-selects a working one |

---

## 10. AI Support Assistant

`.support` is a help desk powered by [Groq](https://console.groq.com) that answers
questions **about this bot only** — its errors, bugs, status and commands.

```
.support status
.support why is pairing failing
.support any errors right now
.support how does .tiktok work
```

It answers from live diagnostics (real recorded errors, uptime, session
counts, database state), so it reports what actually happened rather than
guessing. Off-topic questions are refused before any API call is made.

**Setup** — get a free key at `console.groq.com`, then:

```bash
heroku config:set GROQ_API_KEY=gsk_your_key_here
```

Never commit the key to the repository. If `GROQ_API_KEY` is unset,
`.support` still works and returns the raw diagnostics instead.

Related commands that need **no** API key and always work:

| Command | Purpose |
|---|---|
| `.health` | Full health report: uptime, memory, sessions, success rate |
| `.errors` | The recent internal error log |
| `.clearerrors` | Reset the error log (owner only) |

> **Model note:** Groq retires models regularly (`llama-3.3-70b-versatile`
> shuts down 2026-08-16). Leave `GROQ_MODEL` blank — the client walks a
> fallback chain and caches whichever model works, so the bot keeps
> running when a model is decommissioned.

---

**© 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝚂𝙰𝚂𝙰 𝙳𝙴𝚅 𝙾𝙵𝙲 </>**
