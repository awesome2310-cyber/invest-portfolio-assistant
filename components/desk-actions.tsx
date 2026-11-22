"use client";

import { useRef } from "react";
import type { DeskBook } from "@/lib/desk/book";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearDesk, parseDesk, readDesk, writeDesk } from "@/lib/storage";
import { useRouter } from "next/navigation";

export function DeskFiles() {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        className="h-10"
        onClick={() => {
          const record = readDesk();
          if (!record) return;
          const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "sathorn-desk.json";
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        {t("desk.export")}
      </Button>
      <Button variant="outline" className="h-10" onClick={() => input.current?.click()}>
        {t("desk.import")}
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            writeDesk(parseDesk(await file.text()));
            router.push("/dashboard");
          } catch {
            window.alert(t("desk.importError"));
          }
        }}
      />
      <Button
        variant="ghost"
        className="h-10"
        onClick={() => {
          clearDesk();
          router.push("/");
        }}
      >
        {t("desk.clear")}
      </Button>
    </div>
  );
}

export function DismissButton({ dedupeKey }: { dedupeKey: string }) {
  const t = useT();
  return (
    <Button
      variant="ghost"
      className="h-8"
      onClick={() => {
        const record = readDesk();
        if (!record || record.dismissed.includes(dedupeKey)) return;
        writeDesk({ ...record, dismissed: [...record.dismissed, dedupeKey] });
      }}
    >
      {t("alerts.dismiss")}
    </Button>
  );
}

const actionTone: Record<string, string> = {
  hold: "bg-secondary text-secondary-foreground",
  rebalance: "bg-primary text-primary-foreground",
  swap: "bg-accent text-accent-foreground",
};

export function AlertCard({ alert }: { alert: DeskBook["alerts"][number] }) {
  const t = useT();
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs ${actionTone[alert.action] ?? ""}`}>
          {t(`alerts.${alert.action}`)}
        </span>
        <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {alert.severity === "act" ? t("alerts.act") : t("alerts.watch")}
        </span>
      </div>
      <h3 className="mt-2 font-heading text-2xl leading-tight">{alert.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{alert.reasoning}</p>
      <p className="mt-3 text-sm leading-relaxed">{alert.actionDetail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {alert.delivery.map((item) => (
          <span key={item.channel} className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
            {item.channel}: {item.status}
          </span>
        ))}
      </div>
      <DismissButton dedupeKey={alert.dedupeKey} />
    </article>
  );
}

export function ThresholdForm() {
  const t = useT();
  const record = readDesk();
  if (!record) return null;
  return (
    <form
      className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const current = readDesk();
        if (!current) return;
        writeDesk({
          ...current,
          thresholds: {
            priceMovePct: Number(form.get("price")) / 100,
            driftPp: Number(form.get("drift")) / 100,
            sentimentDelta: Number(form.get("tone")),
          },
        });
      }}
    >
      <div>
        <Label htmlFor="price">{t("alerts.price")}</Label>
        <Input id="price" name="price" className="mt-2 h-10" type="number" min={1} max={40} step={1} defaultValue={Math.round(record.thresholds.priceMovePct * 100)} />
      </div>
      <div>
        <Label htmlFor="drift">{t("alerts.drift")}</Label>
        <Input id="drift" name="drift" className="mt-2 h-10" type="number" min={1} max={30} step={1} defaultValue={Math.round(record.thresholds.driftPp * 100)} />
      </div>
      <div>
        <Label htmlFor="tone">{t("alerts.tone")}</Label>
        <Input id="tone" name="tone" className="mt-2 h-10" type="number" min={0.1} max={1} step={0.05} defaultValue={record.thresholds.sentimentDelta} />
      </div>
      <div className="flex items-end">
        <Button type="submit" className="h-10">
          {t("alerts.saveSettings")}
        </Button>
      </div>
    </form>
  );
}
