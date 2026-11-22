import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PriceChart } from "@/components/charts";
import { dictionaryFor, translate } from "@/lib/i18n";
import { formatMoney, formatPct, formatRatio, formatUnits } from "@/lib/format";
import { aggregateSentiment } from "@/lib/market/news";
import { bangkokToday } from "@/lib/market/series";
import { currentUser } from "@/lib/server/auth";
import { loadHolding } from "@/lib/server/desk";
import { getLocale } from "@/lib/server/locale";

export default async function HoldingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const loaded = loadHolding(user.id, id);
  if (!loaded) notFound();
  const { holding, news, desk } = loaded;
  const dict = dictionaryFor(await getLocale());
  const t = (key: string) => translate(dict, key);
  const tone = aggregateSentiment(
    news.map((item) => ({ publishedAt: item.published_at, sentiment: item.sentiment })),
    bangkokToday(),
  );
  const latest = tone?.latest ?? 0;
  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          {t("holding.back")}
        </Link>
        <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {holding.symbol} · {t(`asset.${holding.assetClass}`)}
        </p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">{holding.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatUnits(holding.units)} · {formatMoney(holding.marketValue, desk.plan.currency)} · {t("plan.fee")} {formatRatio(holding.expenseRatio)}
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-heading text-2xl">{t("holding.price")}</h2>
        {holding.proxy ? <p className="mt-1 text-xs text-muted-foreground">{t("holding.proxy")}</p> : null}
        <PriceChart bars={loaded.bars} />
        <p className="text-xs text-muted-foreground">{holding.priceNote}</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-heading text-2xl">{t("holding.sentiment")}</h2>
        <div className="relative mt-6 h-2 rounded-full bg-muted">
          <div
            className="absolute -top-1 size-4 rounded-full border border-foreground bg-card"
            style={{ left: `calc(${((latest + 1) / 2) * 100}% - 8px)` }}
          />
        </div>
        <p className="mt-3 text-sm tabular-nums">
          {latest.toFixed(2)} recent
          {tone?.previous != null ? ` · ${tone.previous.toFixed(2)} prior` : ""} ·{" "}
          {news[0]?.method === "llm" ? t("holding.llm") : t("holding.lexicon")}
        </p>
      </section>

      <section>
        <h2 className="font-heading text-2xl">{t("holding.news")}</h2>
        {news.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("holding.none")}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {news.map((item) => (
              <li key={item.title + item.published_at} className="rounded-2xl border border-border bg-card p-4">
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
        <p className="mt-2 text-sm text-muted-foreground">{holding.unitNote}</p>
        <p className="mt-2 text-sm text-muted-foreground">{holding.expenseNote}</p>
        <div className="mt-4 space-y-4">
          {holding.access.map((note) => (
            <article key={note.channel} className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-medium">{note.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note.detail}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm">
          {t("desk.drift")}: {formatPct(holding.currentWeight)} / {formatPct(holding.targetWeight)}
        </p>
      </section>
    </div>
  );
}
