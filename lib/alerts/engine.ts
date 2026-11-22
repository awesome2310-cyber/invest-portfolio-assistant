import { ASSUMPTIONS } from "@/lib/allocation/assumptions";
import type { AssetClass, Currency, Weights } from "@/lib/allocation/types";

export interface AlertHolding {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  role: "core" | "satellite" | "residual";
  marketValue: number;
  price: number;
  price5Ago: number | null;
  coreAlternative?: { symbol: string; name: string };
}

export interface AlertSentiment {
  symbol: string;
  latest: number;
  previous: number | null;
}

export interface AlertThresholds {
  priceMovePct: number;
  driftPp: number;
  sentimentDelta: number;
}

export interface AlertDraft {
  kind: "price_move" | "drift" | "sentiment";
  severity: "watch" | "act";
  symbol: string | null;
  assetClass: AssetClass | null;
  title: string;
  reasoning: string;
  action: "hold" | "rebalance" | "swap";
  actionDetail: string;
  dedupeKey: string;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  priceMovePct: 0.08,
  driftPp: 0.05,
  sentimentDelta: 0.35,
};

function money(amount: number, currency: Currency): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(amount) >= 1000 ? 0 : 2,
  }).format(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : formatted;
}

function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function classLabel(asset: AssetClass): string {
  const label = ASSUMPTIONS[asset].label;
  return label.startsWith("Thai") ? label : label.toLowerCase();
}

