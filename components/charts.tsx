"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import type { AssetClass, ProjectionPoint, Weights } from "@/lib/allocation/types";
import { formatMoney, formatPct } from "@/lib/format";
import { useT } from "@/components/i18n-provider";
import type { Currency } from "@/lib/allocation/types";

export const ASSET_COLORS: Record<AssetClass, string> = {
  thai_equity: "#1f6f6a",
  global_equity: "#24312e",
  em_equity: "#6e8b74",
  bonds: "#a6843d",
  gold: "#c4a15a",
  reit: "#b4532a",
  cash: "#c8bfb0",
};

export function MixDonut({ weights }: { weights: Weights }) {
  const t = useT();
  const data = (Object.keys(weights) as AssetClass[])
    .filter((key) => weights[key] > 0.004)
    .map((key) => ({
      key,
      name: t(`asset.${key}`),
      value: Math.round(weights[key] * 1000) / 10,
    }));
  return (
    <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} stroke="none">
              {data.map((entry) => (
                <Cell key={entry.key} fill={ASSET_COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${value}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((entry) => (
          <li key={entry.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: ASSET_COLORS[entry.key] }} />
              {entry.name}
            </span>
            <span className="tabular-nums text-muted-foreground">{entry.value.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FanChart({
  points,
  currency,
}: {
  points: ProjectionPoint[];
  currency: Currency;
}) {
  const data = points.filter((point, index) => index % (points.length > 180 ? 2 : 1) === 0 || index === points.length - 1);
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e6dfd2" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(month: number) => (month % 12 === 0 ? `${month / 12}y` : "")}
            stroke="#8a8175"
            fontSize={12}
          />
          <YAxis
            tickFormatter={(value: number) =>
              new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)
            }
            stroke="#8a8175"
            fontSize={12}
            width={48}
          />
          <Tooltip
            formatter={(value, name) => [formatMoney(Number(value), currency), String(name)]}
            labelFormatter={(month) => `Month ${month}`}
          />
          <Line dataKey="p90" stroke="#1f6f6a" strokeDasharray="4 4" dot={false} strokeWidth={1.5} name="90th" />
          <Line dataKey="p50" stroke="#24312e" dot={false} strokeWidth={2} name="Median" />
          <Line dataKey="p10" stroke="#b4532a" strokeDasharray="4 4" dot={false} strokeWidth={1.5} name="10th" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PerformanceChart({
  series,
}: {
  series: { date: string; portfolio: number; benchmark: number }[];
}) {
  const data = series.filter((point, index) => index % (series.length > 220 ? 2 : 1) === 0 || index === series.length - 1);
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e6dfd2" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(2, 7)} minTickGap={24} stroke="#8a8175" fontSize={12} />
          <YAxis domain={["auto", "auto"]} stroke="#8a8175" fontSize={12} width={40} />
          <Tooltip formatter={(value) => Number(value).toFixed(1)} />
          <Line dataKey="portfolio" name="Desk" stroke="#1f6f6a" dot={false} strokeWidth={2} />
          <Line dataKey="benchmark" name="Blend" stroke="#b4532a" dot={false} strokeWidth={1.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriceChart({ bars }: { bars: { date: string; close: number }[] }) {
  const data = bars.filter((point, index) => index % (bars.length > 220 ? 2 : 1) === 0 || index === bars.length - 1);
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e6dfd2" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(2, 7)} minTickGap={28} stroke="#8a8175" fontSize={12} />
          <YAxis domain={["auto", "auto"]} stroke="#8a8175" fontSize={12} width={48} />
          <Tooltip />
          <Line dataKey="close" name="Close" stroke="#1f6f6a" dot={false} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function formatPctLabel(value: number) {
  return formatPct(value);
}
