import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { dismissAlert, updateThresholds } from "@/lib/server/desk";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    intent?: string;
    id?: string;
    priceMovePct?: number;
    driftPp?: number;
    sentimentDelta?: number;
  };
  if (body.intent === "dismiss" && body.id) {
    dismissAlert(user.id, body.id);
    return NextResponse.json({ ok: true });
  }
  if (body.intent === "settings") {
    const priceMovePct = Number(body.priceMovePct);
    const driftPp = Number(body.driftPp);
    const sentimentDelta = Number(body.sentimentDelta);
    if (![priceMovePct, driftPp, sentimentDelta].every((value) => Number.isFinite(value) && value > 0 && value < 1)) {
      return NextResponse.json({ error: "Bands must be between 0 and 1." }, { status: 400 });
    }
    updateThresholds(user.id, { priceMovePct, driftPp, sentimentDelta });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown request." }, { status: 400 });
}
