import { NextResponse } from "next/server";
import { startSession } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { DEMO_LOGIN } from "@/lib/server/seed";

export async function POST() {
  const row = getDb().prepare("SELECT id FROM users WHERE email = ?").get(DEMO_LOGIN.email) as { id: string } | undefined;
  if (!row) return NextResponse.json({ error: "Demo desk is missing." }, { status: 500 });
  await startSession(row.id);
  return NextResponse.json({ ok: true, next: "/dashboard" });
}
