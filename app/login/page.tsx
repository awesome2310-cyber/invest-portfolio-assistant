"use client";

import Link from "next/link";
import { DemoButton } from "@/components/shell";
import { useT } from "@/components/i18n-provider";

export default function BrowserPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-heading text-4xl tracking-tight">{t("desk.title")}</h1>
      <p className="text-muted-foreground">{t("landing.lede")}</p>
      <div className="flex flex-wrap gap-3">
        <DemoButton label={t("landing.demo")} />
        <Link href="/plan" className="text-sm underline underline-offset-4">
          {t("landing.build")}
        </Link>
      </div>
    </div>
  );
}
