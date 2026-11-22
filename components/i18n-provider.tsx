"use client";

import { createContext, useContext } from "react";
import { translate, type Dictionary } from "@/lib/i18n";

const I18nContext = createContext<(key: string, vars?: Record<string, string | number>) => string>(
  (key) => key,
);

export function I18nProvider({
  dict,
  children,
}: {
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <I18nContext.Provider value={(key, vars) => translate(dict, key, vars)}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
