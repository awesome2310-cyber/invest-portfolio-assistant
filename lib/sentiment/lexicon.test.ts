import { describe, expect, it } from "vitest";
import { scoreHeadline, scoreHeadlines } from "./lexicon";

describe("lexicon sentiment", () => {
  it("scores a clearly positive headline above zero", () => {
    expect(scoreHeadline("AIS posts record profit and lifts the dividend")).toBeGreaterThan(0);
  });

  it("scores a clearly negative headline below zero", () => {
    expect(scoreHeadline("Regulator opens a probe as margins slump")).toBeLessThan(0);
  });

  it("flips a negated positive word", () => {
    expect(scoreHeadline("This is not a rally")).toBeLessThan(0);
    expect(scoreHeadline("No growth in the quarter")).toBeLessThan(0);
  });

  it("returns zero when the headline has no lexicon words", () => {
    expect(scoreHeadline("The exchange is closed on Monday")).toBe(0);
    expect(scoreHeadlines([])).toBe(0);
  });
});
