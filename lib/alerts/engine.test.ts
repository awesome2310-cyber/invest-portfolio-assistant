import { describe, expect, it } from "vitest";
import { evaluateAlerts } from "./engine";
import type { AlertHolding } from "./engine";
import { emptyWeights } from "@/lib/allocation/assumptions";

function holding(overrides: Partial<AlertHolding> & Pick<AlertHolding, "symbol" | "assetClass">): AlertHolding {
  return {
    id: overrides.symbol,
    name: overrides.name ?? overrides.symbol,
    role: "core",
    marketValue: 100_000,
    price: 10,
    price5Ago: 10,
    ...overrides,
  };
}

describe("alerts", () => {
  it("asks for a rebalance when a sleeve leaves the band", () => {
    const targets = emptyWeights();
    targets.global_equity = 0.4;
    targets.bonds = 0.3;
    targets.thai_equity = 0.2;
    targets.cash = 0.1;
    const alerts = evaluateAlerts({
      totalValue: 1_000_000,
      targets,
      currency: "THB",
      monthlyContribution: 10_000,
      holdings: [
        holding({ symbol: "VOO", assetClass: "global_equity", marketValue: 500_000 }),
        holding({ symbol: "K-FIXED-A", assetClass: "bonds", marketValue: 200_000 }),
        holding({ symbol: "TDEX.BK", assetClass: "thai_equity", marketValue: 200_000 }),
        holding({ symbol: "K-CASH", assetClass: "cash", marketValue: 100_000 }),
      ],
      sentiments: [],
    });
    const drift = alerts.find((alert) => alert.kind === "drift");
    expect(drift?.action).toBe("rebalance");
    expect(drift?.assetClass).toBe("global_equity");
    expect(drift?.actionDetail).toContain("100,000");
    expect(drift?.actionDetail.toLowerCase()).toContain("bond");
  });

  it("stays quiet inside the band", () => {
    const targets = emptyWeights();
    targets.global_equity = 0.5;
    targets.bonds = 0.5;
    const alerts = evaluateAlerts({
      totalValue: 1_000_000,
      targets,
      currency: "THB",
      monthlyContribution: 0,
      holdings: [
        holding({ symbol: "VOO", assetClass: "global_equity", marketValue: 520_000 }),
        holding({ symbol: "K-FIXED-A", assetClass: "bonds", marketValue: 480_000 }),
      ],
      sentiments: [],
    });
    expect(alerts).toHaveLength(0);
  });

  it("holds through a price swing that does not break the mix", () => {
    const targets = emptyWeights();
    targets.reit = 1;
    const alerts = evaluateAlerts({
      totalValue: 100_000,
      targets,
      currency: "THB",
      monthlyContribution: 0,
      holdings: [
        holding({
          symbol: "CPNREIT.BK",
          assetClass: "reit",
          marketValue: 100_000,
          price: 11.5,
          price5Ago: 13,
        }),
      ],
      sentiments: [],
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].action).toBe("hold");
    expect(alerts[0].kind).toBe("price_move");
  });

  it("swaps a satellite that is falling with ugly headlines", () => {
    const targets = emptyWeights();
    targets.thai_equity = 1;
    const alerts = evaluateAlerts({
      totalValue: 200_000,
      targets,
      currency: "THB",
      monthlyContribution: 0,
      holdings: [
        holding({
          symbol: "ADVANC.BK",
          assetClass: "thai_equity",
          role: "satellite",
          marketValue: 50_000,
          price: 280,
          price5Ago: 330,
          coreAlternative: { symbol: "TDEX.BK", name: "ThaiDEX SET50 ETF" },
        }),
        holding({ symbol: "TDEX.BK", assetClass: "thai_equity", marketValue: 150_000 }),
      ],
      sentiments: [{ symbol: "ADVANC.BK", latest: -0.62, previous: 0.1 }],
    });
    const swap = alerts.find((alert) => alert.action === "swap");
    expect(swap?.symbol).toBe("ADVANC.BK");
    expect(swap?.actionDetail).toContain("TDEX.BK");
    expect(alerts.some((alert) => alert.kind === "price_move" && alert.symbol === "ADVANC.BK")).toBe(false);
  });

  it("holds a core fund when only the tone changes", () => {
    const targets = emptyWeights();
    targets.global_equity = 1;
    const alerts = evaluateAlerts({
      totalValue: 100_000,
      targets,
      currency: "USD",
      monthlyContribution: 0,
      holdings: [holding({ symbol: "VOO", assetClass: "global_equity", marketValue: 100_000 })],
      sentiments: [{ symbol: "VOO", latest: -0.2, previous: 0.4 }],
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].action).toBe("hold");
    expect(alerts[0].kind).toBe("sentiment");
  });
});
