"use client";

import Link from "next/link";
import { AlertCard, DeskFiles, ThresholdForm } from "@/components/desk-actions";
import { useDesk } from "@/components/use-desk";
import { useT } from "@/components/i18n-provider";

export default function AlertsPage() {
  const t = useT();
  const { phase, book } = useDesk();
  if (phase === "loading") return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-4xl">{t("alerts.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("disclaimer.short")}</p>
        </div>
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          {t("holding.back")}
        </Link>
      </div>
      {book ? <ThresholdForm /> : null}
      {book && book.alerts.length > 0 ? (
        book.alerts.map((alert) => <AlertCard key={alert.dedupeKey} alert={alert} />)
      ) : (
        <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>
      )}
      <DeskFiles />
    </div>
  );
}
