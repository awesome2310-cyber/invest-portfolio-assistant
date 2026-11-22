import { ASSUMPTIONS, GROWTH_ASSETS, METHOD_ID, STRATEGIC_KNOTS, cloneWeights, sumWeights } from "./assumptions";
import { clamp, portfolioReturn, portfolioVolatility } from "./math";
import { ASSET_CLASSES } from "./types";
import type { Allocation, AssetClass, PlanInput, RiskProfile, Weights } from "./types";

const RISKY: AssetClass[] = ASSET_CLASSES.filter((key) => key !== "cash");

export function profileFor(score: number): RiskProfile {
  if (score < 20) return "conservative";
  if (score < 40) return "moderate";
  if (score < 60) return "balanced";
  if (score < 80) return "growth";
  return "aggressive";
}

export function targetReturnFor(score: number): number {
  return 0.035 + 0.075 * (clamp(score, 0, 100) / 100);
}

export function timelineScale(years: number): number {
  if (years <= 2) return 0.5;
  if (years <= 5) return 0.72;
  if (years <= 10) return 1;
  if (years <= 20) return 1.06;
  return 1.1;
}

export function strategicWeights(score: number): Weights {
  const s = clamp(score, 0, 100);
  let index = 0;
  while (
    index < STRATEGIC_KNOTS.length - 2 &&
    s > STRATEGIC_KNOTS[index + 1].score
  ) {
    index += 1;
  }
  const left = STRATEGIC_KNOTS[index];
  const right = STRATEGIC_KNOTS[index + 1];
  const span = right.score - left.score;
  const t = span === 0 ? 0 : (s - left.score) / span;
  const weights = cloneWeights(left.weights);
  for (const key of ASSET_CLASSES) {
    weights[key] = left.weights[key] * (1 - t) + right.weights[key] * t;
  }
  return weights;
}

function shiftWeight(
  weights: Weights,
  to: AssetClass,
  amount: number,
  from: AssetClass[],
) {
  if (amount <= 0) return;
  const available = from.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);
  const take = Math.min(amount, available);
  if (take <= 0) return;
  for (const key of from) {
    const portion = (Math.max(0, weights[key]) / available) * take;
    weights[key] -= portion;
  }
  weights[to] += take;
}

function applyTimeline(weights: Weights, years: number): number {
  const scale = timelineScale(years);
  for (const key of GROWTH_ASSETS) weights[key] *= scale;
  const residual = 1 - sumWeights(weights);
  if (residual > 0) {
    weights.bonds += residual * 0.65;
    weights.cash += residual * 0.35;
  } else if (residual < 0) {
    let need = -residual;
    const fromBonds = Math.min(weights.bonds, need);
    weights.bonds -= fromBonds;
    need -= fromBonds;
    const fromCash = Math.min(weights.cash, need);
    weights.cash -= fromCash;
    need -= fromCash;
    if (need > 1e-8) {
      const total = sumWeights(weights);
      for (const key of ASSET_CLASSES) weights[key] /= total;
    }
  }
  return scale;
}

function blendRiskParity(
  weights: Weights,
  vols: Partial<Record<AssetClass, number>>,
): void {
  const cash = weights.cash;
  const budget = Math.max(0, 1 - cash);
  const strategicSum = RISKY.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);
  let inverseSum = 0;
  const inverse: Partial<Record<AssetClass, number>> = {};
  for (const key of RISKY) {
    const vol = Math.max(0.02, vols[key] ?? ASSUMPTIONS[key].volatility);
    inverse[key] = 1 / vol;
    inverseSum += inverse[key] ?? 0;
  }
  for (const key of RISKY) {
    const strategicShare = strategicSum > 0 ? Math.max(0, weights[key]) / strategicSum : 0;
    const parityShare = inverseSum > 0 ? (inverse[key] ?? 0) / inverseSum : 0;
    weights[key] = budget * (0.65 * strategicShare + 0.35 * parityShare);
  }
  weights.cash = cash;
}

function applyPreference(weights: Weights, preference: PlanInput["marketPreference"]) {
  const shift = 0.06;
  if (preference === "thai") {
    const moved = Math.min(shift, weights.global_equity);
    weights.global_equity -= moved;
    weights.thai_equity += moved;
  } else if (preference === "global") {
    const moved = Math.min(shift, weights.thai_equity);
    weights.thai_equity -= moved;
    weights.global_equity += moved;
  }
}

function foldDust(weights: Weights) {
  for (const key of RISKY) {
    if (weights[key] > 0 && weights[key] < 0.005) {
      weights.cash += weights[key];
      weights[key] = 0;
    }
  }
}

function enforceHorizon(weights: Weights, years: number) {
  const donors: AssetClass[] = [
    "thai_equity",
    "global_equity",
    "em_equity",
    "reit",
    "gold",
  ];
  if (years <= 2 && weights.cash < 0.12) {
    shiftWeight(weights, "cash", 0.12 - weights.cash, donors);
  }
  if (years <= 5 && years > 2 && weights.cash < 0.06) {
    shiftWeight(weights, "cash", 0.06 - weights.cash, donors);
  }
  if (years <= 2 && weights.bonds + weights.cash < 0.45) {
    shiftWeight(
      weights,
      "bonds",
      0.45 - (weights.bonds + weights.cash),
      donors,
    );
  }
}

