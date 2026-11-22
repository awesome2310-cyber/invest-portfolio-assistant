import { redirect } from "next/navigation";
import { PlanStudio } from "@/components/plan-studio";
import type { PlanInput } from "@/lib/allocation/types";
import { currentUser } from "@/lib/server/auth";
import { loadPlan, quoteContext } from "@/lib/server/desk";

const blank: PlanInput = {
  timelineYears: 10,
  amount: 1_000_000,
  currency: "THB",
  riskScore: 50,
  monthlyContribution: 0,
  marketPreference: "balanced",
  taxWrapper: "none",
};

export default async function PlanPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/plan");
  const saved = loadPlan(user.id);
  const quotes = quoteContext();
  return <PlanStudio initial={saved ?? blank} fx={quotes.fx} prices={quotes.prices} />;
}
