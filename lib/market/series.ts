import { hashSeed, mulberry32, randn } from "@/lib/allocation/math";

export function bangkokToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

export function businessDaysEnding(endIso: string, count: number): string[] {
  const [year, month, day] = endIso.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  const days: string[] = [];
  while (days.length < count) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days.reverse();
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

export function geometricToEnd(options: {
  endPrice: number;
  annualReturn: number;
  annualVol: number;
  dates: string[];
  seed: number;
}): { date: string; close: number }[] {
  const rng = mulberry32(options.seed || hashSeed(String(options.endPrice)));
  const step = 1 / 252;
  const drift =
    (options.annualReturn - 0.5 * options.annualVol * options.annualVol) * step;
  const shock = options.annualVol * Math.sqrt(step);
  const relative = [1];
  for (let index = 1; index < options.dates.length; index += 1) {
    relative.push(relative[relative.length - 1] * Math.exp(drift + shock * randn(rng)));
  }
  const scale = options.endPrice / relative[relative.length - 1];
  return options.dates.map((date, index) => ({
    date,
    close: roundPrice(relative[index] * scale),
  }));
}

export function projectFromProxy(
  proxy: { date: string; close: number }[],
  endPrice: number,
): { date: string; close: number }[] {
  if (!proxy.length) return [];
  const relative = [1];
  for (let index = 1; index < proxy.length; index += 1) {
    const previous = proxy[index - 1].close;
    const change = previous > 0 ? proxy[index].close / previous - 1 : 0;
    relative.push(relative[relative.length - 1] * (1 + change));
  }
  const scale = endPrice / relative[relative.length - 1];
  return proxy.map((bar, index) => ({
    date: bar.date,
    close: roundPrice(Math.max(0.0001, relative[index] * scale)),
  }));
}

/** Pull the last close down by `drop` versus the close five sessions earlier. */
export function shockTail(bars: { date: string; close: number }[], drop: number) {
  if (bars.length < 8 || drop <= 0) return;
  const start = bars.length - 6;
  const base = bars[start].close;
  const end = base * (1 - drop);
  for (let step = 1; step <= 5; step += 1) {
    bars[start + step].close = roundPrice(base + (end - base) * (step / 5));
  }
}

function roundPrice(value: number): number {
  return Math.round(value * 10000) / 10000;
}
