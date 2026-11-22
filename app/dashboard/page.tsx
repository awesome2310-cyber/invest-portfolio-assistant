import Link from "next/link";
import { redirect } from "next/navigation";
import { PerformanceChart } from "@/components/charts";
import { AlertCard, RefreshButton } from "@/components/desk-actions";
import { Button } from "@/components/ui/button";
import { dictionaryFor, translate } from "@/lib/i18n";
import { formatCompactDate, formatMoney, formatPct, formatSignedPct, formatUnits } from "@/lib/format";
import { currentUser } from "@/lib/server/auth";
import { loadDesk } from "@/lib/server/desk";
import { getLocale } from "@/lib/server/locale";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/dashboard");
  const dict = dictionaryFor(await getLocale());
  const t = (key: string, vars?: Record<string, string | number>) => translate(dict, key, vars);
  const desk = loadDesk(user.id, {
    name: user.name,
    email: user.email,
    isDemo: Boolean(user.is_demo),
  });
  if (!desk) {
    return (
      <div className="max-w-xl">
        <h1 className="font-heading text-4xl">{t("desk.emptyTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("desk.emptyBody")}</p>
        <Button className="mt-6 h-11 px-4" asChild>
          <Link href="/plan">{t("desk.emptyAction")}</Link>
        </Button>
      </div>
    );
  }
  const gain = desk.cost > 0 ? desk.marketValue / desk.cost - 1 : 0;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {desk.user.name} · {t(`profile.${desk.profile}`)} · {t("plan.years", { years: desk.plan.timelineYears })}
          </p>
          <h1 className="mt-2 font-heading text-4xl md:text-5xl">{t("desk.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("plan.targetLabel")} {formatPct(desk.targetReturn)} · {t("plan.modelLabel")} {formatPct(desk.expectedReturn)} · USD/THB {desk.fx.toFixed(2)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10" asChild>
            <Link href="/plan">{t("desk.edit")}</Link>
          </Button>
          <RefreshButton />
        </div>
      </div>

      {desk.priceSource !== "yahoo" ? (
        <p className="rounded-2xl border border-border bg-accent/40 px-4 py-3 text-sm leading-relaxed">{t("desk.seedNote")}</p>
      ) : null}
      {desk.refreshNote ? <p className="text-sm text-muted-foreground">{desk.refreshNote}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("desk.market")} value={formatMoney(desk.marketValue, desk.plan.currency)} />
        <Stat label={t("desk.cost")} value={formatMoney(desk.cost, desk.plan.currency)} />
        <Stat label={t("desk.gain")} value={formatSignedPct(gain)} />
        <Stat label={t("desk.day")} value={formatSignedPct(desk.dayChange)} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-heading text-2xl">{t("desk.chart")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {desk.replay ? t("desk.chartReplay") : t("desk.chartHeld", { date: formatCompactDate(desk.inception) })}
        </p>
        <PerformanceChart series={desk.series} />
        <p className="text-xs text-muted-foreground">{t("desk.benchmark")}</p>
      </section>

      <section>
        <h2 className="font-heading text-2xl">{t("desk.drift")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("desk.driftNote")}</p>
        <ul className="mt-4 space-y-3">
          {desk.drift
            .filter((row) => row.target > 0.004 || row.current > 0.004)
            .map((row) => {
              const gap = row.current - row.target;
              return (
                <li key={row.assetClass}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{t(`asset.${row.assetClass}`)}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatPct(row.current)} / {formatPct(row.target)} ({formatSignedPct(gap)})
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, row.current * 100)}%` }}
                    />
                    <div
                      className="absolute -top-1 h-4 w-0.5 bg-foreground"
                      style={{ left: `${Math.min(100, row.target * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl">{t("desk.alerts")}</h2>
          <Link href="/alerts" className="text-sm text-muted-foreground underline underline-offset-4">
            {t("desk.seeAll")}
          </Link>
        </div>
        {desk.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>
        ) : (
          desk.alerts.slice(0, 3).map((alert) => <AlertCard key={alert.id} alert={alert} />)
        )}
      </section>

      <section>
        <h2 className="font-heading text-2xl">{t("desk.holdings")}</h2>
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {desk.holdings.map((holding) => (
            <li key={holding.id}>
              <Link href={`/holdings/${holding.instrumentId}`} className="grid gap-1 p-4 hover:bg-muted/50 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
                <span>
                  <span className="block font-medium">{holding.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {holding.symbol} · {t(`asset.${holding.assetClass}`)}
                    {holding.proxy ? ` · ${t("desk.proxy")}` : ""}
                  </span>
                </span>
                <span className="text-sm tabular-nums">
                  {formatMoney(holding.marketValue, desk.plan.currency)}
                  <span className="block text-muted-foreground">
                    {formatUnits(holding.units)} · {formatSignedPct(holding.dayChange)}
                  </span>
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatPct(holding.currentWeight)} / {formatPct(holding.targetWeight)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl tabular-nums">{value}</p>
    </div>
  );
}
