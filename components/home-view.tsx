"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MixDonut } from "@/components/charts";
import { DemoButton } from "@/components/shell";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { buildPlan } from "@/lib/allocation";

export function HomeView() {
  const t = useT();
  const sample = useMemo(
    () =>
      buildPlan(
        {
          timelineYears: 12,
          amount: 1_000_000,
          currency: "THB",
          riskScore: 50,
          monthlyContribution: 0,
          marketPreference: "balanced",
          taxWrapper: "none",
        },
        { includeProjection: false },
      ),
    [],
  );
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("eyebrow")}</p>
          <h1 className="mt-3 max-w-xl font-heading text-5xl leading-[1.05] tracking-tight md:text-6xl">{t("landing.title")}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{t("landing.lede")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <DemoButton label={t("landing.demo")} />
            <Button variant="outline" className="h-11 px-4" asChild>
              <Link href="/plan">{t("landing.build")}</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-heading text-2xl">{t("landing.sampleTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("landing.sampleNote")}</p>
          <div className="mt-2">
            <MixDonut weights={sample.allocation.weights} />
          </div>
        </div>
      </section>
      <section>
        <h2 className="font-heading text-3xl">{t("landing.inputsTitle")}</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("landing.inputsBody")}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["01", t("landing.step1Title"), t("landing.step1Body")],
            ["02", t("landing.step2Title"), t("landing.step2Body")],
            ["03", t("landing.step3Title"), t("landing.step3Body")],
          ].map(([index, title, body]) => (
            <article key={index} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs tracking-[0.16em] text-muted-foreground">{index}</p>
              <h3 className="mt-2 font-heading text-2xl">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
