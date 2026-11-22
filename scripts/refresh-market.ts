import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATALOG, REFERENCE_PRICES } from "../lib/allocation/instruments.ts";
import { headlinesFor } from "../lib/market/news.ts";
import { projectFromProxy } from "../lib/market/series.ts";
import { buildFallbackSnapshot } from "../lib/market/snapshot.ts";
import type { MarketSnapshot } from "../lib/market/snapshot.ts";
import { fetchYahooDaily } from "../lib/market/yahoo.ts";

const target = path.join(process.cwd(), "public", "market", "snapshot.json");

function readExisting(): MarketSnapshot | null {
  try {
    return JSON.parse(readFileSync(target, "utf8")) as MarketSnapshot;
  } catch {
    return null;
  }
}

function symbolsToFetch(): string[] {
  const symbols = new Set<string>(["THB=X", "^SET.BK", "GLD"]);
  for (const item of CATALOG) {
    if (item.yahooSymbol) symbols.add(item.yahooSymbol);
    if (item.proxyYahoo) symbols.add(item.proxyYahoo);
  }
  return [...symbols];
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function main() {
  const seedOnly = process.argv.includes("--seed-only");
  const fallback = buildFallbackSnapshot();
  const previous = readExisting();
  if (seedOnly) {
    write(fallback);
    console.log(`Wrote seed tape (${Object.keys(fallback.bars).length} symbols) to ${target}`);
    return;
  }

  const base: MarketSnapshot = previous ?? fallback;
  const fetched = await mapPool(symbolsToFetch(), 6, async (symbol) => {
    const bars = await fetchYahooDaily(symbol);
    return { symbol, bars };
  });
  let hits = 0;
  for (const item of fetched) {
    if (!item.bars?.length) continue;
    hits += 1;
    base.bars[item.symbol] = {
      currency: item.bars.at(-1)?.currency || base.bars[item.symbol]?.currency || "USD",
      closes: item.bars.map((bar) => ({ date: bar.date, close: bar.close })),
    };
  }
  for (const item of CATALOG) {
    if (!item.proxyYahoo) continue;
    const proxy = base.bars[item.proxyYahoo]?.closes;
    if (!proxy?.length) continue;
    const anchor = base.bars[item.symbol]?.closes.at(-1)?.close ?? REFERENCE_PRICES[item.symbol];
    if (!anchor) continue;
    base.bars[item.symbol] = {
      currency: item.tradingCurrency,
      closes: projectFromProxy(proxy, anchor),
    };
  }
  const fx = base.bars["THB=X"]?.closes.at(-1)?.close;
  if (fx) base.fx = fx;

  const newsTargets = CATALOG.map((item) => item.symbol);
  const newsRows = await mapPool(newsTargets, 4, async (symbol) => {
    const item = CATALOG.find((entry) => entry.symbol === symbol);
    const headlines = await headlinesFor(item ? `${item.name} ${symbol}` : symbol);
    return { symbol, headlines };
  });
  for (const row of newsRows) {
    if (!row.headlines.length) continue;
    base.news[row.symbol] = row.headlines.map((headline) => ({
      title: headline.title,
      source: headline.source,
      url: headline.url || null,
      publishedAt: headline.publishedAt,
      sentiment: headline.sentiment,
      method: headline.method,
    }));
  }

  base.generatedAt = new Date().toISOString();
  base.source = hits === 0 ? base.source : hits === fetched.length ? "yahoo" : "mixed";
  if (hits === 0 && !previous) {
    write(fallback);
    console.log("Yahoo returned nothing. Wrote the bundled tape.");
    return;
  }
  write(base);
  console.log(`Updated snapshot from ${hits}/${fetched.length} Yahoo symbols.`);
}

function write(snapshot: MarketSnapshot) {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
