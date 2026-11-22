import { DEFAULT_FX_USDTHB } from "@/lib/allocation/assumptions";
import { CATALOG, REFERENCE_PRICES } from "@/lib/allocation/instruments";
import { hashSeed } from "@/lib/allocation/math";
import { scoreHeadline } from "@/lib/sentiment/lexicon";
import {
  bangkokToday,
  businessDaysEnding,
  geometricToEnd,
  projectFromProxy,
  shockTail,
} from "@/lib/market/series";

export interface SnapshotBar {
  date: string;
  close: number;
}

export interface SnapshotNews {
  title: string;
  source: string;
  url: string | null;
  publishedAt: string;
  sentiment: number;
  method: "lexicon" | "llm";
}

export interface MarketSnapshot {
  generatedAt: string;
  source: "seed" | "yahoo" | "mixed";
  fx: number;
  bars: Record<string, { currency: string; closes: SnapshotBar[] }>;
  news: Record<string, SnapshotNews[]>;
}

const SEED_NEWS: { symbol: string; title: string; daysAgo: number }[] = [
  { symbol: "ADVANC.BK", title: "AIS posts record profit and lifts the dividend", daysAgo: 21 },
  { symbol: "ADVANC.BK", title: "Steady growth and a broker upgrade support AIS", daysAgo: 18 },
  { symbol: "ADVANC.BK", title: "Regulator opens a probe as AIS margins slump", daysAgo: 1 },
  { symbol: "ADVANC.BK", title: "Price war hits AIS after a downgrade", daysAgo: 0 },
  { symbol: "CPNREIT.BK", title: "Retail landlords report steady occupancy across the quarter", daysAgo: 2 },
  { symbol: "TDEX.BK", title: "SET50 drifts as banks offset energy names", daysAgo: 1 },
  { symbol: "VOO", title: "S&P 500 holds near a high as earnings meet forecasts", daysAgo: 1 },
  { symbol: "K-US500X-A(A)", title: "S&P 500 feeder keeps pace with the US large-cap tape", daysAgo: 1 },
  { symbol: "PTT.BK", title: "PTT keeps a steady dividend as gas volumes hold", daysAgo: 3 },
  { symbol: "AOT.BK", title: "Airport traffic shows a steady quarter", daysAgo: 4 },
  { symbol: "WHART.BK", title: "Warehouse occupancy stays firm in the eastern seaboard", daysAgo: 5 },
  { symbol: "K-FIXED-A", title: "Thai bond yields hold in a narrow range", daysAgo: 2 },
];

/** Offline tape. Listed names are shocked so the demo desk has something to say before the daily job runs. */
export function buildFallbackSnapshot(now = new Date()): MarketSnapshot {
  const today = bangkokToday(now);
  const dates = businessDaysEnding(today, 260);
  const series = new Map<string, { currency: string; closes: SnapshotBar[] }>();

  const direct = CATALOG.filter((item) => !item.proxyYahoo).map((item) => ({
    symbol: item.symbol,
    currency: item.tradingCurrency,
    end: REFERENCE_PRICES[item.symbol],
    ret: item.annualReturn,
    vol: item.annualVol,
  }));
  direct.push(
    { symbol: "GLD", currency: "USD", end: REFERENCE_PRICES.GLD, ret: 0.06, vol: 0.15 },
    { symbol: "THB=X", currency: "THB", end: DEFAULT_FX_USDTHB, ret: 0, vol: 0.04 },
    { symbol: "^SET.BK", currency: "THB", end: 1453.28, ret: 0.06, vol: 0.16 },
  );

  for (const item of direct) {
    series.set(item.symbol, {
      currency: item.currency,
      closes: geometricToEnd({
        endPrice: item.end,
        annualReturn: item.ret,
        annualVol: item.vol,
        dates,
        seed: hashSeed(item.symbol),
      }),
    });
  }
  shockTail(series.get("CPNREIT.BK")!.closes, 0.11);
  shockTail(series.get("ADVANC.BK")!.closes, 0.13);

  for (const item of CATALOG) {
    if (!item.proxyYahoo) continue;
    const proxy = series.get(item.proxyYahoo);
    if (!proxy) continue;
    series.set(item.symbol, {
      currency: item.tradingCurrency,
      closes: projectFromProxy(proxy.closes, REFERENCE_PRICES[item.symbol]),
    });
  }

  const news: MarketSnapshot["news"] = {};
  for (const sample of SEED_NEWS) {
    const published = new Date(now.getTime() - sample.daysAgo * 86400000).toISOString();
    news[sample.symbol] ??= [];
    news[sample.symbol].push({
      title: sample.title,
      source: "Sathorn tape",
      url: null,
      publishedAt: published,
      sentiment: scoreHeadline(sample.title),
      method: "lexicon",
    });
  }

  const fx = series.get("THB=X")?.closes.at(-1)?.close ?? DEFAULT_FX_USDTHB;
  return {
    generatedAt: `${today}T11:00:00.000Z`,
    source: "seed",
    fx,
    bars: Object.fromEntries(series),
    news,
  };
}

export function lastPrices(snapshot: MarketSnapshot): Record<string, number> {
  const prices = { ...REFERENCE_PRICES };
  for (const [symbol, series] of Object.entries(snapshot.bars)) {
    const close = series.closes.at(-1)?.close;
    if (close != null) prices[symbol] = close;
  }
  return prices;
}

export function closeOn(snapshot: MarketSnapshot, symbol: string, date: string): number | undefined {
  return snapshot.bars[symbol]?.closes.find((bar) => bar.date === date)?.close;
}
