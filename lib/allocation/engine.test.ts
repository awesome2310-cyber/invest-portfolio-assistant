import { describe, expect, it } from "vitest";
import { CORRELATION, sumWeights } from "./assumptions";
import { buildAllocation, profileFor } from "./engine";
import { cholesky, portfolioVolatility } from "./math";
import { projectPortfolio } from "./montecarlo";
import { buildPlan } from "./index";
import type { AssetClass, PlanInput, Weights } from "./types";
import { ASSET_CLASSES } from "./types";

function base(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    timelineYears: 12,
    amount: 2_500_000,
    currency: "THB",
    riskScore: 64,
    monthlyContribution: 15_000,
    marketPreference: "balanced",
    taxWrapper: "none",
    ...overrides,
  };
}

function equity(weights: Weights): number {
  return weights.thai_equity + weights.global_equity + weights.em_equity;
}

describe("allocation", () => {
  it("keeps every mix fully invested and long-only", () => {
    for (const score of [0, 17, 33, 50, 64, 88, 100]) {
      for (const years of [1, 2, 5, 10, 12, 30, 40]) {
        for (const marketPreference of ["thai", "balanced", "global"] as const) {
          const allocation = buildAllocation({
            timelineYears: years,
            riskScore: score,
            marketPreference,
          });
          expect(sumWeights(allocation.weights)).toBeCloseTo(1, 8);
          for (const key of ASSET_CLASSES) {
            expect(allocation.weights[key]).toBeGreaterThanOrEqual(-1e-10);
            expect(allocation.weights[key]).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("raises equity as the risk score rises", () => {
    const books = [0, 25, 50, 75, 100].map((riskScore) =>
      equity(
        buildAllocation({
          timelineYears: 15,
          riskScore,
          marketPreference: "balanced",
        }).weights,
      ),
    );
    for (let i = 1; i < books.length; i += 1) {
      expect(books[i]).toBeGreaterThan(books[i - 1]);
    }
  });

  it("raises equity as the timeline lengthens", () => {
    const short = equity(
      buildAllocation({ timelineYears: 2, riskScore: 60, marketPreference: "balanced" }).weights,
    );
    const medium = equity(
      buildAllocation({ timelineYears: 10, riskScore: 60, marketPreference: "balanced" }).weights,
    );
    const long = equity(
      buildAllocation({ timelineYears: 30, riskScore: 60, marketPreference: "balanced" }).weights,
    );
    expect(medium).toBeGreaterThan(short);
    expect(long).toBeGreaterThanOrEqual(medium - 1e-6);
  });

  it("keeps a two-year book mostly defensive even if the score is aggressive", () => {
    const allocation = buildAllocation({
      timelineYears: 2,
      riskScore: 95,
      marketPreference: "balanced",
    });
    expect(allocation.defensiveWeight).toBeGreaterThanOrEqual(0.45);
    expect(allocation.weights.cash).toBeGreaterThanOrEqual(0.12);
  });

  it("tilts Thai equities when the preference says so", () => {
    const thai = buildAllocation({
      timelineYears: 12,
      riskScore: 55,
      marketPreference: "thai",
    });
    const global = buildAllocation({
      timelineYears: 12,
      riskScore: 55,
      marketPreference: "global",
    });
    expect(thai.weights.thai_equity).toBeGreaterThan(global.weights.thai_equity);
    expect(global.weights.global_equity).toBeGreaterThan(thai.weights.global_equity);
  });

  it("keeps expected return inside the asset range and volatility below the riskiest sleeve", () => {
    const allocation = buildAllocation({
      timelineYears: 12,
      riskScore: 64,
      marketPreference: "balanced",
    });
    expect(allocation.expectedReturn).toBeGreaterThan(0.02);
    expect(allocation.expectedReturn).toBeLessThan(0.095);
    expect(allocation.volatility).toBeGreaterThan(0);
    expect(allocation.volatility).toBeLessThan(0.22);
    expect(allocation.profile).toBe("growth");
  });

  it("matches a hand-computed two-asset volatility", () => {
    const weights = {
      thai_equity: 0.5,
      global_equity: 0.5,
      em_equity: 0,
      bonds: 0,
      gold: 0,
      reit: 0,
      cash: 0,
    };
    const volThai = 0.18;
    const volGlobal = 0.16;
    const corr = 0.55;
    const expected = Math.sqrt(
      0.25 * volThai ** 2 + 0.25 * volGlobal ** 2 + 2 * 0.5 * 0.5 * corr * volThai * volGlobal,
    );
    const vols: Partial<Record<AssetClass, number>> = {
      thai_equity: volThai,
      global_equity: volGlobal,
    };
    expect(portfolioVolatility(weights, vols)).toBeCloseTo(expected, 8);
  });

  it("gives the calmer sleeve more weight when its volatility is overridden", () => {
    const calm = buildAllocation(
      { timelineYears: 15, riskScore: 70, marketPreference: "balanced" },
      { vols: { thai_equity: 0.08, global_equity: 0.4 } },
    );
    const baseBook = buildAllocation({
      timelineYears: 15,
      riskScore: 70,
      marketPreference: "balanced",
    });
    const calmRatio = calm.weights.thai_equity / calm.weights.global_equity;
    const baseRatio = baseBook.weights.thai_equity / baseBook.weights.global_equity;
    expect(calmRatio).toBeGreaterThan(baseRatio);
  });

  it("lifts expected return as the score rises", () => {
    const low = buildAllocation({
      timelineYears: 15,
      riskScore: 10,
      marketPreference: "balanced",
    }).expectedReturn;
    const mid = buildAllocation({
      timelineYears: 15,
      riskScore: 50,
      marketPreference: "balanced",
    }).expectedReturn;
    const high = buildAllocation({
      timelineYears: 15,
      riskScore: 90,
      marketPreference: "balanced",
    }).expectedReturn;
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it("warns when a short aggressive book cannot reach the slider", () => {
    const allocation = buildAllocation({
      timelineYears: 1,
      riskScore: 100,
      marketPreference: "balanced",
    });
    expect(allocation.warnings.some((line) => line.includes("slider"))).toBe(true);
    expect(allocation.warnings.some((line) => line.includes("uncomfortable"))).toBe(true);
    expect(profileFor(100)).toBe("aggressive");
  });

  it("accepts the planning correlation matrix", () => {
    expect(() => cholesky(CORRELATION)).not.toThrow();
  });
});

describe("monte carlo", () => {
  it("orders the fan and repeats a seed", () => {
    const plan = base({ timelineYears: 10, monthlyContribution: 0 });
    const first = projectPortfolio(plan, { paths: 80, seed: 7 });
    const second = projectPortfolio(plan, { paths: 80, seed: 7 });
    expect(first.points).toHaveLength(121);
    const last = first.points[first.points.length - 1];
    expect(last.p10).toBeLessThan(last.p50);
    expect(last.p50).toBeLessThan(last.p90);
    expect(first.medianMaxDrawdown).toBeLessThan(0);
    expect(first.severeMaxDrawdown).toBeLessThanOrEqual(first.medianMaxDrawdown);
    expect(last.p50).toBeCloseTo(second.terminal.p50, 6);
  });

  it("raises terminal wealth when contributions are added", () => {
    const without = projectPortfolio(base({ monthlyContribution: 0, timelineYears: 8 }), {
      paths: 60,
      seed: 3,
    });
    const withCash = projectPortfolio(base({ monthlyContribution: 20_000, timelineYears: 8 }), {
      paths: 60,
      seed: 3,
    });
    expect(withCash.terminal.p50).toBeGreaterThan(without.terminal.p50);
  });
});

describe("instruments", () => {
  it("spends the whole amount and respects SET board lots", () => {
    const plan = buildPlan(base(), { includeProjection: false });
    const spent = plan.instruments.reduce((sum, line) => sum + line.amount, 0);
    expect(spent).toBeCloseTo(plan.input.amount, 0);
    for (const line of plan.instruments) {
      if (line.listing === "SET") {
        expect(line.units % 100).toBe(0);
        expect(line.units).toBeGreaterThan(0);
      }
    }
    expect(plan.instruments.some((line) => line.symbol === "TDEX.BK")).toBe(true);
    expect(plan.instruments.some((line) => line.symbol === "K-US500X-A(A)")).toBe(true);
    expect(plan.instruments.some((line) => line.id === "voo")).toBe(true);
  });

  it("caps the ThaiESG line at 300,000 baht", () => {
    const plan = buildPlan(base({ taxWrapper: "thaiesg", riskScore: 40 }), {
      includeProjection: false,
    });
    const esg = plan.instruments.find((line) => line.id === "scbtp-thaiesg");
    expect(esg).toBeTruthy();
    expect(esg!.amount).toBeLessThanOrEqual(300_000 + 1);
    expect(esg!.amount).toBeGreaterThan(100_000);
    expect(plan.warnings.some((line) => line.includes("31 Dec 2026"))).toBe(true);
  });

  it("does not invent an SSF fund", () => {
    const plan = buildPlan(base({ taxWrapper: "ssf" }), { includeProjection: false });
    expect(plan.instruments.some((line) => line.symbol.includes("SSF"))).toBe(false);
    expect(plan.warnings.some((line) => line.includes("not deductible"))).toBe(true);
  });

  it("keeps the confirmed bond fund when RMF is selected", () => {
    const plan = buildPlan(base({ taxWrapper: "rmf", riskScore: 20, timelineYears: 20 }), {
      includeProjection: false,
    });
    expect(plan.instruments.some((line) => line.symbol === "K-FIXED-A")).toBe(true);
    expect(plan.warnings.some((line) => line.includes("500,000"))).toBe(true);
  });

  it("skips a board lot the account cannot afford", () => {
    const plan = buildPlan(
      base({ amount: 80_000, riskScore: 90, timelineYears: 20, monthlyContribution: 0 }),
      { includeProjection: false },
    );
    expect(plan.instruments.some((line) => line.symbol === "ADVANC.BK")).toBe(false);
    const spent = plan.instruments.reduce((sum, line) => sum + line.amount, 0);
    expect(spent).toBeCloseTo(80_000, 0);
  });

  it("converts a dollar account without changing the mix", () => {
    const thb = buildAllocation({
      timelineYears: 12,
      riskScore: 50,
      marketPreference: "balanced",
    });
    const usd = buildPlan(
      base({
        amount: 50_000,
        currency: "USD",
        riskScore: 50,
        monthlyContribution: 0,
        timelineYears: 12,
      }),
      { includeProjection: false, fx: 34 },
    );
    expect(usd.allocation.weights.global_equity).toBeCloseTo(thb.weights.global_equity, 8);
    const voo = usd.instruments.find((line) => line.id === "voo");
    expect(voo).toBeTruthy();
    expect(voo!.units).toBeGreaterThan(0);
    expect(voo!.tradingCurrency).toBe("USD");
  });
});
