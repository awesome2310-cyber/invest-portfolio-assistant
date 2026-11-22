import { ACCESS } from "./access";
import { DEFAULT_FX_USDTHB } from "./assumptions";
import type {
  AccessNote,
  AssetClass,
  Currency,
  InstrumentLine,
  MarketPreference,
  PlanInput,
  TaxWrapper,
  Weights,
} from "./types";

export const THAIESG_ANNUAL_CAP_THB = 300_000;
export const BOARD_LOT = 100;

export interface PriceBook {
  [symbol: string]: number;
}

/** Market quotes observed from Yahoo on 22 Nov 2026, plus round NAVs for funds Yahoo does not list. */
export const REFERENCE_PRICES: PriceBook = {
  "TDEX.BK": 9.88,
  "PTT.BK": 37.4,
  "AOT.BK": 60.5,
  "ADVANC.BK": 336,
  VOO: 635.54,
  VXUS: 75.38,
  VWO: 50.62,
  BND: 71.33,
  IAU: 66.23,
  VNQ: 92.56,
  SGOV: 100.64,
  GLD: 322.87,
  "CPNREIT.BK": 13.2,
  "WHART.BK": 10.65,
  "K-US500X-A(A)": 15,
  "SCBTP(ThaiESGA)": 12,
  "K-FIXED-A": 12.4,
  "K-GOLD-A(A)": 14.8,
  "K-CASH": 13.2,
};

export interface CatalogItem {
  id: string;
  symbol: string;
  yahooSymbol: string | null;
  proxyYahoo: string | null;
  name: string;
  assetClass: AssetClass;
  vehicle: InstrumentLine["vehicle"];
  listing: InstrumentLine["listing"];
  tradingCurrency: Currency;
  expenseRatio: number | null;
  expenseNote: string;
  priceNote: string;
  role: "core" | "satellite";
  access: AccessNote[];
  annualReturn: number;
  annualVol: number;
}

