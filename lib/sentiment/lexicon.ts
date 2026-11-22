const POSITIVE = new Set([
  "beat",
  "beats",
  "growth",
  "surge",
  "surged",
  "rally",
  "rallying",
  "upgrade",
  "upgraded",
  "record",
  "profit",
  "profits",
  "gain",
  "gains",
  "bullish",
  "strong",
  "expands",
  "expand",
  "dividend",
  "recovery",
  "rise",
  "rises",
  "rising",
  "optimistic",
  "steady",
  "lift",
  "lifts",
  "lifted",
  "outperform",
  "rebound",
  "rebounded",
  "boost",
  "boosted",
]);

const NEGATIVE = new Set([
  "miss",
  "misses",
  "falls",
  "fall",
  "drop",
  "drops",
  "dropped",
  "plunge",
  "plunged",
  "downgrade",
  "downgraded",
  "loss",
  "losses",
  "fraud",
  "default",
  "recession",
  "weak",
  "lawsuit",
  "probe",
  "slump",
  "cut",
  "cuts",
  "bearish",
  "decline",
  "declines",
  "investigation",
  "war",
  "hit",
  "hits",
  "scandal",
  "warning",
  "warns",
  "layoff",
  "layoffs",
  "deficit",
  "crash",
  "crashed",
]);

const NEGATORS = new Set(["no", "not", "never", "without", "n't"]);

export function tokenize(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/n't/g, " not")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function scoreHeadline(title: string): number {
  const tokens = tokenize(title);
  let positive = 0;
  let negative = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    let polarity = 0;
    if (POSITIVE.has(token)) polarity = 1;
    else if (NEGATIVE.has(token)) polarity = -1;
    if (polarity === 0) continue;
    const window = tokens.slice(Math.max(0, i - 2), i);
    if (window.some((word) => NEGATORS.has(word))) polarity *= -1;
    if (polarity > 0) positive += 1;
    else negative += 1;
  }
  if (positive === 0 && negative === 0) return 0;
  return (positive - negative) / (positive + negative + 2);
}

export function scoreHeadlines(titles: string[]): number {
  if (!titles.length) return 0;
  const total = titles.reduce((sum, title) => sum + scoreHeadline(title), 0);
  return Math.max(-1, Math.min(1, total / titles.length));
}
