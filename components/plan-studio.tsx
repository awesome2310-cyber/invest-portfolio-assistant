"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAllocation } from "@/lib/allocation/engine";
import { buildInstruments } from "@/lib/allocation/instruments";
import { projectPortfolio } from "@/lib/allocation/montecarlo";
import type { Currency, MarketPreference, PlanInput, Projection, TaxWrapper } from "@/lib/allocation/types";
import { ASSET_CLASSES } from "@/lib/allocation/types";
import { FanChart, MixDonut } from "@/components/charts";
import { useT } from "@/components/i18n-provider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatMoney, formatPct, formatRatio, formatUnits } from "@/lib/format";

export function PlanStudio({
  initial,
  fx,
  prices,
}: {
  initial: PlanInput;
  fx: number;
  prices: Record<string, number>;
}) {
  const t = useT();
  const router = useRouter();
  const [timeline, setTimeline] = useState(initial.timelineYears);
  const [amount, setAmount] = useState(initial.amount);
  const [currency, setCurrency] = useState<Currency>(initial.currency);
  const [risk, setRisk] = useState(initial.riskScore);
  const [monthly, setMonthly] = useState(initial.monthlyContribution);
  const [preference, setPreference] = useState<MarketPreference>(initial.marketPreference);
  const [wrapper, setWrapper] = useState<TaxWrapper>(initial.taxWrapper);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projection, setProjection] = useState<Projection | null>(null);

  const input: PlanInput = useMemo(
    () => ({
      timelineYears: timeline,
      amount: amount > 0 ? amount : 1,
      currency,
      riskScore: risk,
      monthlyContribution: Math.max(0, monthly || 0),
      marketPreference: preference,
      taxWrapper: wrapper,
    }),
    [timeline, amount, currency, risk, monthly, preference, wrapper],
  );

  const allocation = useMemo(
    () => buildAllocation(input),
    [input.timelineYears, input.riskScore, input.marketPreference],
  );
  const built = useMemo(
    () => buildInstruments(input, allocation.weights, { fx, prices }),
    [input, allocation, fx, prices],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      setProjection(projectPortfolio(input, { paths: 280 }));
    }, 140);
    return () => clearTimeout(handle);
  }, [input]);

  const warnings = [...allocation.warnings, ...built.warnings];
  const last = projection?.points[projection.points.length - 1];

  async function save() {
    if (!accepted) {
      setError(t("plan.needAccept"));
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not save");
      setSaving(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight md:text-5xl">{t("plan.title")}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("plan.lede")}</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <label className="rounded-2xl border border-border bg-card p-4">
          <span className="text-sm text-muted-foreground">{t("plan.timeline")}</span>
          <div className="mt-2 flex items-end justify-between">
            <span className="font-heading text-3xl">{t("plan.years", { years: timeline })}</span>
          </div>
          <Slider
            className="mt-4"
            min={1}
            max={40}
            step={1}
            value={[timeline]}
            onValueChange={(value) => setTimeline(value[0] ?? 1)}
            aria-label={t("plan.timeline")}
          />
        </label>
        <div className="rounded-2xl border border-border bg-card p-4">
          <Label htmlFor="amount">{t("plan.amount")}</Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="amount"
              className="h-11"
              inputMode="decimal"
              type="number"
              min={1}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
            <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
              <SelectTrigger className="h-11 w-24" aria-label={t("plan.currency")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="THB">THB</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t("plan.risk")}</span>
            <span className="text-sm">{t(`profile.${allocation.profile}`)}</span>
          </div>
          <p className="mt-1 font-heading text-3xl">{formatPct(allocation.targetReturn)}</p>
          <Slider
            className="mt-4"
            min={0}
            max={100}
            step={1}
            value={[risk]}
            onValueChange={(value) => setRisk(value[0] ?? 0)}
            aria-label={t("plan.risk")}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("plan.modelLabel")} {formatPct(allocation.expectedReturn)} · vol {formatPct(allocation.volatility)}
          </p>
        </div>
      </section>

      <Accordion type="single" collapsible>
        <AccordionItem value="optional">
          <AccordionTrigger>{t("plan.optional")}</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 pt-2 md:grid-cols-3">
              <div>
                <Label htmlFor="monthly">{t("plan.monthly")}</Label>
                <Input
                  id="monthly"
                  className="mt-2 h-11"
                  type="number"
                  min={0}
                  value={monthly}
                  onChange={(event) => setMonthly(Number(event.target.value))}
                />
                <p className="mt-2 text-xs text-muted-foreground">{t("plan.monthlyHelp")}</p>
              </div>
              <div>
                <Label>{t("plan.preference")}</Label>
                <Select value={preference} onValueChange={(value) => setPreference(value as MarketPreference)}>
                  <SelectTrigger className="mt-2 h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thai">{t("pref.thai")}</SelectItem>
                    <SelectItem value="balanced">{t("pref.balanced")}</SelectItem>
                    <SelectItem value="global">{t("pref.global")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("plan.wrapper")}</Label>
                <Select value={wrapper} onValueChange={(value) => setWrapper(value as TaxWrapper)}>
                  <SelectTrigger className="mt-2 h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("tax.none")}</SelectItem>
                    <SelectItem value="thaiesg">{t("tax.thaiesg")}</SelectItem>
                    <SelectItem value="rmf">{t("tax.rmf")}</SelectItem>
                    <SelectItem value="ssf">{t("tax.ssf")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label={t("plan.expected")} value={formatPct(allocation.expectedReturn)} />
        <Metric label={t("plan.volatility")} value={formatPct(allocation.volatility)} />
        <Metric
          label={t("plan.drawdown")}
          value={projection ? formatPct(projection.medianMaxDrawdown) : "…"}
          hint={projection ? `${t("plan.severe")} ${formatPct(projection.severeMaxDrawdown)}` : undefined}
        />
        <Metric
          label={t("plan.terminal")}
          value={last ? formatMoney(last.p50, currency) : "…"}
          hint={last ? `${formatMoney(last.p10, currency)} – ${formatMoney(last.p90, currency)}` : undefined}
        />
      </section>

      {warnings.length ? (
        <ul className="space-y-2 rounded-2xl border border-border bg-accent/40 p-4 text-sm leading-relaxed">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-heading text-2xl">{t("plan.mix")}</h2>
          <div className="mt-4">
            <MixDonut weights={allocation.weights} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-heading text-2xl">{t("plan.fan")}</h2>
          {projection ? (
            <FanChart points={projection.points} currency={currency} />
          ) : (
            <p className="py-16 text-sm text-muted-foreground">{t("plan.drawing")}</p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">{t("plan.fanNote")}</p>
        </div>
      </section>

      <Accordion type="single" collapsible>
        <AccordionItem value="method">
          <AccordionTrigger>{t("plan.steps")}</AccordionTrigger>
          <AccordionContent>
            <p className="mb-3 text-xs text-muted-foreground">{t("plan.stepsNote")}</p>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              {allocation.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <section>
        <h2 className="font-heading text-3xl">{t("plan.instruments")}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t("plan.instrumentsNote")}</p>
        <div className="mt-4 space-y-6">
          {ASSET_CLASSES.map((asset) => {
            const lines = built.instruments.filter((line) => line.assetClass === asset);
            if (!lines.length) return null;
            return (
              <div key={asset}>
                <h3 className="text-sm uppercase tracking-[0.14em] text-muted-foreground">{t(`asset.${asset}`)}</h3>
                <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
                  {lines.map((line) => (
                    <li key={line.id} className="grid gap-2 p-4 md:grid-cols-[1.4fr_0.8fr_auto] md:items-center">
                      <div>
                        <p className="font-medium">{line.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {line.symbol}
                          {line.role === "satellite" ? " · satellite" : ""}
                          {line.role === "residual" ? " · residual" : ""}
                        </p>
                        {line.note ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{line.note}</p> : null}
                      </div>
                      <p className="text-sm tabular-nums">
                        {formatPct(line.targetWeight)} · {formatMoney(line.amount, currency)}
                        <span className="block text-muted-foreground">
                          {formatUnits(line.units)} {t("plan.units").toLowerCase()} · {t("plan.fee")} {formatRatio(line.expenseRatio)}
                        </span>
                      </p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="h-9">
                            {t("plan.access")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{line.name}</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground">{line.unitNote}</p>
                          <p className="text-sm text-muted-foreground">{line.expenseNote}</p>
                          <p className="text-sm text-muted-foreground">{line.priceNote}</p>
                          <div className="space-y-3">
                            {line.access.map((note) => (
                              <div key={note.channel}>
                                <p className="font-medium">{note.title}</p>
                                <p className="text-sm leading-relaxed text-muted-foreground">{note.detail}</p>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} />
          <span>{t("plan.accept")}</span>
        </label>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <Button className="mt-3 h-11 px-5" onClick={save} disabled={saving || !(amount > 0)}>
          {saving ? t("plan.saving") : t("plan.save")}
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
