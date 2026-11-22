"use client";

import Link from "next/link";
import { PriceChart } from "@/components/charts";
import { useDesk } from "@/components/use-desk";
import { useT } from "@/components/i18n-provider";
import { CATALOG } from "@/lib/allocation/instruments";
import { formatMoney, formatPct, formatRatio, formatUnits } from "@/lib/format";
import { aggregateSentiment } from "@/lib/market/news";

export function HoldingView({ id }: { id: string }) {
  const t = useT();
  const { phase, snapshot, book } = useDesk();
  const catalog = CATALOG.find((item) => item.id === id);
  if (phase === "loading") return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!catalog || !snapshot) return <p className="text-sm text-muted-foreground">That line is not in the catalog.</p>;
  const holding = book?.holdings.find((item) => item.id === id);
  const bars = snapshot.bars[catalog.symbol]?.closes ?? [];
  const news = snapshot.news[catalog.symbol] ?? [];
  const tone = aggregateSentiment(
    news.map((item) => ({ publishedAt: item.publishedAt, sentiment: item.sentiment })),
    bars.at(-1)?.date ?? snapshot.generatedAt.slice(0, 10),
  );
  const latest = tone?.latest ?? 0;
  const access = holding?.access ?? catalog.access;
  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          {t("holding.back")}
        </Link>
        <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {catalog.symbol} · {t(`asset.${catalog.assetClass}`)}
        </p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">{catalog.name}</h1>
        {holding && book ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {formatUnits(holding.units)} · {formatMoney(holding.marketValue, book.plan.currency)} · {t("plan.fee")} {formatRatio(holding.expenseRatio)}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{catalog.expenseNote}</p>
        )}
      </div>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-heading text-2xl">{t("holding.price")}</h2>
        {catalog.proxyYahoo ? <p className="mt-1 text-xs text-muted-foreground">{t("holding.proxy")}</p> : null}
        <PriceChart bars={bars} />
        <p className="text-xs text-muted-foreground">{catalog.priceNote}</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-heading text-2xl">{t("holding.sentiment")}</h2>
        <div className="relative mt-6 h-2 rounded-full bg-muted">
          <div className="absolute -top-1 size-4 rounded-full border border-foreground bg-card" style={{ left: `calc(${((latest + 1) / 2) * 100}% - 8px)` }} />
        </div>
        <p className="mt-3 text-sm tabular-nums">
          {latest.toFixed(2)} recent
          {tone?.previous != null ? ` · ${tone.previous.toFixed(2)} prior` : ""} · {news[0]?.method === "llm" ? t("holding.llm") : t("holding.lexicon")}
        </p>
      </section>
      <section>
        <h2 className="font-heading text-2xl">{t("holding.news")}</h2>
        {news.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("holding.none")}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {[...news].reverse().map((item) => (
              <li key={item.title + item.publishedAt} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.source} · {item.sentiment.toFixed(2)} · {item.method}
                </p>
                {item.url ? (
                  <a href={item.url} className="mt-2 inline-block text-sm underline underline-offset-4" target="_blank" rel="noreferrer">
                    {item.source}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-heading text-2xl">{t("holding.access")}</h2>
        <div className="mt-4 space-y-4">
          {access.map((note) => (
            <article key={note.channel} className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-medium">{note.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note.detail}</p>
            </article>
          ))}
        </div>
        {holding ? (
          <p className="mt-4 text-sm">
            {t("desk.drift")}: {formatPct(holding.currentWeight)} / {formatPct(holding.targetWeight)}
          </p>
        ) : null}
      </section>
    </div>
  );
}
