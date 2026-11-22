import bcrypt from "bcryptjs";
import type { DatabaseSync } from "node:sqlite";
import { buildPlan } from "@/lib/allocation";
import { DEFAULT_FX_USDTHB } from "@/lib/allocation/assumptions";
import { CATALOG, REFERENCE_PRICES } from "@/lib/allocation/instruments";
import { hashSeed } from "@/lib/allocation/math";
import type { PlanInput } from "@/lib/allocation/types";
import { scoreHeadline } from "@/lib/sentiment/lexicon";
import { businessDaysEnding, bangkokToday, geometricToEnd, projectFromProxy, shockTail } from "@/lib/market/series";
import { rebuildAlerts } from "@/lib/server/alerts-store";
import { toPortfolio } from "@/lib/server/valuation";

const DEMO_EMAIL = "demo@sathorn.desk";
const DEMO_PASSWORD = "demo-desk";

interface Series {
  symbol: string;
  currency: string;
  bars: { date: string; close: number }[];
}

export function seedDatabase(db: DatabaseSync) {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(DEMO_EMAIL) as { id: string } | undefined;
  const priced = db.prepare("SELECT COUNT(*) AS n FROM price_bars").get() as { n: number };
  if (existing && Number(priced.n) > 0) {
    const alerts = db.prepare("SELECT COUNT(*) AS n FROM alerts").get() as { n: number };
    if (Number(alerts.n) === 0) {
      const portfolio = db
        .prepare("SELECT id, user_id FROM portfolios WHERE user_id = ?")
        .get(existing.id) as { id: string; user_id: string } | undefined;
      if (portfolio) rebuildAlerts(db, portfolio.user_id, portfolio.id);
    }
    return;
  }

  const today = bangkokToday();
  const dates = businessDaysEnding(today, 260);
  const series = new Map<string, Series>();

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
      symbol: item.symbol,
      currency: item.currency,
      bars: geometricToEnd({
        endPrice: item.end,
        annualReturn: item.ret,
        annualVol: item.vol,
        dates,
        seed: hashSeed(item.symbol),
      }),
    });
  }
  shockTail(series.get("CPNREIT.BK")!.bars, 0.11);
  shockTail(series.get("ADVANC.BK")!.bars, 0.13);

  for (const item of CATALOG) {
    if (!item.proxyYahoo) continue;
    const proxy = series.get(item.proxyYahoo);
    if (!proxy) continue;
    series.set(item.symbol, {
      symbol: item.symbol,
      currency: item.tradingCurrency,
      bars: projectFromProxy(proxy.bars, REFERENCE_PRICES[item.symbol]),
    });
  }

  const plan: PlanInput = {
    timelineYears: 12,
    amount: 2_500_000,
    currency: "THB",
    riskScore: 64,
    monthlyContribution: 15_000,
    marketPreference: "balanced",
    taxWrapper: "none",
  };
  const built = buildPlan(plan, { includeProjection: false, fx: DEFAULT_FX_USDTHB });
  const entryDate = dates[Math.max(0, dates.length - 200)];
  const units = new Map(built.instruments.map((line) => [line.id, line.units]));
  const lastClose = (symbol: string) => {
    const bars = series.get(symbol)?.bars;
    return bars ? bars[bars.length - 1].close : REFERENCE_PRICES[symbol];
  };
  const closeOn = (symbol: string, date: string) =>
    series.get(symbol)?.bars.find((bar) => bar.date === date)?.close ?? lastClose(symbol);
  const fx = lastClose("THB=X");
  const entryFx = closeOn("THB=X", entryDate);
  const valueOf = (id: string, symbol: string, trading: "THB" | "USD") =>
    toPortfolio(units.get(id) ?? 0, lastClose(symbol), trading, "THB", fx);

  let total = 0;
  let global = 0;
  for (const line of built.instruments) {
    const value = valueOf(line.id, line.symbol, line.tradingCurrency);
    total += value;
    if (line.assetClass === "global_equity") global += value;
  }
  const desired = (built.allocation.weights.global_equity + 0.06) * total;
  if (global > 0 && desired > global) {
    const factor = desired / global;
    for (const line of built.instruments) {
      if (line.assetClass === "global_equity") units.set(line.id, (units.get(line.id) ?? 0) * factor);
    }
    const bond = built.instruments.find((line) => line.id === "k-fixed");
    if (bond) {
      const unitValue = toPortfolio(1, lastClose(bond.symbol), bond.tradingCurrency, "THB", fx);
      const cut = (desired - global) / unitValue;
      units.set(bond.id, Math.max(0, (units.get(bond.id) ?? 0) - cut));
    }
  }

  const userId = crypto.randomUUID();
  const portfolioId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    const insertPrice = db.prepare(
      `INSERT INTO price_bars (symbol, date, close, currency, source)
       VALUES (?, ?, ?, ?, 'seed')
       ON CONFLICT(symbol, date) DO UPDATE SET close = excluded.close, source = 'seed'`,
    );
    for (const item of series.values()) {
      for (const bar of item.bars) insertPrice.run(item.symbol, bar.date, bar.close, item.currency);
    }

    if (!existing) {
      db.prepare(
        `INSERT INTO users (id, email, name, password_hash, is_demo, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
      ).run(userId, DEMO_EMAIL, "Demo investor", bcrypt.hashSync(DEMO_PASSWORD, 10), now);
      db.prepare(
        `INSERT INTO alert_settings (user_id, price_move_pct, drift_pp, sentiment_delta) VALUES (?, 0.08, 0.05, 0.35)`,
      ).run(userId);
      db.prepare(
        `INSERT INTO portfolios (
          id, user_id, plan_json, weights_json, metrics_json, fx, inception_date, created_at, replay
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      ).run(
        portfolioId,
        userId,
        JSON.stringify(plan),
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
        entryDate,
        now,
      );

      const insertHolding = db.prepare(
        `INSERT INTO holdings (
          id, portfolio_id, instrument_id, symbol, name, asset_class, vehicle, listing, trading_currency,
          role, yahoo_symbol, proxy_yahoo, expense_ratio, expense_note, price_note, unit_note, access_json,
          note, target_weight, amount, units, entry_price, core_alternative
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const line of built.instruments) {
        const holdingUnits = units.get(line.id) ?? line.units;
        const entryPrice = closeOn(line.symbol, entryDate);
        const amount = toPortfolio(holdingUnits, entryPrice, line.tradingCurrency, "THB", entryFx);
        insertHolding.run(
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
          amount,
          holdingUnits,
          entryPrice,
          line.role === "satellite" ? "TDEX.BK|ThaiDEX SET50 ETF" : null,
        );
      }

      const insertNews = db.prepare(
        `INSERT INTO news_items (id, symbol, title, source, url, published_at, sentiment, method, fetched_at)
         VALUES (?, ?, ?, 'Sathorn tape', NULL, ?, ?, 'lexicon', ?)`,
      );
      const samples: { symbol: string; title: string; daysAgo: number }[] = [
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
      for (const sample of samples) {
        const published = new Date(Date.now() - sample.daysAgo * 86400000).toISOString();
        insertNews.run(crypto.randomUUID(), sample.symbol, sample.title, published, scoreHeadline(sample.title), now);
      }
      db.prepare("INSERT INTO meta (key, value) VALUES ('price_source', 'seed')").run();
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  if (!existing) rebuildAlerts(db, userId, portfolioId);
}

export const DEMO_LOGIN = { email: DEMO_EMAIL, password: DEMO_PASSWORD };
