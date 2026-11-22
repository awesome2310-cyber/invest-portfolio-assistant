import { ASSUMPTIONS, CORRELATION, METHOD_ID } from "@/lib/allocation/assumptions";
import { ASSET_CLASSES } from "@/lib/allocation/types";
import { dictionaryFor, translate } from "@/lib/i18n";
import { formatPct } from "@/lib/format";
import { getLocale } from "@/lib/server/locale";

export default async function MethodPage() {
  const dict = dictionaryFor(await getLocale());
  const t = (key: string) => translate(dict, key);
  return (
    <article className="max-w-3xl space-y-6 text-sm leading-relaxed">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{METHOD_ID}</p>
      <h1 className="font-heading text-4xl tracking-tight">{t("method.title")}</h1>
      <p className="text-muted-foreground">{t("method.note")}</p>
      <p>
        Sathorn does not optimise a live covariance matrix and then pretend the result is a forecast. It starts from five published strategic books, one for each end of the risk slider and three between them. Your score is a straight interpolation between the nearest two books.
      </p>
      <p>
        A glide path then scales the growth sleeves — Thai equities, global equities, emerging markets, and property — by how long the money can stay invested. Under two years the growth sleeves are cut in half, cash is kept at least at 12%, and bonds plus cash at least at 45%. Past twenty years the growth sleeves are lifted by about a tenth. Cash from that glide path is left alone. It is a liquidity bucket, not a risk asset.
      </p>
      <p>
        The other sleeves are a 65/35 blend. Sixty-five percent keeps the strategic shape. Thirty-five percent is inverse-volatility: a sleeve with half the volatility gets twice the weight inside that slice. The correlation matrix below is fixed, so two people with the same inputs get the same mix. Expected return is the weighted average of the planning returns. Volatility is the standard portfolio formula, the square root of w′Σw.
      </p>
      <p>
        A preference for Thailand or for global markets moves six percentage points between Thai and global equities. No leverage is used. If the slider's target return sits above what this long-only mix can pencil out, the desk says so instead of concentrating further in silence.
      </p>
      <p>
        The fan chart draws correlated monthly returns from those assumptions, resets the mix every month, and adds any contribution at month end. The drawdown shown is the median peak-to-trough across the paths, plus a rougher fifth-percentile path. None of this is a forecast of the SET or the S&P 500.
      </p>
      <h2 className="font-heading text-2xl">Planning assumptions</h2>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="p-3 font-medium">Sleeve</th>
              <th className="p-3 font-medium">Return</th>
              <th className="p-3 font-medium">Volatility</th>
              <th className="p-3 font-medium">Stress drawdown</th>
            </tr>
          </thead>
          <tbody>
            {ASSET_CLASSES.map((asset) => (
              <tr key={asset} className="border-t border-border">
                <td className="p-3">{ASSUMPTIONS[asset].label}</td>
                <td className="p-3 tabular-nums">{formatPct(ASSUMPTIONS[asset].expectedReturn)}</td>
                <td className="p-3 tabular-nums">{formatPct(ASSUMPTIONS[asset].volatility)}</td>
                <td className="p-3 tabular-nums">{formatPct(ASSUMPTIONS[asset].maxDrawdown)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Returns and volatilities are rounded long-run priors in baht terms for someone who spends in Thailand. They are not a statistical fit to a downloaded history. When a refresh has two years of prices, the desk can keep using these priors; it does not silently replace them with a noisy sample mean. The stress-drawdown column is context. The number on the plan screen comes from the simulation.
      </p>
      <h2 className="font-heading text-2xl">Correlations</h2>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              <th className="p-2" />
              {ASSET_CLASSES.map((asset) => (
                <th key={asset} className="p-2 font-medium">
                  {ASSUMPTIONS[asset].label.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CORRELATION.map((row, index) => (
              <tr key={ASSET_CLASSES[index]} className="border-t border-border">
                <th className="p-2 text-left font-medium">{ASSUMPTIONS[ASSET_CLASSES[index]].label.split(" ")[0]}</th>
                {row.map((value, column) => (
                  <td key={column} className="p-2 tabular-nums">
                    {value.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="font-heading text-2xl">From a sleeve to a ticket</h2>
      <p>
        Each sleeve is split across instruments a person in Thailand can actually reach: a SET-listed ETF or REIT through a Thai broker, a fund code on a bank platform, or a US-listed ETF through an offshore broker that accepts Thai residents. Interactive Brokers has historically onboarded residents of Thailand; that is access context, not a recommendation, and the firm's rules change. Depositary receipts exist on SET for some foreign names. This desk does not invent a DR ticker.
      </p>
      <p>
        Expense ratios are copied from factsheets and issuer pages dated in 2026 where we checked them, and left blank where we did not want to guess. Fund NAVs that Yahoo does not list use a round reference price so the unit count is arithmetic, and the chart follows the master fund. Read the factsheet before you subscribe.
      </p>
      <p>
        ThaiESG, RMF, and SSF are described from the rules in force for purchases around late 2026, including the end of the SSF deduction and the ThaiESG window that closes on 31 December 2026. Tax law moves. The desk sizes a ThaiESG line to the published annual cap and refuses to invent an RMF lot without knowing your income.
      </p>
      <h2 className="font-heading text-2xl">Alerts</h2>
      <p>
        A five-session move past your band suggests holding, unless the line is a single-name satellite that is also falling with clearly negative headlines. Then the suggestion is to swap it into the sleeve's core fund, which keeps the asset-class weight and drops the single name. Drift past your band suggests a rebalance, with a baht amount and the other side of the trade. A tone shift on its own suggests holding. Tone is a word list, or an optional model if OPENAI_API_KEY is set. It is not a price target.
      </p>
      <p>
        In-app delivery is real. Email and LINE are adapter stubs that record "skipped" until a transport is wired. The message shape is the same for all three.
      </p>
    </article>
  );
}
