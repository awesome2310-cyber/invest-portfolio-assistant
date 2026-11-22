import type { DatabaseSync } from "node:sqlite";
import { buildPlan } from "@/lib/allocation";
import { ASSUMPTIONS } from "@/lib/allocation/assumptions";
import { REFERENCE_PRICES } from "@/lib/allocation/instruments";
import type { AccessNote, AssetClass, Currency, PlanInput, RiskProfile, Weights } from "@/lib/allocation/types";
import { validatePlan } from "@/lib/allocation/engine";
import { headlinesFor } from "@/lib/market/news";
import { bangkokToday, projectFromProxy } from "@/lib/market/series";
import { fetchYahooDaily } from "@/lib/market/yahoo";
import { rebuildAlerts, latestFx } from "@/lib/server/alerts-store";
import { getDb } from "@/lib/server/db";
import { buildIndexedSeries, toPortfolio } from "@/lib/server/valuation";
import { DEFAULT_THRESHOLDS } from "@/lib/alerts/engine";

interface PortfolioRow {
  id: string;
  plan_json: string;
  weights_json: string;
  metrics_json: string;
  fx: number;
  inception_date: string;
  created_at: string;
  replay: number;
}

interface HoldingRow {
  id: string;
  instrument_id: string;
  symbol: string;
  name: string;
  asset_class: AssetClass;
  vehicle: string;
  listing: string;
  trading_currency: Currency;
  role: string;
  yahoo_symbol: string | null;
  proxy_yahoo: string | null;
  expense_ratio: number | null;
  expense_note: string;
  price_note: string;
  unit_note: string;
  access_json: string;
  note: string | null;
  target_weight: number;
  amount: number;
  units: number;
  entry_price: number;
  core_alternative: string | null;
}

export interface DeskHolding {
  id: string;
  instrumentId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  vehicle: string;
  listing: string;
  role: string;
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
  note: string | null;
  access: AccessNote[];
  proxy: boolean;
}

export interface DeskAlert {
  id: string;
  kind: string;
  severity: string;
  symbol: string | null;
  assetClass: AssetClass | null;
  title: string;
  reasoning: string;
  action: "hold" | "rebalance" | "swap";
  actionDetail: string;
  createdAt: string;
  delivery: { channel: string; status: string; detail: string }[];
}

export interface DeskData {
  user: { name: string; email: string; isDemo: boolean };
  plan: PlanInput;
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
  drift: { assetClass: AssetClass; label: string; target: number; current: number }[];
  holdings: DeskHolding[];
  alerts: DeskAlert[];
  priceSource: string;
  refreshNote: string | null;
}