export const CATALOG: CatalogItem[] = [
  {
    id: "tdex",
    symbol: "TDEX.BK",
    yahooSymbol: "TDEX.BK",
    proxyYahoo: null,
    name: "ThaiDEX SET50 ETF",
    assetClass: "thai_equity",
    vehicle: "etf",
    listing: "SET",
    tradingCurrency: "THB",
    expenseRatio: 0.00509,
    expenseNote:
      "Total fund expenses 0.509% of NAV, ONEAM factsheet as of 30 Sep 2026. Tracks the SET50 total return index. Confirm before you buy.",
    priceNote: "SET market price.",
    role: "core",
    access: [ACCESS.setEtf, ACCESS.dr],
    annualReturn: 0.08,
    annualVol: 0.18,
  },
  {
    id: "scbtp-thaiesg",
    symbol: "SCBTP(ThaiESGA)",
    yahooSymbol: null,
    proxyYahoo: "TDEX.BK",
    name: "SCB Thai Sustainable Equity Passive, ThaiESG accumulation",
    assetClass: "thai_equity",
    vehicle: "mutual_fund",
    listing: "unlisted",
    tradingCurrency: "THB",
    expenseRatio: null,
    expenseNote:
      "Passive Thai equity fund aiming at the SETESG total return index. The expense ratio is on the SCBAM factsheet and is not hardcoded here.",
    priceNote:
      "Reference NAV of 12 baht, for unit arithmetic only. The chart is a proxy that follows TDEX, not the fund's official NAV.",
    role: "core",
    access: [ACCESS.bankFund],
    annualReturn: 0.08,
    annualVol: 0.18,
  },
  {
    id: "ptt",
    symbol: "PTT.BK",
    yahooSymbol: "PTT.BK",
    proxyYahoo: null,
    name: "PTT",
    assetClass: "thai_equity",
    vehicle: "stock",
    listing: "SET",
    tradingCurrency: "THB",
    expenseRatio: 0,
    expenseNote: "No fund expense. Brokerage commission is the broker's tariff.",
    priceNote: "SET market price.",
    role: "satellite",
    access: [ACCESS.setStock],
    annualReturn: 0.08,
    annualVol: 0.22,
  },
  {
    id: "aot",
    symbol: "AOT.BK",
    yahooSymbol: "AOT.BK",
    proxyYahoo: null,
    name: "Airports of Thailand",
    assetClass: "thai_equity",
    vehicle: "stock",
    listing: "SET",
    tradingCurrency: "THB",
    expenseRatio: 0,
    expenseNote: "No fund expense. Brokerage commission is the broker's tariff.",
    priceNote: "SET market price.",
    role: "satellite",
    access: [ACCESS.setStock],
    annualReturn: 0.08,
    annualVol: 0.24,
  },
  {
    id: "advanc",
    symbol: "ADVANC.BK",
    yahooSymbol: "ADVANC.BK",
    proxyYahoo: null,
    name: "Advanced Info Service",
    assetClass: "thai_equity",
    vehicle: "stock",
    listing: "SET",
    tradingCurrency: "THB",
    expenseRatio: 0,
    expenseNote: "No fund expense. Brokerage commission is the broker's tariff.",
    priceNote: "SET market price.",
    role: "satellite",
    access: [ACCESS.setStock],
    annualReturn: 0.08,
    annualVol: 0.2,
  },
  {
    id: "voo",
    symbol: "VOO",
    yahooSymbol: "VOO",
    proxyYahoo: null,
    name: "Vanguard S&P 500 ETF",
    assetClass: "global_equity",
    vehicle: "etf",
    listing: "US",
    tradingCurrency: "USD",
    expenseRatio: 0.0003,
    expenseNote: "Vanguard expense ratio 0.03%. Confirm on the issuer page.",
    priceNote: "US market price, converted at the desk USD/THB rate.",
    role: "core",
    access: [ACCESS.offshore, ACCESS.dr],
    annualReturn: 0.09,
    annualVol: 0.16,
  },
  {
    id: "vxus",
    symbol: "VXUS",
    yahooSymbol: "VXUS",
    proxyYahoo: null,
    name: "Vanguard Total International Stock ETF",
    assetClass: "global_equity",
    vehicle: "etf",
    listing: "US",
    tradingCurrency: "USD",
    expenseRatio: 0.0005,
    expenseNote:
      "Vanguard expense ratio about 0.05% for developed and emerging markets outside the US. Confirm on the issuer page. It overlaps the emerging-markets sleeve, so it is only used on a global tilt.",
    priceNote: "US market price, converted at the desk USD/THB rate.",
    role: "core",
    access: [ACCESS.offshore],
    annualReturn: 0.085,
    annualVol: 0.17,
  },
  {
    id: "k-us500x",
    symbol: "K-US500X-A(A)",
    yahooSymbol: null,
    proxyYahoo: "VOO",
    name: "K US Equity Passive Fund-A(A)",
    assetClass: "global_equity",
    vehicle: "mutual_fund",
    listing: "unlisted",
    tradingCurrency: "THB",
    expenseRatio: null,
    expenseNote:
      "Kasikorn feeder into iShares Core S&P 500 ETF (IVV), whose issuer expense ratio is 0.03%. The Thai feeder adds its own fee. KAsset factsheet as of 30 Sep 2026. FX hedging is dynamic, at the manager's discretion.",
    priceNote:
      "Reference NAV of 15 baht, for unit arithmetic only. The chart follows VOO and is not the fund's official NAV.",
    role: "core",
    access: [ACCESS.bankFund],
    annualReturn: 0.09,
    annualVol: 0.16,
  },
  {
    id: "vwo",
    symbol: "VWO",
    yahooSymbol: "VWO",
    proxyYahoo: null,
    name: "Vanguard FTSE Emerging Markets ETF",
    assetClass: "em_equity",
    vehicle: "etf",
    listing: "US",
    tradingCurrency: "USD",
    expenseRatio: 0.0007,
    expenseNote: "Vanguard expense ratio about 0.07%. Confirm on the issuer page.",
    priceNote: "US market price, converted at the desk USD/THB rate.",
    role: "core",
    access: [ACCESS.offshore],
    annualReturn: 0.095,
    annualVol: 0.22,
  },
  {
    id: "k-fixed",
    symbol: "K-FIXED-A",
    yahooSymbol: null,
    proxyYahoo: null,
    name: "K Fixed Income Fund-A",
    assetClass: "bonds",
    vehicle: "mutual_fund",
    listing: "unlisted",
    tradingCurrency: "THB",
    expenseRatio: 0.004906,
    expenseNote:
      "Total fee 0.491% of NAV, KAsset factsheet as of 30 Sep 2026. Thai government and investment-grade corporate bonds. This share class is not itself an RMF.",
    priceNote: "Reference NAV of 12.40 baht, for unit arithmetic only.",
    role: "core",
    access: [ACCESS.bankFund],
    annualReturn: 0.038,
    annualVol: 0.04,
  },
  {
    id: "bnd",
    symbol: "BND",
    yahooSymbol: "BND",
    proxyYahoo: null,
    name: "Vanguard Total Bond Market ETF",
    assetClass: "bonds",
    vehicle: "etf",
    listing: "US",
    tradingCurrency: "USD",
    expenseRatio: 0.0003,
    expenseNote:
      "Vanguard expense ratio 0.03%. US investment-grade bonds, unhedged, so the baht value moves with USD/THB.",
    priceNote: "US market price, converted at the desk USD/THB rate.",
    role: "core",
    access: [ACCESS.offshore],
    annualReturn: 0.04,
    annualVol: 0.06,
  },
  {
    id: "k-gold",
    symbol: "K-GOLD-A(A)",
    yahooSymbol: null,
    proxyYahoo: "GLD",
    name: "K Gold Fund-A(A)",
    assetClass: "gold",
    vehicle: "mutual_fund",
    listing: "unlisted",
    tradingCurrency: "THB",
    expenseRatio: 0.009984,
    expenseNote:
      "Total fee 0.998% of NAV, KAsset factsheet as of 30 Oct 2026. Feeder into SPDR Gold Trust, with the baht exposure fully hedged.",
    priceNote:
      "Reference NAV of 14.80 baht, for unit arithmetic only. The chart follows GLD and is not the fund's official NAV.",
    role: "core",
    access: [ACCESS.bankFund],
    annualReturn: 0.06,
    annualVol: 0.15,
  },
  {
    id: "iau",
    symbol: "IAU",
    yahooSymbol: "IAU",
    proxyYahoo: null,
    name: "iShares Gold Trust",
    assetClass: "gold",
    vehicle: "etf",
    listing: "US",
    tradingCurrency: "USD",
    expenseRatio: 0.0025,
    expenseNote:
      "iShares expense ratio 0.25%. Unhedged gold. The baht value moves with both the gold price and USD/THB.",
    priceNote: "US market price, converted at the desk USD/THB rate.",
    role: "core",
    access: [ACCESS.offshore],
    annualReturn: 0.06,
    annualVol: 0.16,
  },
  {
    id: "cpnreit",
    symbol: "CPNREIT.BK",
    yahooSymbol: "CPNREIT.BK",
    proxyYahoo: null,
    name: "CPN Retail Growth Leasehold REIT",
    assetClass: "reit",
    vehicle: "reit",
    listing: "SET",
    tradingCurrency: "THB",
    expenseRatio: null,
    expenseNote:
      "A trust, not a mutual fund. Costs sit in the trust deed rather than a single expense ratio.",
    priceNote: "SET market price.",
    role: "core",
    access: [ACCESS.setReit],
    annualReturn: 0.07,
    annualVol: 0.16,
  },
  {
    id: "whart",
    symbol: "WHART.BK",
    yahooSymbol: "WHART.BK",
    proxyYahoo: null,
    name: "WHA Premium Growth REIT",
    assetClass: "reit",
    vehicle: "reit",
    listing: "SET",
    tradingCurrency: "THB",
    expenseRatio: null,
    expenseNote:
      "Industrial and logistics REIT. Costs sit in the trust deed. Lease terms matter more than a headline yield.",
    priceNote: "SET market price.",
    role: "core",
    access: [ACCESS.setReit],
    annualReturn: 0.07,
    annualVol: 0.16,
  },
  {
    id: "vnq",
    symbol: "VNQ",
    yahooSymbol: "VNQ",
    proxyYahoo: null,
    name: "Vanguard Real Estate ETF",
    assetClass: "reit",
    vehicle: "etf",
    listing: "US",
    tradingCurrency: "USD",
    expenseRatio: 0.0013,
    expenseNote: "Vanguard expense ratio 0.13%. US listed property, unhedged.",
    priceNote: "US market price, converted at the desk USD/THB rate.",
    role: "core",
    access: [ACCESS.offshore],
    annualReturn: 0.07,
    annualVol: 0.18,
  },
  {
    id: "k-cash",
    symbol: "K-CASH",
    yahooSymbol: null,
    proxyYahoo: null,
    name: "K Cash Management Fund",
    assetClass: "cash",
    vehicle: "mutual_fund",
    listing: "unlisted",
    tradingCurrency: "THB",
    expenseRatio: null,
    expenseNote:
      "Thai money-market fund investing in short government and Bank of Thailand paper. The fee is on the KAsset factsheet.",
    priceNote: "Reference NAV of 13.20 baht, for unit arithmetic only.",
    role: "core",
    access: [ACCESS.bankFund],
    annualReturn: 0.02,
    annualVol: 0.004,
  },
  {
    id: "sgov",
    symbol: "SGOV",
    yahooSymbol: "SGOV",
    proxyYahoo: null,
    name: "iShares 0-3 Month Treasury Bond ETF",
    assetClass: "cash",
    vehicle: "etf",
    listing: "US",
    tradingCurrency: "USD",
    expenseRatio: 0.0009,
    expenseNote:
      "iShares expense ratio about 0.09%. US T-bills, unhedged, so this is dollar cash rather than baht cash.",
    priceNote: "US market price, converted at the desk USD/THB rate.",
    role: "core",
    access: [ACCESS.offshore],
    annualReturn: 0.04,
    annualVol: 0.005,
  },
];

