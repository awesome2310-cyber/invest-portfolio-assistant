import type { Currency } from "@/lib/allocation/types";

export function toPortfolio(
  units: number,
  price: number,
  tradingCurrency: Currency,
  portfolioCurrency: Currency,
  fxUsdThb: number,
): number {
  const thb = tradingCurrency === "THB" ? units * price : units * price * fxUsdThb;
  return portfolioCurrency === "THB" ? thb : thb / fxUsdThb;
}

export interface SeriesPoint {
  date: string;
  portfolio: number;
  benchmark: number;
  value: number;
}

export function buildIndexedSeries(input: {
  dates: string[];
  holdings: { symbol: string; units: number; tradingCurrency: Currency }[];
  prices: Record<string, Record<string, number>>;
  fxByDate: Record<string, number>;
  fallbackFx: number;
  portfolioCurrency: Currency;
  benchmark: { symbol: string; weight: number; tradingCurrency: Currency }[];
}): SeriesPoint[] {
  const carried: Record<string, number> = {};
  let carriedFx = input.fallbackFx;
  const points: { date: string; value: number }[] = [];

  for (const date of input.dates) {
    if (input.fxByDate[date] != null) carriedFx = input.fxByDate[date];
    let value = 0;
    let priced = 0;
    for (const holding of input.holdings) {
      const quoted = input.prices[holding.symbol]?.[date];
      if (quoted != null) carried[holding.symbol] = quoted;
      const price = carried[holding.symbol];
      if (price == null) continue;
      priced += 1;
      value += toPortfolio(holding.units, price, holding.tradingCurrency, input.portfolioCurrency, carriedFx);
    }
    if (priced === 0) continue;
    points.push({ date, value });
  }
  if (!points.length) return [];

  const base = points[0].value || 1;
  const benchUnits: { units: number; tradingCurrency: Currency; symbol: string }[] = [];
  const firstDate = points[0].date;
  const firstFx = input.fxByDate[firstDate] ?? input.fallbackFx;
  for (const leg of input.benchmark) {
    const price = input.prices[leg.symbol]?.[firstDate] ?? carried[leg.symbol];
    if (price == null || price <= 0) continue;
    const unitValue = toPortfolio(1, price, leg.tradingCurrency, input.portfolioCurrency, firstFx);
    if (unitValue <= 0) continue;
    benchUnits.push({
      symbol: leg.symbol,
      tradingCurrency: leg.tradingCurrency,
      units: (base * leg.weight) / unitValue,
    });
  }
  const benchBase = benchmarkValue(benchUnits, firstDate, input, firstFx) || 1;
  const benchCarried: Record<string, number> = {};

  return points.map((point) => {
    const fx = input.fxByDate[point.date] ?? firstFx;
    const bench = benchmarkValue(benchUnits, point.date, input, fx, benchCarried);
    return {
      date: point.date,
      value: point.value,
      portfolio: (point.value / base) * 100,
      benchmark: (bench / benchBase) * 100,
    };
  });
}

function benchmarkValue(
  legs: { units: number; tradingCurrency: Currency; symbol: string }[],
  date: string,
  input: {
    prices: Record<string, Record<string, number>>;
    portfolioCurrency: Currency;
  },
  fx: number,
  carried: Record<string, number> = {},
): number {
  let total = 0;
  for (const leg of legs) {
    const quoted = input.prices[leg.symbol]?.[date];
    if (quoted != null) carried[leg.symbol] = quoted;
    const price = carried[leg.symbol];
    if (price == null) continue;
    total += toPortfolio(leg.units, price, leg.tradingCurrency, input.portfolioCurrency, fx);
  }
  return total;
}