function portfolioFor(db: DatabaseSync, userId: string): PortfolioRow | undefined {
  return db
    .prepare("SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(userId) as PortfolioRow | undefined;
}

function priceBook(db: DatabaseSync): Record<string, number> {
  const book = { ...REFERENCE_PRICES };
  for (const symbol of Object.keys(book)) {
    const row = db
      .prepare("SELECT close FROM price_bars WHERE symbol = ? ORDER BY date DESC LIMIT 1")
      .get(symbol) as { close: number } | undefined;
    if (row) book[symbol] = row.close;
  }
  return book;
}

function barsSince(db: DatabaseSync, start: string) {
  const rows = db
    .prepare("SELECT symbol, date, close FROM price_bars WHERE date >= ? ORDER BY date")
    .all(start) as { symbol: string; date: string; close: number }[];
  const prices: Record<string, Record<string, number>> = {};
  const dates = new Set<string>();
  for (const row of rows) {
    prices[row.symbol] ??= {};
    prices[row.symbol][row.date] = row.close;
    dates.add(row.date);
  }
  return { prices, dates: [...dates].sort() };
}

function lastCloses(db: DatabaseSync, symbol: string, count: number) {
  return db
    .prepare("SELECT date, close FROM price_bars WHERE symbol = ? ORDER BY date DESC LIMIT ?")
    .all(symbol, count) as { date: string; close: number }[];
}

export function loadDesk(userId: string, user: { name: string; email: string; isDemo: boolean }): DeskData | null {
  const db = getDb();
  const portfolio = portfolioFor(db, userId);
  if (!portfolio) return null;
  const plan = JSON.parse(portfolio.plan_json) as PlanInput;
  const modelWeights = JSON.parse(portfolio.weights_json) as Weights;
  const metrics = JSON.parse(portfolio.metrics_json) as {
    expectedReturn: number;
    volatility: number;
    sharpe: number;
    profile: RiskProfile;
    targetReturn: number;
  };
  const holdings = db.prepare("SELECT * FROM holdings WHERE portfolio_id = ?").all(portfolio.id) as unknown as HoldingRow[];
  const fx = latestFx(db).rate;
  const start = portfolio.replay ? "1900-01-01" : portfolio.inception_date;
  const history = barsSince(db, start);
  const fxByDate = history.prices["THB=X"] ?? {};

  const view: DeskHolding[] = holdings.map((holding) => {
    const closes = lastCloses(db, holding.symbol, 2);
    const price = closes[0]?.close ?? holding.entry_price;
    const previous = closes[1]?.close ?? price;
    const marketValue = toPortfolio(holding.units, price, holding.trading_currency, plan.currency, fx);
    const cost = holding.amount;
    const dayChange = previous > 0 ? price / previous - 1 : 0;
    return {
      id: holding.id,
      instrumentId: holding.instrument_id,
      symbol: holding.symbol,
      name: holding.name,
      assetClass: holding.asset_class,
      vehicle: holding.vehicle,
      listing: holding.listing,
      role: holding.role,
      tradingCurrency: holding.trading_currency,
      units: holding.units,
      price,
      entryPrice: holding.entry_price,
      marketValue,
      cost,
      dayChange,
      targetWeight: holding.target_weight,
      currentWeight: 0,
      expenseRatio: holding.expense_ratio,
      expenseNote: holding.expense_note,
      priceNote: holding.price_note,
      unitNote: holding.unit_note,
      note: holding.note,
      access: JSON.parse(holding.access_json) as AccessNote[],
      proxy: Boolean(holding.proxy_yahoo),
    };
  });
  const marketValue = view.reduce((sum, holding) => sum + holding.marketValue, 0) || 1;
  const cost = view.reduce((sum, holding) => sum + holding.cost, 0);
  for (const holding of view) holding.currentWeight = holding.marketValue / marketValue;

  const classValue: Partial<Record<AssetClass, number>> = {};
  for (const holding of view) {
    classValue[holding.assetClass] = (classValue[holding.assetClass] ?? 0) + holding.marketValue;
  }
  const drift = (Object.keys(modelWeights) as AssetClass[]).map((assetClass) => ({
    assetClass,
    label: ASSUMPTIONS[assetClass].label,
    target: modelWeights[assetClass],
    current: (classValue[assetClass] ?? 0) / marketValue,
  }));

  const series = buildIndexedSeries({
    dates: history.dates,
    holdings: view.map((holding) => ({
      symbol: holding.symbol,
      units: holding.units,
      tradingCurrency: holding.tradingCurrency,
    })),
    prices: history.prices,
    fxByDate,
    fallbackFx: fx,
    portfolioCurrency: plan.currency,
    benchmark: [
      { symbol: "TDEX.BK", weight: 0.4, tradingCurrency: "THB" },
      { symbol: "VOO", weight: 0.4, tradingCurrency: "USD" },
      { symbol: "K-FIXED-A", weight: 0.2, tradingCurrency: "THB" },
    ],
  });
  const dayChange =
    series.length >= 2 && series[series.length - 2].value > 0
      ? series[series.length - 1].value / series[series.length - 2].value - 1
      : 0;

  const alertRows = db
    .prepare(
      `SELECT * FROM alerts WHERE portfolio_id = ? AND dismissed = 0 ORDER BY
        CASE severity WHEN 'act' THEN 0 ELSE 1 END, created_at DESC`,
    )
    .all(portfolio.id) as {
    id: string;
    kind: string;
    severity: string;
    symbol: string | null;
    asset_class: AssetClass | null;
    title: string;
    reasoning: string;
    action: "hold" | "rebalance" | "swap";
    action_detail: string;
    created_at: string;
  }[];
  const alerts: DeskAlert[] = alertRows.map((alert) => ({
    id: alert.id,
    kind: alert.kind,
    severity: alert.severity,
    symbol: alert.symbol,
    assetClass: alert.asset_class,
    title: alert.title,
    reasoning: alert.reasoning,
    action: alert.action,
    actionDetail: alert.action_detail,
    createdAt: alert.created_at,
    delivery: (
      db.prepare("SELECT channel, status, detail FROM outbox WHERE alert_id = ? ORDER BY channel").all(alert.id) as {
        channel: string;
        status: string;
        detail: string;
      }[]
    ).map((item) => ({
      channel: String(item.channel),
      status: String(item.status),
      detail: String(item.detail),
    })),
  }));

  const source = db.prepare("SELECT value FROM meta WHERE key = 'price_source'").get() as { value: string } | undefined;
  const note = db.prepare("SELECT value FROM meta WHERE key = 'refresh_note'").get() as { value: string } | undefined;

  return {
    user,
    plan,
    profile: metrics.profile,
    expectedReturn: metrics.expectedReturn,
    volatility: metrics.volatility,
    sharpe: metrics.sharpe,
    targetReturn: metrics.targetReturn,
    modelWeights,
    fx,
    marketValue,
    cost,
    dayChange,
    inception: portfolio.inception_date,
    replay: Boolean(portfolio.replay),
    series: series.map((point) => ({
      date: point.date,
      portfolio: point.portfolio,
      benchmark: point.benchmark,
    })),
    drift,
    holdings: view.sort((a, b) => b.marketValue - a.marketValue),
    alerts,
    priceSource: source?.value ?? "seed",
    refreshNote: note?.value ?? null,
  };
}

export function loadHolding(userId: string, instrumentId: string) {
  const desk = loadDesk(userId, { name: "", email: "", isDemo: false });
  if (!desk) return null;
  const holding = desk.holdings.find((item) => item.instrumentId === instrumentId);
  if (!holding) return null;
  const db = getDb();
  const bars = (
    db.prepare("SELECT date, close, source FROM price_bars WHERE symbol = ? ORDER BY date").all(holding.symbol) as {
      date: string;
      close: number;
      source: string;
    }[]
  ).map((bar) => ({ date: String(bar.date), close: Number(bar.close), source: String(bar.source) }));
  const news = (
    db
      .prepare(
        "SELECT title, source, url, published_at, sentiment, method FROM news_items WHERE symbol = ? ORDER BY published_at DESC",
      )
      .all(holding.symbol) as {
      title: string;
      source: string;
      url: string | null;
      published_at: string;
      sentiment: number;
      method: string;
    }[]
  ).map((item) => ({
    title: String(item.title),
    source: String(item.source),
    url: item.url ? String(item.url) : null,
    published_at: String(item.published_at),
    sentiment: Number(item.sentiment),
    method: String(item.method),
  }));
  return { desk, holding, bars, news };
}

export function loadPlan(userId: string): PlanInput | null {
  const row = portfolioFor(getDb(), userId);
  if (!row) return null;
  return JSON.parse(row.plan_json) as PlanInput;
}

export function quoteContext() {
  const db = getDb();
  return { fx: latestFx(db).rate, prices: priceBook(db) };
}

export function savePortfolio(userId: string, input: PlanInput): { ok: true } | { ok: false; errors: string[] } {
  const errors = validatePlan(input);
  if (errors.length) return { ok: false, errors };
  const db = getDb();
  const fx = latestFx(db).rate;
  const prices = priceBook(db);
  const built = buildPlan(input, { includeProjection: false, fx, prices });
  const portfolioId = crypto.randomUUID();
  const now = new Date().toISOString();
  const today = bangkokToday();
  db.exec("BEGIN");
  try {
    const old = db.prepare("SELECT id FROM portfolios WHERE user_id = ?").all(userId) as { id: string }[];
    for (const portfolio of old) {
      db.prepare("DELETE FROM holdings WHERE portfolio_id = ?").run(portfolio.id);
      db.prepare("DELETE FROM alerts WHERE portfolio_id = ?").run(portfolio.id);
    }
    db.prepare("DELETE FROM outbox WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM portfolios WHERE user_id = ?").run(userId);
    db.prepare(
      `INSERT INTO portfolios (
        id, user_id, plan_json, weights_json, metrics_json, fx, inception_date, created_at, replay
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(
      portfolioId,
      userId,
      JSON.stringify(input),
      JSON.stringify(built.allocation.weights),
      JSON.stringify({
        expectedReturn: built.allocation.expectedReturn,
        volatility: built.allocation.volatility,
        sharpe: built.allocation.sharpe,
        profile: built.allocation.profile,
        targetReturn: built.allocation.targetReturn,
        steps: built.allocation.steps,
        warnings: built.warnings,
      }),
      fx,
      today,
      now,
    );
    const insert = db.prepare(
      `INSERT INTO holdings (
        id, portfolio_id, instrument_id, symbol, name, asset_class, vehicle, listing, trading_currency,
        role, yahoo_symbol, proxy_yahoo, expense_ratio, expense_note, price_note, unit_note, access_json,
        note, target_weight, amount, units, entry_price, core_alternative
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const line of built.instruments) {
      insert.run(
        crypto.randomUUID(),
        portfolioId,
        line.id,
        line.symbol,
        line.name,
        line.assetClass,
        line.vehicle,
        line.listing,
        line.tradingCurrency,
        line.role,
        line.yahooSymbol,
        line.proxyYahoo,
        line.expenseRatio,
        line.expenseNote,
        line.priceNote,
        line.unitNote,
        JSON.stringify(line.access),
        line.note ?? null,
        line.targetWeight,
        line.amount,
        line.units,
        prices[line.symbol] ?? line.price,
        line.role === "satellite" ? "TDEX.BK|ThaiDEX SET50 ETF" : null,
      );
    }
    const settings = db.prepare("SELECT user_id FROM alert_settings WHERE user_id = ?").get(userId);
    if (!settings) {
      db.prepare(
        "INSERT INTO alert_settings (user_id, price_move_pct, drift_pp, sentiment_delta) VALUES (?, ?, ?, ?)",
      ).run(userId, DEFAULT_THRESHOLDS.priceMovePct, DEFAULT_THRESHOLDS.driftPp, DEFAULT_THRESHOLDS.sentimentDelta);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  rebuildAlerts(db, userId, portfolioId);
  return { ok: true };
}

export function dismissAlert(userId: string, alertId: string) {
  getDb().prepare("UPDATE alerts SET dismissed = 1 WHERE id = ? AND user_id = ?").run(alertId, userId);
}

export function updateThresholds(
  userId: string,
  thresholds: { priceMovePct: number; driftPp: number; sentimentDelta: number },
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO alert_settings (user_id, price_move_pct, drift_pp, sentiment_delta)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       price_move_pct = excluded.price_move_pct,
       drift_pp = excluded.drift_pp,
       sentiment_delta = excluded.sentiment_delta`,
  ).run(userId, thresholds.priceMovePct, thresholds.driftPp, thresholds.sentimentDelta);
  const portfolio = portfolioFor(db, userId);
  if (portfolio) rebuildAlerts(db, userId, portfolio.id);
}

export function readThresholds(userId: string) {
  const row = getDb()
    .prepare("SELECT price_move_pct, drift_pp, sentiment_delta FROM alert_settings WHERE user_id = ?")
    .get(userId) as { price_move_pct: number; drift_pp: number; sentiment_delta: number } | undefined;
  return {
    priceMovePct: row?.price_move_pct ?? DEFAULT_THRESHOLDS.priceMovePct,
    driftPp: row?.drift_pp ?? DEFAULT_THRESHOLDS.driftPp,
    sentimentDelta: row?.sentiment_delta ?? DEFAULT_THRESHOLDS.sentimentDelta,
  };
}

export async function refreshMarket(userId: string): Promise<{ ok: boolean; note: string }> {
  const db = getDb();
  const portfolio = portfolioFor(db, userId);
  if (!portfolio) return { ok: false, note: "Save a plan before refreshing prices." };
  const holdings = db
    .prepare("SELECT symbol, yahoo_symbol, proxy_yahoo FROM holdings WHERE portfolio_id = ?")
    .all(portfolio.id) as { symbol: string; yahoo_symbol: string | null; proxy_yahoo: string | null }[];
  const symbols = new Set<string>(["THB=X", "^SET.BK"]);
  for (const holding of holdings) {
    if (holding.yahoo_symbol) symbols.add(holding.yahoo_symbol);
    if (holding.proxy_yahoo) symbols.add(holding.proxy_yahoo);
  }
  const failures: string[] = [];
  const fetched: { symbol: string; bars: NonNullable<Awaited<ReturnType<typeof fetchYahooDaily>>> }[] = [];
  const list = [...symbols];
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const symbol = list[cursor];
      cursor += 1;
      const bars = await fetchYahooDaily(symbol);
      if (!bars?.length) failures.push(symbol);
      else fetched.push({ symbol, bars });
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, list.length) }, () => worker()));
  const insert = db.prepare(
    `INSERT INTO price_bars (symbol, date, close, currency, source) VALUES (?, ?, ?, ?, 'yahoo')
     ON CONFLICT(symbol, date) DO UPDATE SET close = excluded.close, currency = excluded.currency, source = 'yahoo'`,
  );
  for (const item of fetched) {
    for (const bar of item.bars) insert.run(item.symbol, bar.date, bar.close, bar.currency);
  }

  for (const holding of holdings) {
    if (!holding.proxy_yahoo) continue;
    const proxyBars = db
      .prepare("SELECT date, close FROM price_bars WHERE symbol = ? ORDER BY date")
      .all(holding.proxy_yahoo) as { date: string; close: number }[];
    const anchorRow = db
      .prepare("SELECT close FROM price_bars WHERE symbol = ? ORDER BY date DESC LIMIT 1")
      .get(holding.symbol) as { close: number } | undefined;
    const anchor = anchorRow?.close ?? REFERENCE_PRICES[holding.symbol];
    if (!proxyBars.length || !anchor) continue;
    const projected = projectFromProxy(proxyBars, anchor);
    db.prepare("DELETE FROM price_bars WHERE symbol = ?").run(holding.symbol);
    const insert = db.prepare(
      "INSERT INTO price_bars (symbol, date, close, currency, source) VALUES (?, ?, ?, 'THB', 'proxy')",
    );
    for (const bar of projected) insert.run(holding.symbol, bar.date, bar.close);
  }

  let headlines = 0;
  for (const holding of holdings) {
    const found = await headlinesFor(`${holding.symbol} stock OR fund`);
    if (!found.length) continue;
    headlines += found.length;
    db.prepare("DELETE FROM news_items WHERE symbol = ?").run(holding.symbol);
    const insert = db.prepare(
      `INSERT INTO news_items (id, symbol, title, source, url, published_at, sentiment, method, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const fetched = new Date().toISOString();
    for (const item of found) {
      insert.run(
        crypto.randomUUID(),
        holding.symbol,
        item.title,
        item.source,
        item.url || null,
        item.publishedAt,
        item.sentiment,
        item.method,
        fetched,
      );
    }
  }

  const source = failures.length === list.length ? "seed" : "yahoo";
  const note =
    failures.length === 0
      ? `Yahoo Finance updated ${list.length} symbols. ${headlines} headlines scored.`
      : `Yahoo missed ${failures.join(", ")}. Saved prices were kept for those. ${headlines} headlines scored.`;
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('price_source', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(source);
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('refresh_note', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(note);
  rebuildAlerts(db, userId, portfolio.id);
  return { ok: failures.length !== list.length, note };
}
