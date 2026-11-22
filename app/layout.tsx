import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { Shell } from "@/components/shell";
import { dictionaryFor } from "@/lib/i18n";
import { currentUser } from "@/lib/server/auth";
import { getLocale } from "@/lib/server/locale";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Sathorn",
  description: "A personal investing desk for someone based in Bangkok. What to hold, while you hold it, and when to rebalance.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const user = await currentUser();
  return (
    <html lang={locale}>
      <body className={`${outfit.variable} ${fraunces.variable} antialiased`}>
        <I18nProvider dict={dictionaryFor(locale)}>
          <Shell
            locale={locale}
            user={user ? { name: user.name, email: user.email, isDemo: Boolean(user.is_demo) } : null}
          >
            {children}
          </Shell>
        </I18nProvider>
      </body>
    </html>
  );
}
