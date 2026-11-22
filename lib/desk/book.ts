import { DEFAULT_THRESHOLDS, evaluateAlerts } from "@/lib/alerts/engine";
import type { AlertDraft, AlertThresholds } from "@/lib/alerts/engine";
import { buildAllocation } from "@/lib/allocation/engine";
import { buildInstruments } from "@/lib/allocation/instruments";
import type { AccessNote, AssetClass, Currency, PlanInput, RiskProfile, Weights } from "@/lib/allocation/types";
import { ASSET_CLASSES } from "@/lib/allocation/types";
import { ASSUMPTIONS } from "@/lib/allocation/assumptions";
import { aggregateSentiment } from "@/lib/market/news";
import { bangkokToday } from "@/lib/market/series";
import type { MarketSnapshot } from "@/lib/market/snapshot";
import { closeOn } from "@/lib/market/snapshot";
import { dispatchNotification } from "@/lib/notify";
import type { DeliveryResult } from "@/lib/notify";
import { buildIndexedSeries, toPortfolio } from "@/lib/server/valuation";

export const DEMO_PLAN: PlanInput = {
  timelineYears: 12,
  amount: 2_500_000,
  currency: "THB",
  riskScore: 64,
  monthlyContribution: 15_000,
  marketPreference: "balanced",
  taxWrapper: "none",
};

export interface DeskRecord {
  version: 1;
  mode: "demo" | "custom";
  plan: PlanInput;
  savedAt: string;
  dismissed: string[];
  thresholds: AlertThresholds;
}

export interface BookHolding {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  role: "core" | "satellite" | "residual";
  tradingCurrency: Currency;
  units: number;
  price: number;
  entryPrice: number;
  marketValue: number;
  cost: number;
  dayChange: number;
  targetWeight: number;
  currentWeight: number;
  expenseRatio: number | null;
  expenseNote: string;
  priceNote: string;
  unitNote: string;
  access: AccessNote[];
  note?: string;
  proxy: boolean;
}

export interface DeskBook {
  record: DeskRecord;
  plan: PlanInput;
  mode: "demo" | "custom";
  profile: RiskProfile;
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  targetReturn: number;
  modelWeights: Weights;
  fx: number;
  marketValue: number;
  cost: number;
  dayChange: number;
  inception: string;
  replay: boolean;
  series: { date: string; portfolio: number; benchmark: number }[];
  drift: { assetClass: AssetClass; target: number; current: number }[];
  holdings: BookHolding[];
  alerts: (AlertDraft & { delivery: DeliveryResult[] })[];
  generatedAt: string;
  source: MarketSnapshot["source"];
}

export function blankThresholds(): AlertThresholds {
  return { ...DEFAULT_THRESHOLDS };
}

