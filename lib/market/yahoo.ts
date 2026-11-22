export interface YahooBar {
  date: string;
  close: number;
  currency: string;
}

export async function fetchYahooDaily(symbol: string): Promise<YahooBar[] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d`;
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; Sathorn/0.1; +https://localhost)",
        accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      chart?: {
        result?: {
          timestamp?: number[];
          meta?: { currency?: string };
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    };
    const result = payload.chart?.result?.[0];
    if (!result?.timestamp?.length) return null;
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const currency = result.meta?.currency || "USD";
    const bars: YahooBar[] = [];
    for (let index = 0; index < result.timestamp.length; index += 1) {
      const close = closes[index];
      if (close == null || !Number.isFinite(close)) continue;
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
      }).format(new Date(result.timestamp[index] * 1000));
      bars.push({ date, close, currency });
    }
    const byDate = new Map<string, YahooBar>();
    for (const bar of bars) byDate.set(bar.date, bar);
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}
