import { NextResponse } from "next/server";
import { hashPassword, startSession } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; name?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim().slice(0, 80);
  if (!email.includes("@") || password.length < 8 || name.length < 1) {
    return NextResponse.json({ error: "Name, a real email, and a password of at least 8 characters." }, { status: 400 });
  }
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return NextResponse.json({ error: "That email already has a desk." }, { status: 409 });
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO users (id, email, name, password_hash, is_demo, created_at) VALUES (?, ?, ?, ?, 0, ?)").run(
    id,
    email,
    name,
    await hashPassword(password),
    new Date().toISOString(),
  );
  await startSession(id);
  return NextResponse.json({ ok: true, next: "/plan" });
}
