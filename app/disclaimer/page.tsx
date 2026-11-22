import { dictionaryFor, translate } from "@/lib/i18n";
import { getLocale } from "@/lib/server/locale";

export default async function DisclaimerPage() {
  const dict = dictionaryFor(await getLocale());
  const t = (key: string) => translate(dict, key);
  return (
    <article className="max-w-3xl space-y-4 text-sm leading-relaxed">
      <h1 className="font-heading text-4xl tracking-tight">{t("nav.disclaimer")}</h1>
      <p>{t("disclaimer.short")}</p>
      <p>
        Sathorn is a personal worksheet. It is not a securities company, not an asset manager, and not an investment advisor licensed under the Securities and Exchange Act B.E. 2535 of Thailand. Nothing on this desk is an offer, a solicitation, or a personal recommendation to buy, sell, or hold a security, fund, or trust.
      </p>
      <p>
        Allocations use the planning assumptions on the method page and the numbers you type. Markets do not owe you those returns. Simulated ranges leave out taxes, fees you actually pay, tracking error, currency controls, and the chance that a fund changes its policy. Past prices, including the saved tape shipped with the demo, are not a guide to future prices.
      </p>
      <p>
        Expense ratios, fund codes, NAVs, broker onboarding, and tax rules were checked against public sources around November 2026 and will be stale the moment a factsheet or a ministerial regulation changes. ThaiESG, RMF, and SSF descriptions are educational. They are not a filing position. Confirm them with the Revenue Department, the fund factsheet, and a tax advisor before you subscribe. Holding-period breaches can claw back a deduction with a surcharge.
      </p>
      <p>
        US-listed ETFs can create US estate-tax exposure and require a W-8BEN. A Thai brokerage account and a bank fund account have their own suitability checks. This desk does not know your debts, your job, or whether the money is needed for a dated bill. If it is, a lower risk score is the conservative reading, and a licensed advisor is the right next conversation.
      </p>
      <p>
        News tone is a rough score of headlines. It is not research. Alerts are mechanical rules you can edit. Acting on them is your decision.
      </p>
    </article>
  );
}
