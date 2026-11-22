import type { DatabaseSync } from "node:sqlite";
import { DEFAULT_THRESHOLDS, evaluateAlerts } from "@/lib/alerts/engine";
import type { AlertHolding } from "@/lib/alerts/engine";
import { emptyWeights } from "@/lib/allocation/assumptions";
import type { AssetClass, Currency, PlanInput, Weights } from "@/lib/allocation/types";
import { aggregateSentiment } from "@/lib/market/news";
import { bangkokToday } from "@/lib/market/series";
import { dispatchNotification } from "@/lib/notify";
import { toPortfolio } from "@/lib/server/valuation";

interface HoldingRow {
  instrument_id: string;
  symbol: string;
  name: string;
  asset_class: AssetClass;
  role: "core" | "satellite" | "residual";
  trading_currency: Currency;
  units: number;
  core_alternative: string | null;
}

interface PriceRow {
  date: string;
  close: number;
}

function latestTwo(db: DatabaseSync, symbol: string, gap: number): { last: PriceRow | null; prior: PriceRow | null } {
  const rows = db
    .prepare("SELECT date, close FROM price_bars WHERE symbol = ? ORDER BY date DESC LIMIT ?")
    .all(symbol, gap + 1) as unknown as PriceRow[];
  return { last: rows[0] ?? null, prior: rows[gap] ?? null };
}

export function latestFx(db: DatabaseSync): { rate: number; date: string } {
  const row = db
    .prepare("SELECT date, close FROM price_bars WHERE symbol = 'THB=X' ORDER BY date DESC LIMIT 1")
    .get() as PriceRow | undefined;
  if (!row) return { rate: 33.96, date: bangkokToday() };
  return { rate: row.close, date: row.date };
}

export function rebuildAlerts(db: DatabaseSync, userId: string, portfolioId: string) {
  const portfolio = db
    .prepare("SELECT plan_json, weights_json, fx FROM portfolios WHERE id = ? AND user_id = ?")
    .get(portfolioId, userId) as { plan_json: string; weights_json: string; fx: number } | undefined;
  if (!portfolio) return;
  const plan = JSON.parse(portfolio.plan_json) as PlanInput;
  const targets = JSON.parse(portfolio.weights_json) as Weights;
  const fx = latestFx(db).rate || portfolio.fx;
  const holdings = db
    .prepare(
      `SELECT instrument_id, symbol, name, asset_class, role, trading_currency, units, core_alternative
       FROM holdings WHERE portfolio_id = ?`,
    )
    .all(portfolioId) as unknown as HoldingRow[];
  const settings = db
    .prepare("SELECT price_move_pct, drift_pp, sentiment_delta FROM alert_settings WHERE user_id = ?")
    .get(userId) as
    | { price_move_pct: number; drift_pp: number; sentiment_delta: number }
    | undefined;

  let total = 0;
  const alertHoldings: AlertHolding[] = [];
  for (const holding of holdings) {
    const { last, prior } = latestTwo(db, holding.symbol, 5);
    const price = last?.close ?? 0;
    const marketValue = toPortfolio(holding.units, price, holding.trading_currency, plan.currency, fx);
    total += marketValue;
    let coreAlternative: AlertHolding["coreAlternative"];
    if (holding.core_alternative) {
      const [symbol, name] = holding.core_alternative.split("|");
      if (symbol && name) coreAlternative = { symbol, name };
    }
    alertHoldings.push({
      id: holding.instrument_id,
      symbol: holding.symbol,
      name: holding.name,
      assetClass: holding.asset_class,
      role: holding.role,
      marketValue,
      price,
      price5Ago: prior?.close ?? null,
      coreAlternative,
    });
  }

  const sentiments = [];
  const today = bangkokToday();
  for (const holding of holdings) {
    const news = db
      .prepare("SELECT published_at, sentiment FROM news_items WHERE symbol = ? ORDER BY published_at ASC")
      .all(holding.symbol) as { published_at: string; sentiment: number }[];
    const window = aggregateSentiment(
      news.map((item) => ({ publishedAt: item.published_at, sentiment: item.sentiment })),
      today,
    );
    if (window) {
      sentiments.push({ symbol: holding.symbol, latest: window.latest, previous: window.previous });
    }
  }

  const drafts = evaluateAlerts({
    totalValue: total,
    targets: { ...emptyWeights(), ...targets },
    holdings: alertHoldings,
    sentiments,
    currency: plan.currency,
    monthlyContribution: plan.monthlyContribution,
    thresholds: settings
      ? {
          priceMovePct: settings.price_move_pct,
          driftPp: settings.drift_pp,
          sentimentDelta: settings.sentiment_delta,
        }
      : DEFAULT_THRESHOLDS,
  });

  const dismissed = new Set(
    (
      db
        .prepare("SELECT dedupe_key FROM alerts WHERE portfolio_id = ? AND dismissed = 1")
        .all(portfolioId) as { dedupe_key: string }[]
    ).map((row) => row.dedupe_key),
  );
  db.prepare("DELETE FROM alerts WHERE portfolio_id = ? AND dismissed = 0").run(portfolioId);
  db.prepare("DELETE FROM outbox WHERE user_id = ? AND alert_id NOT IN (SELECT id FROM alerts)").run(userId);

  const insert = db.prepare(
    `INSERT INTO alerts (
      id, user_id, portfolio_id, dedupe_key, kind, severity, symbol, asset_class,
      title, reasoning, action, action_detail, created_at, dismissed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  );
  const now = new Date().toISOString();
  for (const draft of drafts) {
    if (dismissed.has(draft.dedupeKey)) continue;
    const id = crypto.randomUUID();
    insert.run(
      id,
      userId,
      portfolioId,
      draft.dedupeKey,
      draft.kind,
      draft.severity,
      draft.symbol,
      draft.assetClass,
      draft.title,
      draft.reasoning,
      draft.action,
      draft.actionDetail,
      now,
    );
    const deliveries = dispatchNotification({
      userId,
      alertId: id,
      title: draft.title,
      body: draft.actionDetail,
    });
    const outbox = db.prepare(
      `INSERT INTO outbox (id, user_id, alert_id, channel, status, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const delivery of deliveries) {
      outbox.run(crypto.randomUUID(), userId, id, delivery.channel, delivery.status, delivery.detail, now);
    }
  }
}
