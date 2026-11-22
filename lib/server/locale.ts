import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return jar.get("sathorn_locale")?.value === "th" ? "th" : "en";
}
