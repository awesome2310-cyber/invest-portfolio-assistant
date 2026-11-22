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

The demo desk is one click on the home page and is stored in this browser. It is tilted about 6 points overweight global equities so a rebalance alert is visible. The bundled price tape also includes a sharp move in CPNREIT and ADVANC, until the weekday job replaces it with market prices. Download the desk as JSON if you want a copy.

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

Accounts are not stored on a server. A desk saved in the browser can be downloaded as JSON. The market file is `public/market/snapshot.json`.

Optional, only for the scheduled headline model:

| Variable | Role |
| --- | --- |
| `OPENAI_API_KEY` | Optional. GitHub Actions secret for headline scoring |
| `OPENAI_MODEL` | Optional repository variable. Defaults to `gpt-4o-mini` |
| `SMTP_URL` | Reserved for the email stub |
| `LINE_CHANNEL_ACCESS_TOKEN` | Reserved for the email/LINE stub shown on each alert. Nothing is sent. |

The interface strings are in `messages/en.json` and `messages/th.json`. The language switch falls back to English for any key Thai does not override. The calculation notes stay in English.

## Tests

```bash
npm test
```

Vitest covers the allocation constraints (weights, glide path, risk tilt, volatility math), the Monte Carlo ordering, instrument board lots and the ThaiESG cap, alert actions, and the sentiment lexicon.

## Deploy on GitHub Pages

The site is a static export. Allocation, the projection, and alerts run in the browser. The saved plan lives in `localStorage` on that device. Download or import it as `sathorn-desk.json` from the desk.

Prices and headlines cannot be fetched from the browser. `.github/workflows/market-data.yml` runs at 22:30 UTC on weekdays (after the Bangkok and New York closes), writes `public/market/snapshot.json`, commits it, and deploys. If Yahoo is unreachable, the bundled tape stays. `.github/workflows/pages.yml` builds and deploys on every push to `main`.

The public URL is [https://awesome2310-cyber.github.io/invest-portfolio-assistant/](https://awesome2310-cyber.github.io/invest-portfolio-assistant/).

Local production build, matching Pages:

```bash
NEXT_PUBLIC_BASE_PATH=/invest-portfolio-assistant npm run build
npx serve out
```

`npm run dev` serves the app at the site root, without that prefix, at [http://127.0.0.1:43123](http://127.0.0.1:43123).

No API key is required. If the market-data workflow should score headlines with a model, add a repository secret named `OPENAI_API_KEY`. Without it, the built-in word list is used.

## Other ways to run it

Docker still builds the static app and is not required for GitHub Pages:

```bash
docker build -t sathorn .
```

Do not commit `.env.local`.
