import { redirect } from "next/navigation";
import { AlertCard, ThresholdForm } from "@/components/desk-actions";
import { dictionaryFor, translate } from "@/lib/i18n";
import { currentUser } from "@/lib/server/auth";
import { loadDesk, readThresholds } from "@/lib/server/desk";
import { getLocale } from "@/lib/server/locale";

export default async function AlertsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/alerts");
  const dict = dictionaryFor(await getLocale());
  const t = (key: string) => translate(dict, key);
  const desk = loadDesk(user.id, { name: user.name, email: user.email, isDemo: Boolean(user.is_demo) });
  const thresholds = readThresholds(user.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">{t("alerts.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("disclaimer.short")}</p>
      </div>
      <ThresholdForm initial={thresholds} />
      {desk && desk.alerts.length > 0 ? (
        desk.alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
      ) : (
        <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>
      )}
    </div>
  );
}
