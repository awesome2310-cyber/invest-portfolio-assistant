import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { startSession, verifyPassword } from "@/lib/server/auth";

function safeNext(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; next?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const row = getDb()
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .get(email) as { id: string; password_hash: string } | undefined;
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return NextResponse.json({ error: "Email or password is wrong." }, { status: 401 });
  }
  await startSession(row.id);
  const hasPortfolio = getDb().prepare("SELECT id FROM portfolios WHERE user_id = ?").get(row.id);
  const fallback = hasPortfolio ? "/dashboard" : "/plan";
  return NextResponse.json({ ok: true, next: safeNext(body.next, fallback) });
}