export interface AllocationOptions {
  vols?: Partial<Record<AssetClass, number>>;
  returns?: Partial<Record<AssetClass, number>>;
}

export function buildAllocation(
  input: Pick<PlanInput, "timelineYears" | "riskScore" | "marketPreference">,
  options: AllocationOptions = {},
): Allocation {
  const years = clamp(Math.round(input.timelineYears), 1, 40);
  const score = clamp(input.riskScore, 0, 100);
  const profile = profileFor(score);
  const targetReturn = targetReturnFor(score);
  const weights = strategicWeights(score);
  const scale = applyTimeline(weights, years);
  blendRiskParity(weights, options.vols ?? {});
  applyPreference(weights, input.marketPreference);
  foldDust(weights);
  enforceHorizon(weights, years);

  const total = sumWeights(weights);
  if (Math.abs(total - 1) > 1e-8) {
    for (const key of ASSET_CLASSES) weights[key] /= total;
  }

  const expectedReturn = portfolioReturn(weights, options.returns);
  const volatility = portfolioVolatility(weights, options.vols);
  const cashReturn = options.returns?.cash ?? ASSUMPTIONS.cash.expectedReturn;
  const sharpe = volatility > 1e-9 ? (expectedReturn - cashReturn) / volatility : 0;
  const equityWeight = weights.thai_equity + weights.global_equity + weights.em_equity;
  const defensiveWeight = weights.bonds + weights.cash;

  const steps = [
    `Risk score ${Math.round(score)} maps to the ${profile} profile. The slider's target return is ${(targetReturn * 100).toFixed(1)}% a year. That number labels the profile. It is not a promise, and the book is never leveraged to chase it.`,
    `Start from the strategic knot for that score: a published mix of Thai equities, global equities, emerging markets, bonds, gold, property, and cash.`,
    `Timeline of ${years} year${years === 1 ? "" : "s"} multiplies the growth sleeves (Thai equities, global equities, emerging markets, property) by ${scale.toFixed(2)}. Anything left over goes to bonds and cash. Under two years, cash is kept at least at 12% and bonds plus cash at least at 45%.`,
    `Cash stays at the glide-path weight. The other sleeves are blended 65% strategic and 35% inverse-volatility, using the planning volatilities. Lower-volatility sleeves get a larger share of that 35%.`,
    input.marketPreference === "balanced"
      ? `Market preference is balanced, so no extra shift between Thai and global equities.`
      : `Market preference is ${input.marketPreference}, so 6 percentage points move between global and Thai equities, capped by what that sleeve holds.`,
    `Expected return is the weighted sum of the planning returns. Volatility is sqrt(w′ Σ w) with the fixed correlation matrix. Figures are annual and in baht terms.`,
  ];

  const warnings: string[] = [];
  if (expectedReturn + 0.004 < targetReturn) {
    warnings.push(
      `The slider reads ${(targetReturn * 100).toFixed(1)}%, and this long-only mix pencils out at about ${(expectedReturn * 100).toFixed(1)}% on the planning assumptions. The gap is the cost of staying diversified. Closing it would mean dropping the risk-parity tilt or concentrating further into equities.`,
    );
  }
  if (years <= 3 && score >= 70) {
    warnings.push(
      `A ${years}-year timeline with a ${profile} score is an uncomfortable pair. The glide path cuts growth assets so a drop early in the window has time to be a loss you actually feel. If the money is for a dated bill, use a lower score.`,
    );
  }

  return {
    weights,
    expectedReturn,
    volatility,
    sharpe,
    profile,
    targetReturn,
    equityWeight,
    defensiveWeight,
    steps,
    warnings,
    method: METHOD_ID,
  };
}

export function validatePlan(input: PlanInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.timelineYears) || input.timelineYears < 1 || input.timelineYears > 40) {
    errors.push("Timeline must be between 1 and 40 years.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1e12) {
    errors.push("Amount must be greater than zero.");
  }
  if (!Number.isFinite(input.riskScore) || input.riskScore < 0 || input.riskScore > 100) {
    errors.push("Risk score must be between 0 and 100.");
  }
  if (!Number.isFinite(input.monthlyContribution) || input.monthlyContribution < 0) {
    errors.push("Monthly contribution cannot be negative.");
  }
  if (input.currency !== "THB" && input.currency !== "USD") {
    errors.push("Currency must be THB or USD.");
  }
  if (!["thai", "balanced", "global"].includes(input.marketPreference)) {
    errors.push("Market preference is not recognised.");
  }
  if (!["none", "thaiesg", "rmf", "ssf"].includes(input.taxWrapper)) {
    errors.push("Tax wrapper is not recognised.");
  }
  return errors;
}
