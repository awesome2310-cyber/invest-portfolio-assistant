export const ASSET_CLASSES = [
  "thai_equity",
  "global_equity",
  "em_equity",
  "bonds",
  "gold",
  "reit",
  "cash",
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

export type Currency = "THB" | "USD";
export type MarketPreference = "thai" | "balanced" | "global";
export type TaxWrapper = "none" | "thaiesg" | "rmf" | "ssf";
export type RiskProfile =
  | "conservative"
  | "moderate"
  | "balanced"
  | "growth"
  | "aggressive";

export type Weights = Record<AssetClass, number>;

export interface PlanInput {
  timelineYears: number;
  amount: number;
  currency: Currency;
  riskScore: number;
  monthlyContribution: number;
  marketPreference: MarketPreference;
  taxWrapper: TaxWrapper;
}

export interface AssetAssumption {
  id: AssetClass;
  label: string;
  expectedReturn: number;
  volatility: number;
  maxDrawdown: number;
}

export interface Allocation {
  weights: Weights;
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  profile: RiskProfile;
  targetReturn: number;
  equityWeight: number;
  defensiveWeight: number;
  steps: string[];
  warnings: string[];
  method: string;
}

export interface ProjectionPoint {
  month: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface Projection {
  points: ProjectionPoint[];
  medianMaxDrawdown: number;
  severeMaxDrawdown: number;
  terminal: { p10: number; p50: number; p90: number };
  paths: number;
  rebalancedMonthly: boolean;
}

export interface AccessNote {
  channel: "thai_broker" | "bank_fund" | "offshore_broker" | "set_dr";
  title: string;
  detail: string;
}

export interface InstrumentLine {
  id: string;
  symbol: string;
  yahooSymbol: string | null;
  proxyYahoo: string | null;
  name: string;
  assetClass: AssetClass;
  vehicle: "etf" | "mutual_fund" | "stock" | "reit";
  listing: "SET" | "US" | "unlisted";
  tradingCurrency: Currency;
  expenseRatio: number | null;
  expenseNote: string;
  targetWeight: number;
  amount: number;
  units: number;
  unitNote: string;
  price: number;
  priceNote: string;
  role: "core" | "satellite" | "residual";
  access: AccessNote[];
  note?: string;
}

export interface PlanResult {
  input: PlanInput;
  allocation: Allocation;
  projection: Projection;
  instruments: InstrumentLine[];
  fx: number;
  warnings: string[];
}