export function catalogById(id: string): CatalogItem {
  const item = CATALOG.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown instrument ${id}`);
  return item;
}

function priceOf(id: string, prices?: PriceBook): number {
  const item = catalogById(id);
  return prices?.[item.symbol] ?? REFERENCE_PRICES[item.symbol];
}

interface Slice {
  id: string;
  weight: number;
  role?: InstrumentLine["role"];
  note?: string;
}

function pushSlice(slices: Slice[], id: string, weight: number, note?: string, role?: InstrumentLine["role"]) {
  if (weight <= 0.0005) return;
  slices.push({ id, weight, note, role });
}

function thaiEquitySlices(
  weight: number,
  amountThb: number,
  riskScore: number,
  preference: MarketPreference,
  tax: TaxWrapper,
  prices: PriceBook | undefined,
): { slices: Slice[]; warnings: string[] } {
  const warnings: string[] = [];
  const slices: Slice[] = [];
  let left = weight;
  if (tax === "thaiesg" && amountThb > 0 && weight > 0) {
    const capWeight = Math.min(weight, THAIESG_ANNUAL_CAP_THB / amountThb);
    pushSlice(
      slices,
      "scbtp-thaiesg",
      capWeight,
      "Sized to the 300,000 baht ThaiESG annual cap for purchases through 31 Dec 2026, or to this sleeve if the sleeve is smaller. The deduction is also limited to 30% of assessable income. Units bought in this window need a five-year hold. From 1 Jan 2027 the published terms revert toward a 100,000 baht cap and an eight-year hold. Confirm the Revenue Department notice before you subscribe.",
    );
    left -= capWeight;
    if (capWeight * amountThb + 1 < THAIESG_ANNUAL_CAP_THB && left <= 0) {
      warnings.push(
        "The Thai equity sleeve is under the 300,000 baht ThaiESG cap, so the whole sleeve is shown in SCBTP(ThaiESGA). The income test can still bind.",
      );
    }
  }
  const wantSatellites = riskScore >= 60 && preference !== "global" && left > 0;
  if (wantSatellites) {
    const satelliteBudget = left * 0.3;
    const names = ["ptt", "aot", "advanc"] as const;
    let unused = 0;
    for (const name of names) {
      const lineThb = (satelliteBudget / names.length) * amountThb;
      const lot = priceOf(name, prices) * BOARD_LOT;
      if (lineThb + 1e-6 < lot) {
        unused += satelliteBudget / names.length;
        warnings.push(
          `${catalogById(name).symbol} needs about ${Math.round(lot).toLocaleString("en-US")} baht for one board lot, and this line is smaller, so it stays in TDEX.`,
        );
      } else {
        pushSlice(slices, name, satelliteBudget / names.length, undefined, "satellite");
      }
    }
    left -= satelliteBudget;
    left += unused;
  }
  pushSlice(slices, "tdex", left);
  return { slices, warnings };
}

function globalSlices(weight: number, preference: MarketPreference): Slice[] {
  const slices: Slice[] = [];
  if (preference === "global") {
    pushSlice(slices, "voo", weight * 0.55);
    pushSlice(slices, "vxus", weight * 0.2);
    pushSlice(slices, "k-us500x", weight * 0.25);
  } else if (preference === "thai") {
    pushSlice(slices, "voo", weight * 0.25);
    pushSlice(slices, "k-us500x", weight * 0.75);
  } else {
    pushSlice(slices, "voo", weight * 0.5);
    pushSlice(slices, "k-us500x", weight * 0.5);
  }
  return slices;
}

function bondSlices(weight: number, preference: MarketPreference): Slice[] {
  const slices: Slice[] = [];
  if (preference === "global") {
    pushSlice(slices, "k-fixed", weight * 0.55);
    pushSlice(slices, "bnd", weight * 0.45);
  } else if (preference === "thai") {
    pushSlice(slices, "k-fixed", weight);
  } else {
    pushSlice(slices, "k-fixed", weight * 0.8);
    pushSlice(slices, "bnd", weight * 0.2);
  }
  return slices;
}

function goldSlices(weight: number, preference: MarketPreference): Slice[] {
  const slices: Slice[] = [];
  if (preference === "global") {
    pushSlice(slices, "iau", weight * 0.6);
    pushSlice(slices, "k-gold", weight * 0.4);
  } else if (preference === "thai") {
    pushSlice(slices, "k-gold", weight);
  } else {
    pushSlice(slices, "k-gold", weight * 0.7);
    pushSlice(slices, "iau", weight * 0.3);
  }
  return slices;
}

function reitSlices(weight: number, preference: MarketPreference): Slice[] {
  const slices: Slice[] = [];
  if (preference === "global") {
    pushSlice(slices, "vnq", weight * 0.6);
    pushSlice(slices, "cpnreit", weight * 0.25);
    pushSlice(slices, "whart", weight * 0.15);
  } else if (preference === "thai") {
    pushSlice(slices, "cpnreit", weight * 0.55);
    pushSlice(slices, "whart", weight * 0.45);
  } else {
    pushSlice(slices, "cpnreit", weight * 0.45);
    pushSlice(slices, "whart", weight * 0.35);
    pushSlice(slices, "vnq", weight * 0.2);
  }
  return slices;
}

function cashSlices(weight: number, preference: MarketPreference, currency: Currency): Slice[] {
  const slices: Slice[] = [];
  if (preference === "global" && currency === "USD") {
    pushSlice(slices, "sgov", weight * 0.6);
    pushSlice(slices, "k-cash", weight * 0.4);
  } else if (preference === "global") {
    pushSlice(slices, "k-cash", weight * 0.7);
    pushSlice(slices, "sgov", weight * 0.3);
  } else {
    pushSlice(slices, "k-cash", weight);
  }
  return slices;
}

function toThb(amount: number, currency: Currency, fx: number): number {
  return currency === "THB" ? amount : amount * fx;
}

function fromThb(amountThb: number, currency: Currency, fx: number): number {
  return currency === "THB" ? amountThb : amountThb / fx;
}

function lineFromSlice(
  slice: Slice,
  amount: number,
  currency: Currency,
  fx: number,
  prices: PriceBook | undefined,
): InstrumentLine | null {
  const item = catalogById(slice.id);
  const price = priceOf(slice.id, prices);
  const amountThb = toThb(amount, currency, fx) * slice.weight;
  if (!(amountThb > 0) || !(price > 0)) return null;
  const tradableThb = item.tradingCurrency === "THB" ? amountThb : amountThb / fx;
  let units = tradableThb / price;
  let spentThb = amountThb;
  let unitNote = "Fractional units, which a fund or a US broker that supports them can hold.";
  if (item.listing === "SET") {
    units = Math.floor(units / BOARD_LOT) * BOARD_LOT;
    const unitPriceThb = price;
    spentThb = units * unitPriceThb;
    unitNote =
      units === 0
        ? "Below one board lot of 100, so this line is left in cash."
        : "Rounded down to a board lot of 100. The leftover baht is parked in K-CASH.";
  } else {
    units = Math.round(units * 10000) / 10000;
  }
  return {
    id: item.id,
    symbol: item.symbol,
    yahooSymbol: item.yahooSymbol,
    proxyYahoo: item.proxyYahoo,
    name: item.name,
    assetClass: item.assetClass,
    vehicle: item.vehicle,
    listing: item.listing,
    tradingCurrency: item.tradingCurrency,
    expenseRatio: item.expenseRatio,
    expenseNote: item.expenseNote,
    targetWeight: 0,
    amount: fromThb(spentThb, currency, fx),
    units,
    unitNote,
    price,
    priceNote: item.priceNote,
    role: slice.role ?? item.role,
    access: item.access,
    note: slice.note,
  };
}

export function buildInstruments(
  input: PlanInput,
  weights: Weights,
  options: { fx?: number; prices?: PriceBook } = {},
): { instruments: InstrumentLine[]; warnings: string[] } {
  const fx = options.fx && options.fx > 0 ? options.fx : DEFAULT_FX_USDTHB;
  const amountThb = toThb(input.amount, input.currency, fx);
  const warnings: string[] = [];
  const slices: Slice[] = [];

  const thai = thaiEquitySlices(
    weights.thai_equity,
    amountThb,
    input.riskScore,
    input.marketPreference,
    input.taxWrapper,
    options.prices,
  );
  warnings.push(...thai.warnings);
  slices.push(...thai.slices);
  slices.push(...globalSlices(weights.global_equity, input.marketPreference));
  slices.push(...[{ id: "vwo", weight: weights.em_equity }]);
  slices.push(...bondSlices(weights.bonds, input.marketPreference));
  slices.push(...goldSlices(weights.gold, input.marketPreference));
  slices.push(...reitSlices(weights.reit, input.marketPreference));
  slices.push(...cashSlices(weights.cash, input.marketPreference, input.currency));

  if (input.taxWrapper === "ssf") {
    warnings.push(
      "New SSF purchases are not deductible. The exemption covered units bought from 1 Jan 2020 through 31 Dec 2024. Units you already hold still have their own ten-year clock. This desk does not put new money into an SSF share class. ThaiESG and RMF are the wrappers that still have a deduction.",
    );
  }
  if (input.taxWrapper === "rmf") {
    warnings.push(
      "RMF is a holding rule, not a different asset. The deduction is 30% of assessable income and shares a 500,000 baht bucket with provident fund, GPF, NSF, and pension-insurance premiums. You generally hold until age 55, and at least five years from the first purchase, and you are not supposed to skip more than one year. This desk does not know your income, so it does not invent an RMF lot size. On your bank's fund app, filter the bond or equity fund you already chose and pick its RMF class if one exists. K-FIXED-A itself is not an RMF.",
    );
  }
  if (input.taxWrapper === "thaiesg") {
    warnings.push(
      "ThaiESG purchases from 1 Jan 2024 through 31 Dec 2026 can be deducted up to 30% of assessable income, capped at 300,000 baht, with a five-year hold counted from each purchase. That window closes at the end of 2026. Later purchases, on the terms published by PwC as of 15 Oct 2026, fall back toward 100,000 baht and an eight-year hold. This is a tax description, not tax advice.",
    );
  }
  if (weights.em_equity > 0) {
    warnings.push(
      "Emerging markets are implemented with VWO, a US-listed ETF. Reaching it means an offshore brokerage account. If you will not open one, fold that weight into the global feeder on your bank's platform and accept that you have dropped the emerging-markets sleeve.",
    );
  }

  const lines: InstrumentLine[] = [];
  let residualThb = 0;
  for (const slice of slices) {
    const line = lineFromSlice(slice, input.amount, input.currency, fx, options.prices);
    if (!line || !(line.units > 0)) {
      residualThb += toThb(input.amount, input.currency, fx) * slice.weight;
      continue;
    }
    const intendedThb = toThb(input.amount, input.currency, fx) * slice.weight;
    const spentThb = toThb(line.amount, input.currency, fx);
    residualThb += Math.max(0, intendedThb - spentThb);
    lines.push(line);
  }

  if (residualThb > 1) {
    const existing = lines.find((line) => line.id === "k-cash");
    const cashAmount = fromThb(residualThb, input.currency, fx);
    if (existing) {
      const price = existing.price;
      const addedUnits = (existing.tradingCurrency === "THB" ? residualThb : residualThb / fx) / price;
      existing.units = Math.round((existing.units + addedUnits) * 10000) / 10000;
      existing.amount += cashAmount;
      existing.unitNote = `${existing.unitNote} Includes board-lot leftovers.`.trim();
    } else {
      const cash = lineFromSlice(
        { id: "k-cash", weight: residualThb / amountThb, role: "residual" },
        input.amount,
        input.currency,
        fx,
        options.prices,
      );
      if (cash) {
        cash.role = "residual";
        cash.note = "Board-lot leftovers and lines too small to buy, parked in the money-market fund.";
        lines.push(cash);
      }
    }
  }

  const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0) || 1;
  for (const line of lines) line.targetWeight = line.amount / totalAmount;
  return { instruments: lines.filter((line) => line.amount > 0.5 && line.units > 0), warnings };
}