export function buildBook(record: DeskRecord, snapshot: MarketSnapshot): DeskBook {
  const allocation = buildAllocation(record.plan);
  const calendar = snapshot.bars["TDEX.BK"]?.closes.map((bar) => bar.date) ?? [];
  const lastDate = calendar.at(-1) ?? bangkokToday();
  const entryDate =
    record.mode === "demo" ? (calendar[Math.max(0, calendar.length - 200)] ?? lastDate) : lastDate;
  const fx = snapshot.fx > 0 ? snapshot.fx : 33.96;
  const entryPrices: Record<string, number> = {};
  const lastPrices: Record<string, number> = {};
  for (const [symbol, series] of Object.entries(snapshot.bars)) {
    const entry = closeOn(snapshot, symbol, entryDate) ?? series.closes.at(-1)?.close;
    const last = series.closes.at(-1)?.close;
    if (entry != null) entryPrices[symbol] = entry;
    if (last != null) lastPrices[symbol] = last;
  }

  const built = buildInstruments(record.plan, allocation.weights, { fx, prices: entryPrices });
  const units = new Map(built.instruments.map((line) => [line.id, line.units]));

  if (record.mode === "demo") {
    const valueOf = (id: string, symbol: string, trading: Currency) =>
      toPortfolio(units.get(id) ?? 0, lastPrices[symbol] ?? entryPrices[symbol] ?? 0, trading, record.plan.currency, fx);
    let total = 0;
    let global = 0;
    for (const line of built.instruments) {
      const value = valueOf(line.id, line.symbol, line.tradingCurrency);
      total += value;
      if (line.assetClass === "global_equity") global += value;
    }
    const desired = (allocation.weights.global_equity + 0.06) * total;
    if (global > 0 && desired > global) {
      const factor = desired / global;
      for (const line of built.instruments) {
        if (line.assetClass === "global_equity") units.set(line.id, (units.get(line.id) ?? 0) * factor);
      }
      const bond = built.instruments.find((line) => line.id === "k-fixed");
      if (bond) {
        const unitValue = toPortfolio(1, lastPrices[bond.symbol] ?? bond.price, bond.tradingCurrency, record.plan.currency, fx);
        if (unitValue > 0) units.set(bond.id, Math.max(0, (units.get(bond.id) ?? 0) - (desired - global) / unitValue));
      }
    }
  }

  const holdings: BookHolding[] = built.instruments.map((line) => {
    const holdingUnits = units.get(line.id) ?? line.units;
    const price = lastPrices[line.symbol] ?? line.price;
    const entryPrice = entryPrices[line.symbol] ?? price;
    const closes = snapshot.bars[line.symbol]?.closes ?? [];
    const previous = closes.length > 1 ? closes[closes.length - 2].close : price;
    const marketValue = toPortfolio(holdingUnits, price, line.tradingCurrency, record.plan.currency, fx);
    const cost = toPortfolio(holdingUnits, entryPrice, line.tradingCurrency, record.plan.currency, fx);
    return {
      id: line.id,
      symbol: line.symbol,
      name: line.name,
      assetClass: line.assetClass,
      role: line.role,
      tradingCurrency: line.tradingCurrency,
      units: holdingUnits,
      price,
      entryPrice,
      marketValue,
      cost,
      dayChange: previous > 0 ? price / previous - 1 : 0,
      targetWeight: line.targetWeight,
      currentWeight: 0,
      expenseRatio: line.expenseRatio,
      expenseNote: line.expenseNote,
      priceNote: line.priceNote,
      unitNote: line.unitNote,
      access: line.access,
      note: line.note,
      proxy: Boolean(line.proxyYahoo),
    };
  });

  const marketValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0) || 1;
  const cost = holdings.reduce((sum, holding) => sum + holding.cost, 0);
  for (const holding of holdings) holding.currentWeight = holding.marketValue / marketValue;

  const classValue: Partial<Record<AssetClass, number>> = {};
  for (const holding of holdings) {
    classValue[holding.assetClass] = (classValue[holding.assetClass] ?? 0) + holding.marketValue;
  }
  const drift = ASSET_CLASSES.map((assetClass) => ({
    assetClass,
    target: allocation.weights[assetClass],
    current: (classValue[assetClass] ?? 0) / marketValue,
  }));

  const historyDates = record.mode === "demo" ? calendar.filter((date) => date >= entryDate) : calendar;
  const priceTable: Record<string, Record<string, number>> = {};
  for (const [symbol, series] of Object.entries(snapshot.bars)) {
    priceTable[symbol] = {};
    for (const bar of series.closes) priceTable[symbol][bar.date] = bar.close;
  }
  const series = buildIndexedSeries({
    dates: historyDates,
    holdings: holdings.map((holding) => ({
      symbol: holding.symbol,
      units: holding.units,
      tradingCurrency: holding.tradingCurrency,
    })),
    prices: priceTable,
    fxByDate: priceTable["THB=X"] ?? {},
    fallbackFx: fx,
    portfolioCurrency: record.plan.currency,
    benchmark: [
      { symbol: "TDEX.BK", weight: 0.4, tradingCurrency: "THB" },
      { symbol: "VOO", weight: 0.4, tradingCurrency: "USD" },
      { symbol: "K-FIXED-A", weight: 0.2, tradingCurrency: "THB" },
    ],
  }).map((point) => ({ date: point.date, portfolio: point.portfolio, benchmark: point.benchmark }));

  const dayChange =
    series.length >= 2 && series[series.length - 2] ? valueChange(holdings, snapshot, record.plan.currency, fx) : 0;

  const today = lastDate;
  const drafts = evaluateAlerts({
    totalValue: marketValue,
    targets: allocation.weights,
    holdings: holdings.map((holding) => {
      const closes = snapshot.bars[holding.symbol]?.closes ?? [];
      const prior = closes.length > 5 ? closes[closes.length - 6].close : null;
      return {
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        assetClass: holding.assetClass,
        role: holding.role,
        marketValue: holding.marketValue,
        price: holding.price,
        price5Ago: prior,
        coreAlternative:
          holding.role === "satellite" ? { symbol: "TDEX.BK", name: "ThaiDEX SET50 ETF" } : undefined,
      };
    }),
    sentiments: holdings.flatMap((holding) => {
      const items = snapshot.news[holding.symbol] ?? [];
      const window = aggregateSentiment(
        items.map((item) => ({ publishedAt: item.publishedAt, sentiment: item.sentiment })),
        today,
      );
      return window ? [{ symbol: holding.symbol, latest: window.latest, previous: window.previous }] : [];
    }),
    currency: record.plan.currency,
    monthlyContribution: record.plan.monthlyContribution,
    thresholds: record.thresholds,
  }).filter((alert) => !record.dismissed.includes(alert.dedupeKey));

  const alerts = drafts.map((draft) => ({
    ...draft,
    delivery: dispatchNotification({
      userId: "browser",
      alertId: draft.dedupeKey,
      title: draft.title,
      body: draft.actionDetail,
    }),
  }));

  return {
    record,
    plan: record.plan,
    mode: record.mode,
    profile: allocation.profile,
    expectedReturn: allocation.expectedReturn,
    volatility: allocation.volatility,
    sharpe: allocation.sharpe,
    targetReturn: allocation.targetReturn,
    modelWeights: allocation.weights,
    fx,
    marketValue,
    cost,
    dayChange,
    inception: entryDate,
    replay: record.mode !== "demo",
    series,
    drift,
    holdings: holdings.sort((a, b) => b.marketValue - a.marketValue),
    alerts,
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
  };
}

function valueChange(holdings: BookHolding[], snapshot: MarketSnapshot, currency: Currency, fx: number): number {
  let latest = 0;
  let previous = 0;
  for (const holding of holdings) {
    const closes = snapshot.bars[holding.symbol]?.closes ?? [];
    const prev = closes.length > 1 ? closes[closes.length - 2].close : holding.price;
    latest += toPortfolio(holding.units, holding.price, holding.tradingCurrency, currency, fx);
    previous += toPortfolio(holding.units, prev, holding.tradingCurrency, currency, fx);
  }
  return previous > 0 ? latest / previous - 1 : 0;
}

export function classLabel(asset: AssetClass): string {
  return ASSUMPTIONS[asset].label;
}
