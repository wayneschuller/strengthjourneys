/**
 * Long-form guide rendered below the tool on the /calculator hub only.
 *
 * GSC review 2026-09-29: the hub slid from the edge of page one (~9-13) to
 * ~20 for "1rm calculator", "max rep calculator" and friends, while the
 * formula and lift pages, which already carry examples and citations, held.
 * The competitors above us pair the tool with a real guide, so this gives the
 * hub the depth the sub-pages already have. The tool stays first on the page.
 *
 * Every estimate in the comparison table is computed with estimateE1RM at
 * render time, so the prose can never disagree with the calculator above it.
 */
import Link from "next/link";

import { estimateE1RM } from "@/lib/estimate-e1rm";

// Equations as written on each formula's own page (src/pages/calculator/[slug].js).
const FORMULA_ROWS = [
  {
    name: "Brzycki",
    formula: "Brzycki",
    equation: "w ÷ (1.0278 − 0.0278r)",
    href: "/calculator/brzycki-formula-1rm-calculator",
  },
  {
    name: "Epley",
    formula: "Epley",
    equation: "w × (1 + r/30)",
    href: "/calculator/epley-formula-1rm-calculator",
  },
  {
    name: "McGlothin",
    formula: "McGlothin",
    equation: "100w ÷ (101.3 − 2.671r)",
    href: "/calculator/mcglothin-formula-1rm-calculator",
  },
  {
    name: "Lombardi",
    formula: "Lombardi",
    equation: "w × r^0.1",
    href: "/calculator/lombardi-formula-1rm-calculator",
  },
  {
    name: "Mayhew",
    formula: "Mayhew",
    equation: "100w ÷ (52.2 + 41.9 × e^(−0.055r))",
    href: "/calculator/mayhew-1rm-formula-calculator",
  },
  {
    name: "O'Conner",
    formula: "OConner",
    equation: "w × (1 + r/40)",
    href: "/calculator/oconner-formula-1rm-calculator",
  },
  {
    name: "Wathan",
    formula: "Wathan",
    equation: "100w ÷ (48.8 + 53.8 × e^(−0.075r))",
    href: "/calculator/wathan-1rm-formula-calculator",
  },
];

// Three sets a lifter might really do, chosen to show the formulas agreeing
// at low reps and scattering as reps climb.
const EXAMPLE_SETS = [
  { weight: 225, reps: 5 },
  { weight: 185, reps: 10 },
  { weight: 135, reps: 15 },
];

const LINK_CLASS =
  "text-blue-600 underline visited:text-purple-600 hover:text-blue-800";

/**
 * The hub guide: a worked example, all seven formulas side by side, how to use
 * the estimate in training, and when to test a true max instead.
 */
