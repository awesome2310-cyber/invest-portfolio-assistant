"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/components/i18n-provider";
import { demoRecord, writeDesk } from "@/lib/storage";

export function Wordmark() {
  return (
    <Link href="/" className="font-heading text-2xl tracking-tight text-foreground">
      Sathorn
    </Link>
  );
}

export function LocaleSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex rounded-full border border-border p-0.5 text-xs" aria-label="Language">
      {(["en", "th"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={`rounded-full px-2 py-1 uppercase ${code === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

export function DemoButton({ label, variant = "default" }: { label: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      className="h-11 px-4"
      onClick={() => {
        writeDesk(demoRecord());
        router.push("/dashboard");
      }}
    >
      {label}
    </Button>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const links = [
    { href: "/plan", label: t("nav.plan") },
    { href: "/dashboard", label: t("nav.desk") },
    { href: "/alerts", label: t("nav.alerts") },
  ];
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <Wordmark />
            <span className="hidden text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              {t("eyebrow")}
            </span>
          </div>
          <nav className="hidden items-center gap-5 text-sm md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname.startsWith(link.href) ? "text-foreground" : "text-muted-foreground"}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/method" className="text-muted-foreground">
              {t("nav.method")}
            </Link>
          </nav>
          <LocaleSwitch />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 pb-24">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl">{t("disclaimer.short")}</p>
          <Link href="/disclaimer" className="underline underline-offset-4">
            {t("disclaimer.link")}
          </Link>
        </div>
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-3">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`block py-3 text-center text-sm ${pathname.startsWith(link.href) ? "text-foreground" : "text-muted-foreground"}`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
