import { ASSUMPTIONS, CORRELATION } from "./assumptions";
import { buildAllocation } from "./engine";
import { cholesky, hashSeed, mulberry32, quantile, randn } from "./math";
import { ASSET_CLASSES } from "./types";
import type { AssetClass, PlanInput, Projection, ProjectionPoint } from "./types";

export interface ProjectionOptions {
  paths?: number;
  seed?: number;
  vols?: Partial<Record<AssetClass, number>>;
  returns?: Partial<Record<AssetClass, number>>;
}

/**
 * Constant-mix Monte Carlo. Each month draws a correlated normal return for
 * the seven sleeves, applies it to the whole pot, then adds the contribution.
 * The mix is reset every month, which matches the rebalance rule rather than
 * a buy-and-hold path.
 */
export function projectPortfolio(
  input: Pick<
    PlanInput,
    "timelineYears" | "amount" | "riskScore" | "marketPreference" | "monthlyContribution"
  >,
  options: ProjectionOptions = {},
): Projection {
  const allocation = buildAllocation(input, options);
  const years = Math.max(1, Math.min(40, Math.round(input.timelineYears)));
  const months = years * 12;
  const paths = options.paths ?? 400;
  const seed =
    options.seed ??
    hashSeed(
      JSON.stringify({
        years,
        amount: input.amount,
        score: input.riskScore,
        pref: input.marketPreference,
        contribution: input.monthlyContribution,
      }),
    );
  const rng = mulberry32(seed);
  const lower = cholesky(CORRELATION);
  const mu = ASSET_CLASSES.map(
    (key) => options.returns?.[key] ?? ASSUMPTIONS[key].expectedReturn,
  );
  const sig = ASSET_CLASSES.map(
    (key) => options.vols?.[key] ?? ASSUMPTIONS[key].volatility,
  );
  const weights = ASSET_CLASSES.map((key) => allocation.weights[key]);
  const wealth = new Float64Array(paths);
  const peak = new Float64Array(paths);
  const maxDrawdown = new Float64Array(paths);
  wealth.fill(input.amount);
  peak.fill(input.amount);

  const points: ProjectionPoint[] = [
    {
      month: 0,
      p10: input.amount,
      p25: input.amount,
      p50: input.amount,
      p75: input.amount,
      p90: input.amount,
    },
  ];

  const contribution = Math.max(0, input.monthlyContribution || 0);
  const scratch = new Array<number>(paths);

  for (let month = 1; month <= months; month += 1) {
    for (let path = 0; path < paths; path += 1) {
      let portfolioMonth = 0;
      const z = [0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 7; i += 1) z[i] = randn(rng);
      for (let i = 0; i < 7; i += 1) {
        let correlated = 0;
        for (let k = 0; k <= i; k += 1) correlated += lower[i][k] * z[k];
        const monthlyVol = sig[i] / Math.sqrt(12);
        const monthlyMean = mu[i] / 12;
        const shock = Math.max(-0.85, monthlyMean + monthlyVol * correlated);
        portfolioMonth += weights[i] * shock;
      }
      const next = wealth[path] * (1 + portfolioMonth) + contribution;
      wealth[path] = next > 0 ? next : 0;
      if (wealth[path] > peak[path]) peak[path] = wealth[path];
      const drawdown = peak[path] > 0 ? wealth[path] / peak[path] - 1 : 0;
      if (drawdown < maxDrawdown[path]) maxDrawdown[path] = drawdown;
      scratch[path] = wealth[path];
    }
    const sorted = scratch.slice().sort((a, b) => a - b);
    points.push({
      month,
      p10: quantile(sorted, 0.1),
      p25: quantile(sorted, 0.25),
      p50: quantile(sorted, 0.5),
      p75: quantile(sorted, 0.75),
      p90: quantile(sorted, 0.9),
    });
  }

  const drawdowns = Array.from(maxDrawdown).sort((a, b) => a - b);
  const last = points[points.length - 1];
  return {
    points,
    medianMaxDrawdown: quantile(drawdowns, 0.5),
    severeMaxDrawdown: quantile(drawdowns, 0.05),
    terminal: { p10: last.p10, p50: last.p50, p90: last.p90 },
    paths,
    rebalancedMonthly: true,
  };
}
