"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dictionaryFor, translate, type Locale } from "@/lib/i18n";
import { readLocale, writeLocale } from "@/lib/storage";

const I18nContext = createContext<{
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({
  t: (key) => key,
  locale: "en",
  setLocale: () => undefined,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    const saved = readLocale();
    setLocaleState(saved);
    document.documentElement.lang = saved;
  }, []);
  const value = useMemo(() => {
    const dict = dictionaryFor(locale);
    return {
      locale,
      setLocale: (next: Locale) => {
        writeLocale(next);
        setLocaleState(next);
        document.documentElement.lang = next;
      },
      t: (key: string, vars?: Record<string, string | number>) => translate(dict, key, vars),
    };
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext).t;
}

export function useLocale() {
  const { locale, setLocale } = useContext(I18nContext);
  return { locale, setLocale };
}
