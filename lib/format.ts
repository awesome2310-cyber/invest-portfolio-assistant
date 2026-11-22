import type { Currency } from "@/lib/allocation/types";

export function formatMoney(amount: number, currency: Currency): string {
  const digits = Math.abs(amount) >= 1000 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(amount);
}

export function formatUnits(units: number): string {
  if (!Number.isFinite(units)) return "—";
  if (Math.abs(units) >= 100) {
    return units.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return units.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  const points = value * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(digits)}%`;
}

export function formatRatio(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "See factsheet";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatCompactDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
