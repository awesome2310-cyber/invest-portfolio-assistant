import { scoreHeadline, scoreHeadlines } from "@/lib/sentiment/lexicon";

export interface Headline {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  sentiment: number;
  method: "lexicon" | "llm";
}

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function parseRss(xml: string, sourceFallback: string): Omit<Headline, "sentiment" | "method">[] {
  const chunks = xml.split(/<item\b/i).slice(1, 7);
  const items: Omit<Headline, "sentiment" | "method">[] = [];
  for (const chunk of chunks) {
    const title = decode(chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    if (!title) continue;
    const link = decode(chunk.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const dateRaw = decode(chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "");
    const parsed = Date.parse(dateRaw);
    const publishedAt = Number.isFinite(parsed)
      ? new Date(parsed).toISOString()
      : new Date().toISOString();
    const source = decode(chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "") || sourceFallback;
    items.push({ title, url: link, publishedAt, source });
  }
  return items;
}

export async function fetchGoogleNews(query: string): Promise<Omit<Headline, "sentiment" | "method">[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=TH&ceid=TH:en`;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Sathorn/0.1)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    return parseRss(await response.text(), "Google News");
  } catch {
    return [];
  }
}

export async function maybeLlmScore(titles: string[]): Promise<number | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || titles.length === 0) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              'Score the tone of these financial headlines for a long-term investor. Reply with JSON only: {"score": number} from -1 (clearly negative) to 1 (clearly positive).',
          },
          {
            role: "user",
            content: titles.map((title, index) => `${index + 1}. ${title}`).join("\n"),
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content ?? "";
    const match = text.match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const score = Number(match[0]);
    if (!Number.isFinite(score)) return null;
    return Math.max(-1, Math.min(1, score));
  } catch {
    return null;
  }
}

export async function headlinesFor(query: string): Promise<Headline[]> {
  const raw = await fetchGoogleNews(query);
  if (!raw.length) return [];
  const llm = await maybeLlmScore(raw.map((item) => item.title));
  return raw.map((item) => ({
    ...item,
    sentiment: llm ?? scoreHeadline(item.title),
    method: llm == null ? "lexicon" : "llm",
  }));
}

export function aggregateSentiment(
  items: { publishedAt: string; sentiment: number }[],
  todayIso: string,
): { latest: number; previous: number | null } | null {
  if (!items.length) return null;
  const cutoff = Date.parse(`${todayIso}T00:00:00Z`) - 7 * 86400000;
  const recent: number[] = [];
  const older: number[] = [];
  for (const item of items) {
    const when = Date.parse(item.publishedAt);
    if (Number.isFinite(when) && when >= cutoff) recent.push(item.sentiment);
    else older.push(item.sentiment);
  }
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  if (recent.length && older.length) return { latest: mean(recent), previous: mean(older) };
  if (recent.length) return { latest: mean(recent), previous: null };
  return { latest: mean(older), previous: null };
}

export { scoreHeadlines };