export function CalculatorHubGuide() {
  const spreads = EXAMPLE_SETS.map(({ weight, reps }) => {
    const estimates = FORMULA_ROWS.map(({ formula }) =>
      estimateE1RM(reps, weight, formula),
    );
    const low = Math.min(...estimates);
    const high = Math.max(...estimates);
    return { weight, reps, low, high, pct: Math.round(((high - low) / low) * 100) };
  });
  const [fiveRep, tenRep, fifteenRep] = spreads;
  const brzyckiFive = estimateE1RM(5, 225, "Brzycki");

  return (
    <article className="mt-10 space-y-10">
      <section>
        <h2 className="mb-3 text-xl font-semibold">
          How the One Rep Max Calculator Works
        </h2>
        <div className="space-y-3 text-sm text-muted-foreground md:text-base">
          <p>
            Give the calculator one hard set, the weight and how many reps you
            got, and it estimates the heaviest single you could lift today.
            That estimate is your E1RM, or estimated one rep max. It lets you
            track your strength every week without grinding out a true max
            every week.
          </p>
          <p>
            Say you squat 225 lb for 5 reps. The Brzycki formula, the default
            here, divides the weight by 1.0278 − 0.0278 × reps: 225 ÷ (1.0278 −
            0.139) = {brzyckiFive} lb. So a solid set of five at 225 says you
            are good for about {brzyckiFive} lb on a single, today. Put in your
            own set above and the calculator runs the same sum through all
            seven formulas at once.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">
          The 7 One Rep Max Formulas Compared
        </h2>
        <p className="mb-4 text-sm text-muted-foreground md:text-base">
          Every formula is someone&apos;s best fit to how reps fall away as
          the bar gets heavier. Here is each one run on the same three sets,
          where w is the weight and r is the reps.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Estimated one rep max from seven formulas for three example sets
            </caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
                <th className="px-3 py-2">Formula</th>
                <th className="hidden px-3 py-2 sm:table-cell">Equation</th>
                {EXAMPLE_SETS.map(({ weight, reps }) => (
                  <th key={reps} className="px-3 py-2 text-right">
                    {weight} lb × {reps}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FORMULA_ROWS.map(({ name, formula, equation, href }) => (
                <tr key={name} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">
                    <Link prefetch={false} href={href} className={LINK_CLASS}>
                      {name}
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-xs text-muted-foreground sm:table-cell">
                    {equation}
                  </td>
                  {EXAMPLE_SETS.map(({ weight, reps }) => (
                    <td
                      key={reps}
                      className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                    >
                      {estimateE1RM(reps, weight, formula)} lb
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground md:text-base">
          <p>
            At 5 reps the seven formulas land within {fiveRep.pct}% of each
            other ({fiveRep.low}–{fiveRep.high} lb). At 10 reps the gap is{" "}
            {tenRep.pct}% ({tenRep.low}–{tenRep.high} lb). At 15 reps it opens
            to {fifteenRep.pct}% ({fifteenRep.low}–{fifteenRep.high} lb), and
            the formulas stop agreeing on what your set means. That is the
            real lesson of the table: the formula matters far less than the
            rep count you feed it.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">
          Which Formula Should You Use?
        </h2>
        <div className="space-y-3 text-sm text-muted-foreground md:text-base">
          <p>
            Pick one and stick with it. For tracking progress, a formula you
            use every time beats a slightly more accurate one you swap between,
            because the trend is what tells you whether you are getting
            stronger. Brzycki is the default here because it behaves well in
            the 1–6 rep range where most strength work lives.{" "}
            <Link
              prefetch={false}
              href="/calculator/epley-formula-1rm-calculator"
              className={LINK_CLASS}
            >
              Epley
            </Link>{" "}
            is one of the most widely used and runs a little higher at 5 reps.
          </p>
          <p>
            If you want the full story on where each equation came from, read{" "}
            <Link
              prefetch={false}
              href="/articles/how-do-i-calculate-my-e1rm-estimated-one-rep-max"
              className={LINK_CLASS}
            >
              how to calculate your E1RM
            </Link>
            .
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">
          Using Your Estimate in Training
        </h2>
        <div className="space-y-3 text-sm text-muted-foreground md:text-base">
          <p>
            Most programs are written in percentages of your max, which is what
            the percentage table above is for. A 5-rep max usually sits around
            85–90% of a one rep max ({Math.round((225 / brzyckiFive) * 100)}%
            in the example above), so working sets of 5 that leave a rep or two
            in the tank tend to live at 75–85%. Volume work sits lower, around
            65–75%.
          </p>
          <p>
            The rep max table works the other way. If your program says
            &quot;a heavy triple&quot;, read off the 3RM row and start a little
            under it. Before any of that, the{" "}
            <Link
              prefetch={false}
              href="/warm-up-sets-calculator"
              className={LINK_CLASS}
            >
              warm-up sets calculator
            </Link>{" "}
            builds your ramp from the estimate so you are not guessing plates
            between sets.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">
          When to Trust the Estimate, and When to Test a True Max
        </h2>
        <div className="space-y-3 text-sm text-muted-foreground md:text-base">
          <p>
            Estimates are most reliable from a hard set of about 3–10 reps. A{" "}
            <a
              href="/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf"
              className={LINK_CLASS}
            >
              2006 Journal of Strength and Conditioning Research study
            </a>{" "}
            found that 5-rep sets gave the most accurate predictions. Above 10
            reps, your muscular endurance starts to count as much as your
            strength, which is why the table above scatters at 15.
          </p>
          <p>
            The formulas also describe an average lifter. If you have always
            been good at high-rep sets, they will flatter you; if you are a
            natural at heavy singles, they will sell you short. Watch how your
            estimates line up with the singles you actually hit, and trust the
            number accordingly.
          </p>
          <p>
            Test a true max when it earns its place: before a meet, at the end
            of a training block, or when you want a real number to set your
            percentages from. The rest of the time the estimate is the safer
            tool.{" "}
            <Link
              prefetch={false}
              href="/articles/how-often-should-i-test-my-one-rep-max"
              className={LINK_CLASS}
            >
              How often should you test your one rep max?
            </Link>
          </p>
        </div>
      </section>
    </article>
  );
}
