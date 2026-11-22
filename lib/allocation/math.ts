import { ASSET_CLASSES } from "./types";
import type { AssetClass, Weights } from "./types";
import { ASSUMPTIONS, CORRELATION } from "./assumptions";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length;
  const lower = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = 0;
      for (let k = 0; k < j; k += 1) sum += lower[i][k] * lower[j][k];
      if (i === j) {
        const diag = matrix[i][i] - sum;
        if (diag <= 1e-12) {
          throw new Error("Correlation matrix is not positive definite");
        }
        lower[i][j] = Math.sqrt(diag);
      } else {
        lower[i][j] = (matrix[i][j] - sum) / lower[j][j];
      }
    }
  }
  return lower;
}

export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

export function weightVector(
  weights: Weights,
  returns: Partial<Record<AssetClass, number>> = {},
  vols: Partial<Record<AssetClass, number>> = {},
): { w: number[]; mu: number[]; sig: number[] } {
  const w = ASSET_CLASSES.map((key) => weights[key]);
  const mu = ASSET_CLASSES.map(
    (key) => returns[key] ?? ASSUMPTIONS[key].expectedReturn,
  );
  const sig = ASSET_CLASSES.map(
    (key) => vols[key] ?? ASSUMPTIONS[key].volatility,
  );
  return { w, mu, sig };
}

export function portfolioReturn(
  weights: Weights,
  returns?: Partial<Record<AssetClass, number>>,
): number {
  const { w, mu } = weightVector(weights, returns);
  return dot(w, mu);
}

export function portfolioVariance(
  weights: Weights,
  vols?: Partial<Record<AssetClass, number>>,
  correlation: number[][] = CORRELATION,
): number {
  const { w, sig } = weightVector(weights, {}, vols);
  let variance = 0;
  for (let i = 0; i < w.length; i += 1) {
    for (let j = 0; j < w.length; j += 1) {
      variance += w[i] * w[j] * correlation[i][j] * sig[i] * sig[j];
    }
  }
  return variance;
}

export function portfolioVolatility(
  weights: Weights,
  vols?: Partial<Record<AssetClass, number>>,
): number {
  return Math.sqrt(Math.max(0, portfolioVariance(weights, vols)));
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  if (next === undefined) return sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randn(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