export function evaluateAlerts(input: {
  totalValue: number;
  targets: Weights;
  holdings: AlertHolding[];
  sentiments: AlertSentiment[];
  thresholds?: Partial<AlertThresholds>;
  currency: Currency;
  monthlyContribution: number;
}): AlertDraft[] {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const alerts: AlertDraft[] = [];
  const total = input.totalValue;
  if (!(total > 0)) return alerts;

  const sentimentBySymbol = new Map(input.sentiments.map((row) => [row.symbol, row]));
  const swapSymbols = new Set<string>();

  for (const holding of input.holdings) {
    if (holding.role !== "satellite" || !holding.coreAlternative) continue;
    if (holding.price5Ago == null || holding.price5Ago <= 0) continue;
    const move = holding.price / holding.price5Ago - 1;
    const sentiment = sentimentBySymbol.get(holding.symbol);
    if (
      move <= -thresholds.priceMovePct &&
      sentiment &&
      sentiment.latest <= -0.45 &&
      (sentiment.previous == null || sentiment.latest - sentiment.previous <= -thresholds.sentimentDelta)
    ) {
      swapSymbols.add(holding.symbol);
      alerts.push({
        kind: "sentiment",
        severity: "act",
        symbol: holding.symbol,
        assetClass: holding.assetClass,
        title: `${holding.symbol} is a satellite that is breaking down`,
        reasoning: `${holding.name} is down ${pct(move)} over five sessions, and the news-tone score is ${sentiment.latest.toFixed(2)} on a scale from -1 to 1${
          sentiment.previous == null ? "" : ` (previously ${sentiment.previous.toFixed(2)})`
        }. Tone is not a valuation. It is a reason to stop holding a single name when the sleeve already has a broad fund.`,
        action: "swap",
        actionDetail: `Sell the ${holding.symbol} line, about ${money(holding.marketValue, input.currency)}, and buy ${holding.coreAlternative.symbol} (${holding.coreAlternative.name}). The ${classLabel(holding.assetClass)} weight stays. Only the single-name bet is removed.`,
        dedupeKey: `swap:${holding.symbol}`,
      });
    }
  }

  for (const holding of input.holdings) {
    if (swapSymbols.has(holding.symbol)) continue;
    if (holding.price5Ago == null || holding.price5Ago <= 0) continue;
    const move = holding.price / holding.price5Ago - 1;
    if (Math.abs(move) < thresholds.priceMovePct) continue;
    alerts.push({
      kind: "price_move",
      severity: Math.abs(move) >= thresholds.priceMovePct * 2 ? "act" : "watch",
      symbol: holding.symbol,
      assetClass: holding.assetClass,
      title: `${holding.symbol} moved ${pct(move)} in five sessions`,
      reasoning: `${holding.name} went from ${holding.price5Ago.toLocaleString("en-US")} to ${holding.price.toLocaleString("en-US")}. A move of this size is inside what a listed fund or trust does in a noisy week. It is not, on its own, a reason to change the mix you chose.`,
      action: "hold",
      actionDetail: `Keep ${holding.symbol}. Look at the drift panel before you sell. If the sleeve is still inside the ${pct(thresholds.driftPp, 0)} band, doing nothing is the action.`,
      dedupeKey: `price:${holding.symbol}`,
    });
  }

  const current: Partial<Record<AssetClass, number>> = {};
  for (const holding of input.holdings) {
    current[holding.assetClass] = (current[holding.assetClass] ?? 0) + holding.marketValue;
  }
  const drifts = (Object.keys(input.targets) as AssetClass[]).map((asset) => {
    const weight = (current[asset] ?? 0) / total;
    return { asset, target: input.targets[asset], current: weight, drift: weight - input.targets[asset] };
  });
  const breached = drifts.filter((row) => Math.abs(row.drift) >= thresholds.driftPp);
  if (breached.length) {
    const lead = [...breached].sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))[0];
    const counterpartPool = drifts.filter((row) => row.asset !== lead.asset);
    const counterpart = [...counterpartPool].sort((a, b) => {
      const aScore = lead.drift > 0 ? a.drift : -a.drift;
      const bScore = lead.drift > 0 ? b.drift : -b.drift;
      return aScore - bScore;
    })[0];
    const trade = Math.abs(lead.drift) * total;
    const months =
      input.monthlyContribution > 0 ? Math.ceil(trade / input.monthlyContribution) : null;
    const direction = lead.drift > 0 ? "overweight" : "underweight";
    const verb = lead.drift > 0 ? "trim" : "top up";
    alerts.push({
      kind: "drift",
      severity: "act",
      symbol: null,
      assetClass: lead.asset,
      title: `${ASSUMPTIONS[lead.asset].label} is ${pct(Math.abs(lead.drift))} ${direction}`,
      reasoning: `Target weight is ${pct(lead.target)}. The market value is ${pct(lead.current)}. The gap is past your ${pct(thresholds.driftPp, 0)} band. ${
        counterpart
          ? `${ASSUMPTIONS[counterpart.asset].label} is the other side of the trade, at ${pct(counterpart.current)} against a ${pct(counterpart.target)} target.`
          : ""
      } New contributions can do this slowly. A sale does it today.`,
      action: "rebalance",
      actionDetail: `${verb[0].toUpperCase()}${verb.slice(1)} about ${money(trade, input.currency)} of ${classLabel(lead.asset)}${
        counterpart ? ` and move it to ${classLabel(counterpart.asset)}` : ""
      }.${
        months
          ? ` At ${money(input.monthlyContribution, input.currency)} a month, pointing the next ${months} contribution${months === 1 ? "" : "s"} at the light sleeve covers most of it without a sale.`
          : ""
      }`,
      dedupeKey: `drift:${lead.asset}`,
    });
  }

  for (const holding of input.holdings) {
    if (swapSymbols.has(holding.symbol)) continue;
    const sentiment = sentimentBySymbol.get(holding.symbol);
    if (!sentiment || sentiment.previous == null) continue;
    const delta = sentiment.latest - sentiment.previous;
    if (Math.abs(delta) < thresholds.sentimentDelta) continue;
    alerts.push({
      kind: "sentiment",
      severity: "watch",
      symbol: holding.symbol,
      assetClass: holding.assetClass,
      title: `News tone on ${holding.symbol} shifted by ${delta > 0 ? "+" : ""}${delta.toFixed(2)}`,
      reasoning: `The headline score moved from ${sentiment.previous.toFixed(2)} to ${sentiment.latest.toFixed(2)}. The score is a word count on recent headlines, or an optional model if a key is configured. It is not a price target, and a tone shift without a broken allocation is a weak reason to trade.`,
      action: "hold",
      actionDetail: `Hold ${holding.symbol}. Read the headlines on the holding page. Trade only if the drift band is also broken, or if this is a satellite you no longer want.`,
      dedupeKey: `sentiment:${holding.symbol}`,
    });
  }

  return alerts;
}
