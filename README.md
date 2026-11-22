# Sathorn

A personal investing desk for someone based in Bangkok. You enter a timeline, an amount in baht or dollars, and a target return. Sathorn turns that into an asset mix, a list of funds and tickers you can actually reach from Thailand, and a watchlist that says when the mix has drifted.

It is an educational worksheet. It is not licensed investment advice.

## Run it locally

You need Node.js 22.

```bash
npm install
npm test
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

The demo desk signs in as `demo@sathorn.desk` / `demo-desk`. It is seeded with about a year of saved prices, three open alerts (hold, rebalance, swap), and a portfolio that was left alone. Use **Refresh prices** to replace listed quotes with Yahoo Finance. If Yahoo is unreachable, the saved tape stays.

Create your own account from the home page. The plan screen works with only the three inputs. Monthly contribution, a Thai or global tilt, and ThaiESG / RMF / SSF are optional and collapsed.

## What the mix is doing

The method is `glide-path-plus-risk-parity-v1`, spelled out on `/method`.

1. The risk slider interpolates between five strategic books, from conservative to aggressive.
2. A glide path scales growth assets by the timeline and floors cash and bonds when the horizon is short.
3. Cash stays at that glide-path weight. Everything else is 65% strategic and 35% inverse-volatility.
4. A regional preference moves six points between Thai and global equities. There is no leverage.
5. Each sleeve is split into concrete lines: SET ETFs, REITs and blue chips, Thai mutual funds (including a ThaiESG passive fund when you ask), and US-listed ETFs. SET lines round to a board lot of 100. The projection is a monthly Monte Carlo with contributions.

Planning returns and volatilities are long-run priors in baht terms, not a fit to one sample. Expense ratios are taken from 2026 factsheets where we checked them (TDEX, K-FIXED-A, K-GOLD-A(A), and the large US ETFs) and left blank otherwise.

News tone uses a small financial word list. If `OPENAI_API_KEY` is set, headline batches are also scored by that model and the lexicon is the fallback when the call fails.

Alerts suggest **hold**, **rebalance** (with an amount), or **swap** a satellite stock into the sleeve's core fund. In-app delivery is stored. Email (`SMTP_URL`) and LINE (`LINE_CHANNEL_ACCESS_TOKEN`) are adapter stubs that record `skipped` until a transport is added. See `lib/notify.ts`.

## Environment

Copy `.env.example` to `.env.local`. No key is required.

| Variable | Role |
| --- | --- |
| `OPENAI_API_KEY` | Optional headline scoring |
| `OPENAI_MODEL` | Defaults to `gpt-4o-mini` |
| `SMTP_URL` | Reserved for the email stub |
| `LINE_CHANNEL_ACCESS_TOKEN` | Reserved for the LINE stub |

Accounts and prices live in `data/sathorn.sqlite`, created on first launch. The file is gitignored.

The interface strings are in `messages/en.json` and `messages/th.json`. The language switch falls back to English for any key Thai does not override. The calculation notes stay in English.

## Tests

```bash
npm test
```

Vitest covers the allocation constraints (weights, glide path, risk tilt, volatility math), the Monte Carlo ordering, instrument board lots and the ThaiESG cap, alert actions, and the sentiment lexicon.

## Deploy

This app expects a long-running Node process and a writable disk for SQLite. A serverless host that throws the filesystem away will forget the desk on every boot.

### Docker

```bash
docker build -t sathorn .
docker run --rm -p 43123:43123 -v sathorn-data:/app/data sathorn
```

Mount `/app/data` so the database survives restarts.

### A small VM

Install Node 22, clone the repo, `npm ci`, `npm run build`, and run `npm start` under systemd. Put a reverse proxy in front if you want HTTPS. Set `NODE_ENV=production`. The session cookie is marked `Secure` in production, so sign-in requires HTTPS once you leave localhost.

Do not commit `.env.local`. The demo password is public and fine for a local worksheet; change it, or delete the demo user, before you put the app on a network other people can reach.
