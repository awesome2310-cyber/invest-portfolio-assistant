import { describe, expect, it } from "vitest";
import { buildBook } from "@/lib/desk/book";
import { buildFallbackSnapshot } from "@/lib/market/snapshot";
import { demoRecord, parseDesk } from "@/lib/storage";

describe("browser desk", () => {
  const snapshot = buildFallbackSnapshot(new Date("2026-11-22T04:00:00.000Z"));

  it("builds a fallback tape with a recent drop in the property and satellite lines", () => {
    const reit = snapshot.bars["CPNREIT.BK"].closes;
    const prior = reit[reit.length - 6].close;
    const last = reit[reit.length - 1].close;
    expect(last / prior - 1).toBeLessThan(-0.1);
    expect(snapshot.news["ADVANC.BK"]?.length).toBeGreaterThan(2);
  });

  it("turns the demo book into a rebalance and a price alert", () => {
    const book = buildBook(demoRecord(), snapshot);
    expect(book.marketValue).toBeGreaterThan(1_000_000);
    expect(book.holdings.reduce((sum, holding) => sum + holding.currentWeight, 0)).toBeCloseTo(1, 6);
    expect(book.series.length).toBeGreaterThan(150);
    const actions = book.alerts.map((alert) => alert.action);
    expect(actions).toContain("rebalance");
    expect(actions).toContain("hold");
    expect(book.alerts.some((alert) => alert.action === "swap" && alert.symbol === "ADVANC.BK")).toBe(true);
    expect(book.alerts[0]?.delivery.some((item) => item.channel === "email" && item.status === "skipped")).toBe(true);
  });

  it("round-trips a saved desk file", () => {
    const record = demoRecord();
    const parsed = parseDesk(JSON.stringify(record));
    expect(parsed.plan.amount).toBe(2_500_000);
    expect(parsed.mode).toBe("demo");
    expect(() => parseDesk("{}")).toThrow();
  });
});
