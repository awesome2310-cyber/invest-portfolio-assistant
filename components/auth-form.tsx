"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n-provider";
import { DemoButton } from "@/components/shell";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name"),
        next: new URLSearchParams(window.location.search).get("next"),
      }),
    });
    const payload = (await response.json()) as { error?: string; next?: string };
    if (!response.ok) {
      setError(payload.error || t("auth.error"));
      setPending(false);
      return;
    }
    router.push(payload.next || (mode === "login" ? "/dashboard" : "/plan"));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-heading text-4xl tracking-tight">
        {mode === "login" ? t("auth.signInTitle") : t("auth.registerTitle")}
      </h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === "register" ? (
          <div>
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input id="name" name="name" required className="mt-2 h-11" />
            <p className="mt-1 text-xs text-muted-foreground">{t("auth.nameHint")}</p>
          </div>
        ) : null}
        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="mt-2 h-11" />
        </div>
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="mt-2 h-11"
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="h-11 px-4" disabled={pending}>
          {mode === "login" ? t("auth.submitSignIn") : t("auth.submitRegister")}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">{t("auth.demoHint")}</p>
      <div className="mt-3">
        <DemoButton label={t("nav.demo")} variant="outline" />
      </div>
    </div>
  );
}
