import { buildAllocation } from "./engine";
import { buildInstruments } from "./instruments";
import { projectPortfolio } from "./montecarlo";
import type { PlanInput, PlanResult } from "./types";
import type { PriceBook } from "./instruments";
import { DEFAULT_FX_USDTHB } from "./assumptions";
import { validatePlan } from "./engine";
import type { AssetClass } from "./types";

export interface BuildPlanOptions {
  fx?: number;
  prices?: PriceBook;
  vols?: Partial<Record<AssetClass, number>>;
  returns?: Partial<Record<AssetClass, number>>;
  paths?: number;
  seed?: number;
  includeProjection?: boolean;
}

export function buildPlan(input: PlanInput, options: BuildPlanOptions = {}): PlanResult {
  const errors = validatePlan(input);
  if (errors.length) {
    throw new Error(errors.join(" "));
  }
  const fx = options.fx && options.fx > 0 ? options.fx : DEFAULT_FX_USDTHB;
  const allocation = buildAllocation(input, {
    vols: options.vols,
    returns: options.returns,
  });
  const built = buildInstruments(input, allocation.weights, {
    fx,
    prices: options.prices,
  });
  const projection =
    options.includeProjection === false
      ? {
          points: [],
          medianMaxDrawdown: 0,
          severeMaxDrawdown: 0,
          terminal: { p10: input.amount, p50: input.amount, p90: input.amount },
          paths: 0,
          rebalancedMonthly: true,
        }
      : projectPortfolio(input, {
          paths: options.paths,
          seed: options.seed,
          vols: options.vols,
          returns: options.returns,
        });
  return {
    input,
    allocation,
    projection,
    instruments: built.instruments,
    fx,
    warnings: [...allocation.warnings, ...built.warnings],
  };
}
