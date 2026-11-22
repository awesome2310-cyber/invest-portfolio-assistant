"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DeskAlert } from "@/lib/server/desk";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RefreshButton() {
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="outline"
        className="h-10"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setNote("");
          const response = await fetch("/api/market/refresh", { method: "POST" });
          const payload = (await response.json()) as { note?: string };
          setNote(payload.note || "");
          setPending(false);
          router.refresh();
        }}
      >
        {pending ? t("desk.refreshing") : t("desk.refresh")}
      </Button>
      {note ? <p className="max-w-md text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export function DismissButton({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className="h-8"
      onClick={async () => {
        await fetch("/api/alerts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, intent: "dismiss" }),
        });
        router.refresh();
      }}
    >
      {t("alerts.dismiss")}
    </Button>
  );
}

const actionTone: Record<DeskAlert["action"], string> = {
  hold: "bg-secondary text-secondary-foreground",
  rebalance: "bg-primary text-primary-foreground",
  swap: "bg-accent text-accent-foreground",
};

export function AlertCard({ alert }: { alert: DeskAlert }) {
  const t = useT();
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs ${actionTone[alert.action]}`}>
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
      <DismissButton id={alert.id} />
    </article>
  );
}

export function ThresholdForm({
  initial,
}: {
  initial: { priceMovePct: number; driftPp: number; sentimentDelta: number };
}) {
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const form = new FormData(event.currentTarget);
        await fetch("/api/alerts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            intent: "settings",
            priceMovePct: Number(form.get("price")) / 100,
            driftPp: Number(form.get("drift")) / 100,
            sentimentDelta: Number(form.get("tone")),
          }),
        });
        setPending(false);
        router.refresh();
      }}
    >
      <div>
        <Label htmlFor="price">{t("alerts.price")}</Label>
        <Input id="price" name="price" className="mt-2 h-10" type="number" min={1} max={40} step={1} defaultValue={Math.round(initial.priceMovePct * 100)} />
      </div>
      <div>
        <Label htmlFor="drift">{t("alerts.drift")}</Label>
        <Input id="drift" name="drift" className="mt-2 h-10" type="number" min={1} max={30} step={1} defaultValue={Math.round(initial.driftPp * 100)} />
      </div>
      <div>
        <Label htmlFor="tone">{t("alerts.tone")}</Label>
        <Input id="tone" name="tone" className="mt-2 h-10" type="number" min={0.1} max={1} step={0.05} defaultValue={initial.sentimentDelta} />
      </div>
      <div className="flex items-end">
        <Button type="submit" className="h-10" disabled={pending}>
          {t("alerts.saveSettings")}
        </Button>
      </div>
    </form>
  );
}
