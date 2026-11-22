import type { AssetAssumption, AssetClass, Weights } from "./types";
import { ASSET_CLASSES } from "./types";

/**
 * Long-run planning assumptions in baht terms for a Bangkok investor.
 * They are rounded capital-market priors, not a forecast and not a fit to
 * one sample window. Live prices can tilt volatility slightly at refresh
 * time; the correlation matrix stays this one so the mix stays explainable.
 */
export const ASSUMPTIONS: Record<AssetClass, AssetAssumption> = {
  thai_equity: {
    id: "thai_equity",
    label: "Thai equities",
    expectedReturn: 0.08,
    volatility: 0.18,
    maxDrawdown: -0.45,
  },
  global_equity: {
    id: "global_equity",
    label: "Global equities",
    expectedReturn: 0.09,
    volatility: 0.16,
    maxDrawdown: -0.5,
  },
  em_equity: {
    id: "em_equity",
    label: "Emerging markets",
    expectedReturn: 0.095,
    volatility: 0.22,
    maxDrawdown: -0.55,
  },
  bonds: {
    id: "bonds",
    label: "Bonds",
    expectedReturn: 0.038,
    volatility: 0.055,
    maxDrawdown: -0.12,
  },
  gold: {
    id: "gold",
    label: "Gold",
    expectedReturn: 0.06,
    volatility: 0.15,
    maxDrawdown: -0.3,
  },
  reit: {
    id: "reit",
    label: "Property",
    expectedReturn: 0.07,
    volatility: 0.17,
    maxDrawdown: -0.4,
  },
  cash: {
    id: "cash",
    label: "Cash",
    expectedReturn: 0.02,
    volatility: 0.006,
    maxDrawdown: 0,
  },
};

/** Illustrative correlations. Cash is nearly independent on purpose. */
export const CORRELATION: number[][] = [
  [1, 0.55, 0.62, 0.12, 0.05, 0.48, 0],
  [0.55, 1, 0.72, 0.18, 0.06, 0.55, 0],
  [0.62, 0.72, 1, 0.12, 0.1, 0.45, 0],
  [0.12, 0.18, 0.12, 1, 0.2, 0.28, 0.05],
  [0.05, 0.06, 0.1, 0.2, 1, 0.08, 0],
  [0.48, 0.55, 0.45, 0.28, 0.08, 1, 0],
  [0, 0, 0, 0.05, 0, 0, 1],
];

/**
 * Strategic knots. Score is interpolated between these books, then a glide
 * path and a risk-parity tilt are applied. Each row sums to 1.
 */
export const STRATEGIC_KNOTS: { score: number; weights: Weights }[] = [
  {
    score: 0,
    weights: {
      thai_equity: 0.05,
      global_equity: 0.08,
      em_equity: 0,
      bonds: 0.52,
      gold: 0.07,
      reit: 0.03,
      cash: 0.25,
    },
  },
  {
    score: 25,
    weights: {
      thai_equity: 0.12,
      global_equity: 0.2,
      em_equity: 0.04,
      bonds: 0.4,
      gold: 0.08,
      reit: 0.06,
      cash: 0.1,
    },
  },
  {
    score: 50,
    weights: {
      thai_equity: 0.16,
      global_equity: 0.32,
      em_equity: 0.08,
      bonds: 0.24,
      gold: 0.08,
      reit: 0.07,
      cash: 0.05,
    },
  },
  {
    score: 75,
    weights: {
      thai_equity: 0.2,
      global_equity: 0.4,
      em_equity: 0.12,
      bonds: 0.12,
      gold: 0.07,
      reit: 0.06,
      cash: 0.03,
    },
  },
  {
    score: 100,
    weights: {
      thai_equity: 0.22,
      global_equity: 0.46,
      em_equity: 0.16,
      bonds: 0.05,
      gold: 0.06,
      reit: 0.04,
      cash: 0.01,
    },
  },
];

export const GROWTH_ASSETS: AssetClass[] = [
  "thai_equity",
  "global_equity",
  "em_equity",
  "reit",
];

export const METHOD_ID = "glide-path-plus-risk-parity-v1";

export const DEFAULT_FX_USDTHB = 33.96;

export function emptyWeights(): Weights {
  return {
    thai_equity: 0,
    global_equity: 0,
    em_equity: 0,
    bonds: 0,
    gold: 0,
    reit: 0,
    cash: 0,
  };
}

export function sumWeights(weights: Weights): number {
  return ASSET_CLASSES.reduce((sum, key) => sum + weights[key], 0);
}

export function cloneWeights(weights: Weights): Weights {
  return { ...weights };
}
