import { validatePlan } from "@/lib/allocation/engine";
import type { PlanInput } from "@/lib/allocation/types";
import { DEMO_PLAN, blankThresholds } from "@/lib/desk/book";
import type { DeskRecord } from "@/lib/desk/book";

export const DESK_KEY = "sathorn.desk";
const LOCALE_KEY = "sathorn.locale";

export function demoRecord(): DeskRecord {
  return {
    version: 1,
    mode: "demo",
    plan: DEMO_PLAN,
    savedAt: new Date().toISOString(),
    dismissed: [],
    thresholds: blankThresholds(),
  };
}

export function readDesk(): DeskRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DESK_KEY);
  if (!raw) return null;
  try {
    return parseDesk(raw);
  } catch {
    return null;
  }
}

export function writeDesk(record: DeskRecord) {
  window.localStorage.setItem(DESK_KEY, JSON.stringify(record));
  window.dispatchEvent(new Event("sathorn-desk"));
}

export function clearDesk() {
  window.localStorage.removeItem(DESK_KEY);
  window.dispatchEvent(new Event("sathorn-desk"));
}

export function parseDesk(raw: string): DeskRecord {
  const value = JSON.parse(raw) as Partial<DeskRecord>;
  if (!value || value.version !== 1 || !value.plan) {
    throw new Error("This file is not a Sathorn desk.");
  }
  const errors = validatePlan(value.plan as PlanInput);
  if (errors.length) throw new Error(errors.join(" "));
  return {
    version: 1,
    mode: value.mode === "demo" ? "demo" : "custom",
    plan: value.plan as PlanInput,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : new Date().toISOString(),
    dismissed: Array.isArray(value.dismissed) ? value.dismissed.filter((item) => typeof item === "string") : [],
    thresholds: {
      priceMovePct: numberOr(value.thresholds?.priceMovePct, 0.08),
      driftPp: numberOr(value.thresholds?.driftPp, 0.05),
      sentimentDelta: numberOr(value.thresholds?.sentimentDelta, 0.35),
    },
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1 ? value : fallback;
}

export function readLocale(): "en" | "th" {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(LOCALE_KEY) === "th" ? "th" : "en";
}

export function writeLocale(locale: "en" | "th") {
  window.localStorage.setItem(LOCALE_KEY, locale);
}
