import { NextResponse } from "next/server";
import type { PlanInput } from "@/lib/allocation/types";
import { currentUser } from "@/lib/server/auth";
import { savePortfolio } from "@/lib/server/desk";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as PlanInput | null;
  if (!body) return NextResponse.json({ error: "Missing plan." }, { status: 400 });
  try {
    const result = savePortfolio(user.id, {
      timelineYears: Number(body.timelineYears),
      amount: Number(body.amount),
      currency: body.currency,
      riskScore: Number(body.riskScore),
      monthlyContribution: Number(body.monthlyContribution || 0),
      marketPreference: body.marketPreference,
      taxWrapper: body.taxWrapper,
    });
    if (!result.ok) return NextResponse.json({ error: result.errors.join(" ") }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
