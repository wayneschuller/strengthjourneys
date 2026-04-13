import Head from "next/head";
import { NextSeo } from "next-seo";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { E1RMCalculatorMain } from "@/pages/calculator/index";

// ── PAGE CONFIG ──────────────────────────────────────────────────────────────
// Slugs chosen to match top-impression queries from Search Console.

const PAGE_CONFIG = {
  // ── FORMULA PAGES ──────────────────────────────────────────────────────────
  // GSC review 2026-03-07: titles/descriptions in this block were tuned for
  // CTR on already-high-ranking formula pages. Keep exact-match phrasing
  // intentional unless fresher query data suggests otherwise.
  // GSC review 2026-03-25: formula-page metadata below leans harder into
  // curiosity, rivalry, and comparison-driven SERP clicks.
  "epley-formula-1rm-calculator": {
    type: "formula",
    formulaName: "Epley",
    equation: "w × (1 + r/30)",
    blurb:
      "The formula most lifters know first - and the one many start doubting once reps climb into optimistic territory.",
    pageIntro:
      "Run your set through Epley, compare all 7 formulas side by side, and see whether the internet's favorite estimate is actually flattering your max.",
    // GSC baseline 2026-03-24 (last 3 months): 22 clicks / 29,859 imp /
    // 0.07% CTR / pos 3.59.
    // GSC snapshot 2026-03-25 (last 7 days): 8 clicks / 9,717 imp / 0.08% CTR
    // / pos 2.97.
    // Previous title: "Epley Formula 1RM Calculator | Epley 1RM Calculation"
    // Previous meta: "Calculate your one rep max with the Epley formula: 1RM =
    // weight x (1 + reps/30). Enter your set, compare Epley vs 6 other 1RM
    // equations, and get rep max tables."
    // GSC review 2026-03-25: test challenge-based SERP copy to improve CTR.
    title: "Epley Formula 1RM Calculator | Does Epley Overestimate?",
    description:
      "Epley can overestimate above 10 reps. Enter your set, compare all 7 formulas, and see which one is actually honest about your max.",
    keywords:
      "epley formula 1rm, epley formula 1rm calculation, epley formula one rep max, epley 1rm calculator",
    formulaSupport: {
      heading: "Use the Epley Formula 1RM Calculator",
      summary: [
        "This page is tuned for lifters who want a fast Epley formula 1RM calculation from a normal working set, then compare that result against the other major equations. Reynolds, Gordon, and Robergs found that ",
        {
          text: '"5RM data produced the greatest prediction accuracy"',
          href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
        },
        ", which lines up with how most lifters use Epley in practice.",
      ],
      bestFor:
        "moderate rep sets when you want a widely cited estimate that most lifters already recognize",
      repRange:
        "usually strongest from about 3-10 reps before fatigue distorts the estimate",
      links: [
        {
          href: "/calculator",
          label: "Compare All 7 Formulas",
          description:
            "Run the same set through every 1RM equation side by side.",
        },
        {
          href: "/calculator/brzycki-formula-1rm-calculator",
          label: "Compare Against Brzycki",
          description: "Useful if you want a stricter lower-rep comparison.",
        },
        {
          href: "/calculator/mayhew-1rm-formula-calculator",
          label: "Compare Against Mayhew",
          description: "See how a less linear formula behaves on higher reps.",
        },
      ],
    },
    exampleSnippet: {
      heading: "Example Epley 1RM Calculation",
      input: "Input set: 225 lb x 5 reps",
      calculation: "Formula: 225 x (1 + 5/30) = 262.5",
      result: "Estimated 1RM: 263 lb",
      takeaway:
        "This is why Epley is a common default for moderate-rep working sets: the math is simple and the estimate lands close to what most lifters expect.",
    },
    faqItems: [
      {
        question: "How does the Epley formula calculate a one rep max?",
        answer: [
          "The Epley formula is 1RM = weight × (1 + reps/30). For example, if you lift 225 lb for 5 reps: 225 × (1 + 5/30) = 262.5, giving an estimated 1RM of about 263 lb. Developed by Boyd Epley in 1985, it's one of the most widely cited 1RM equations. A ",
          {
            text: "2006 Journal of Strength and Conditioning Research study",
            href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
          },
          " found that 5RM data produced the greatest prediction accuracy, which aligns with how most lifters use the Epley formula in practice.",
        ],
      },
      {
        question: "Is the Epley formula accurate for high reps?",
        answer: [
          "Epley is most reliable in the 3–10 rep range. Above 10 reps, fatigue and technique breakdown introduce more noise into the estimate. That same ",
          {
            text: "2006 prediction accuracy study",
            href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
          },
          " recommended using no more than 10 repetitions for linear 1RM predictions. For higher-rep sets, consider comparing Epley against the Mayhew formula, which uses an exponential curve designed for those ranges.",
        ],
      },
      {
        question: "Epley vs Brzycki: which one usually comes out higher?",
        answer:
          "Epley usually gives the higher estimate, especially as reps climb. Brzycki tends to stay stricter, which is why many lifters compare both before deciding whether their projected max looks realistic or inflated.",
      },
    ],
  },
  "brzycki-formula-1rm-calculator": {
    type: "formula",
    formulaName: "Brzycki",
    equation: "w ÷ (1.0278 − 0.0278r)",
    blurb:
      "The stricter rival to Epley - popular with lifters who would rather undercall a max than get seduced by a generous estimate.",
    pageIntro:
      "If Epley feels a little too kind, Brzycki is the reality check. Run your set, compare every major formula, and see where your max actually lands.",
    // GSC baseline 2026-03-24 (last 3 months): 38 clicks / 15,411 imp /
    // 0.25% CTR / pos 3.28.
    // GSC snapshot 2026-03-25 (last 7 days): 12 clicks / 4,815 imp / 0.25% CTR
    // / pos 3.07.
    // Previous title: "Brzycki Formula 1RM Calculator | Brzycki 1RM Calculation"
    // Previous meta: "Calculate your one rep max with the Brzycki formula: 1RM
    // = weight / (1.0278 - 0.0278 x reps). Compare Brzycki vs 6 other 1RM
    // equations, rep max tables, and percentage loads."
    // GSC review 2026-03-25: test rivalry framing and stricter validation.
    title: "Brzycki Formula 1RM Calculator | Stricter Than Epley?",
    description:
      "Brzycki gives a stricter max than Epley - closer to reality? Calculate your 1RM, compare 7 formulas, and see your strength percentile instantly.",
    keywords:
      "brzycki formula 1rm, brzycki formula 1rm calculation, brzycki formula 1rm calculator, brzycki one rep max",
    formulaSupport: {
      heading: "Use the Brzycki Formula 1RM Calculator",
      summary: [
        "This page is built for Brzycki formula queries where the lifter wants the exact equation, a cleaner lower-rep estimate, and a direct comparison with the rest of the calculator stack. That lower-rep bias also fits a 2006 ",
        {
          text: "strength-prediction paper",
          href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
        },
        " showing that prediction quality held up best when rep counts stayed lower rather than drifting toward 20-rep fatigue sets.",
      ],
      bestFor:
        "heavier sets in the lower rep ranges when you want a more conservative one rep max estimate",
      repRange: [
        "usually strongest from about 1-10 reps, especially on the lower end; that same paper concluded ",
        {
          text: '"no more than 10 repetitions should be used"',
          href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
        },
        " for linear 1RM estimates in the movements they tested",
      ],
      links: [
        {
          href: "/calculator",
          label: "Compare All 7 Formulas",
          description:
            "See where Brzycki sits relative to the full range of estimates.",
        },
        {
          href: "/calculator/epley-formula-1rm-calculator",
          label: "Compare Against Epley",
          description:
            "Useful if you want the most common side-by-side comparison.",
        },
        {
          href: "/calculator/mayhew-1rm-formula-calculator",
          label: "Compare Against Mayhew",
          description: "Check how Brzycki differs when reps start climbing.",
        },
      ],
    },
    exampleSnippet: {
      heading: "Example Brzycki 1RM Calculation",
      input: "Input set: 225 lb x 5 reps",
      calculation: "Formula: 225 / (1.0278 - 0.0278 x 5) = 252.8",
      result: "Estimated 1RM: 253 lb",
      takeaway:
        "Brzycki usually reads a little stricter than Epley, which is part of why lifters often prefer it for heavier, lower-rep sets.",
    },
    faqItems: [
      {
        question: "Why is Brzycki usually favored for lower-rep sets?",
        answer: [
          "Brzycki is popular when the set is already fairly heavy and reps stay low. That matches the practical takeaway from this ",
          {
            text: "2006 1RM prediction paper",
            href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
          },
          ": prediction quality held up better with lower-rep testing, while very high-rep sets introduced more fatigue-related noise.",
        ],
      },
      {
        question: "Why does Brzycki usually read lower than Epley?",
        answer:
          "Brzycki is simply less generous as reps climb, so its projected max often lands below Epley on the same set. That makes it a popular second opinion for lifters who want a stricter number before planning attempts or training percentages.",
      },
    ],
  },
  "mayhew-1rm-formula-calculator": {
    type: "formula",
    formulaName: "Mayhew",
    equation: "100w ÷ (52.2 + 41.9 × e^(−0.055r))",
    blurb:
      "The formula to check when your higher-rep set feels stronger than Epley or Brzycki are willing to admit.",
    pageIntro:
      "Mayhew often runs hotter once reps rise. Compare it against stricter formulas and decide whether the bigger number feels generous or finally honest.",
    // GSC baseline 2026-03-24 (last 3 months): 6 clicks / 387 imp / 1.55% CTR
    // / pos 4.82.
    // GSC snapshot 2026-03-25 (last 7 days): 1 click / 122 imp / 0.82% CTR /
    // pos 5.53.
    // Previous title: "Mayhew 1RM Formula Calculator | One Rep Max Tool"
    // Previous meta: "Estimate your one rep max with the Mayhew formula: 1RM =
    // 100w / (52.2 + 41.9 x e^(-0.055r)). Compare results against Epley,
    // Brzycki, and 4 more 1RM equations."
    // GSC review 2026-03-25: test higher-rep curiosity and comparison framing.
    title: "Mayhew Formula 1RM Calculator | Higher-Rep 1RM?",
    description:
      "Mayhew runs higher than Brzycki or Epley - generous or more accurate for higher reps? Calculate your 1RM and compare all 7 formulas to find out.",
    keywords:
      "mayhew 1rm formula, mayhew formula calculator, mayhew one rep max",
    formulaSupport: {
      heading: "Use the Mayhew Formula 1RM Calculator",
      summary:
        "Mayhew is the formula people reach for when a 6-10 rep set feels stronger than a strict linear equation admits. Run it beside Epley and Brzycki to see whether the higher number looks inflated or finally believable.",
      bestFor:
        "higher-rep work where you want to pressure-test whether linear formulas are underselling your set",
      repRange:
        "especially interesting from about 6-12 reps, where curved formulas start pulling away from the stricter linear ones",
      links: [
        {
          href: "/calculator",
          label: "Compare All 7 Formulas",
          description: "See how Mayhew moves versus every other 1RM method.",
        },
        {
          href: "/calculator/epley-formula-1rm-calculator",
          label: "Compare Against Epley",
          description:
            "Useful when you want a simpler linear benchmark beside Mayhew.",
        },
        {
          href: "/calculator/brzycki-formula-1rm-calculator",
          label: "Compare Against Brzycki",
          description:
            "Helpful if you want to contrast higher-rep and lower-rep bias.",
        },
      ],
    },
    exampleSnippet: {
      heading: "Example Mayhew 1RM Calculation",
      input: "Input set: 225 lb x 8 reps",
      calculation:
        "Formula: 100 x 225 / (52.2 + 41.9 x e^(-0.055 x 8)) = 284.1",
      result: "Estimated 1RM: 284 lb",
      takeaway:
        "Mayhew rises faster once reps climb, so it is useful when you want to compare a higher-rep estimate against simpler linear formulas.",
    },
    faqItems: [
      {
        question:
          "Why does Mayhew usually come out higher than Epley or Brzycki?",
        answer:
          "Mayhew uses an exponential curve, so it tends to climb faster once reps increase. That can make it feel more generous, but it is also why lifters like to check it when a solid higher-rep set seems undervalued by stricter formulas.",
      },
      {
        question: "Is Mayhew better for higher reps?",
        answer:
          "Mayhew is often more interesting once you move past the classic low-rep strength range. It is not automatically more accurate, but it gives you a useful counterpoint when Epley or Brzycki start looking too conservative for a strong 6-10 rep effort.",
      },
    ],
  },
  "wathan-1rm-formula-calculator": {
    type: "formula",
    formulaName: "Wathan",
    equation: "100w ÷ (48.8 + 53.8 × e^(−0.075r))",
    blurb:
      "A sleeper exponential formula that gets interesting when the familiar linear estimates stop agreeing with your higher-rep set.",
    pageIntro:
      "Wathan tracks close to Brzycki at low reps, then starts drifting higher as reps climb. Run your set through all 7 formulas and see exactly where Wathan breaks away.",
    // GSC baseline 2026-03-24 (last 3 months): not present in page export;
    // likely very low impressions/clicks.
    // GSC snapshot 2026-03-25 (last 7 days): not present in page export;
    // likely very low impressions/clicks.
    // Previous title: "Wathan Formula 1RM Calculator | Wathan 1RM Formula"
    // Previous meta: "Estimate your one rep max with the Wathan formula: 1RM =
    // 100w / (48.8 + 53.8 x e^(-0.075r)). Compare all 7 proven equations with
    // rep max tables and percentage loads."
    // GSC review 2026-03-25: test Brzycki anchor plus rep-drift curiosity.
    title: "Wathan Formula 1RM Calculator | The Sleeper Formula?",
    description:
      "Wathan tracks close to Brzycki at low reps but drifts higher as reps climb. Enter your set and compare all 7 formulas to see where Wathan lands.",
    keywords:
      "wathan 1rm formula, wathan formula calculator, wathan one rep max",
    formulaSupport: {
      heading: "Use the Wathan Formula 1RM Calculator",
      summary:
        "Wathan is a good formula to check when you want something less obvious than Epley vs Brzycki. Its curved model can expose how much your estimate depends on the formula once reps start creeping upward.",
      bestFor:
        "lifters who want a second high-rep comparison instead of relying on the usual linear favorites",
      repRange:
        "most interesting once you move beyond very low reps and want to see whether a curved estimate changes the story",
      links: [
        {
          href: "/calculator",
          label: "Compare All 7 Formulas",
          description:
            "See whether Wathan lands near Mayhew or pulls back toward Epley.",
        },
        {
          href: "/calculator/mayhew-1rm-formula-calculator",
          label: "Compare Against Mayhew",
          description:
            "Useful when you want to compare two higher-rep-friendly curves.",
        },
        {
          href: "/calculator/epley-formula-1rm-calculator",
          label: "Compare Against Epley",
          description:
            "Check how a curved estimate differs from the most common linear default.",
        },
      ],
    },
    exampleSnippet: {
      heading: "Example Wathan 1RM Calculation",
      input: "Input set: 225 lb x 8 reps",
      calculation:
        "Formula: 100 x 225 / (48.8 + 53.8 x e^(-0.075 x 8)) = 281.7",
      result: "Estimated 1RM: 282 lb",
      takeaway:
        "Wathan is another curved formula, so it is useful when you want a research-backed estimate that does not stay perfectly linear as reps increase.",
    },
    faqItems: [
      {
        question: "Why do some lifters compare Wathan against Mayhew?",
        answer:
          "Both formulas use a curve rather than a simple linear progression, so they become especially interesting once reps climb. Comparing Wathan and Mayhew helps you see whether the higher-rep estimate is consistently rising or only one formula is pushing it upward.",
      },
      {
        question: "Is Wathan better than Epley for higher reps?",
        answer:
          "Not automatically, but Wathan gives you a different lens on higher-rep sets. If Epley feels too simplistic once fatigue becomes a factor, Wathan is worth checking as a second opinion rather than treating any one equation as final truth.",
      },
    ],
  },
  "mcglothin-formula-1rm-calculator": {
    type: "formula",
    formulaName: "McGlothin",
    equation: "100w ÷ (101.3 − 2.671r)",
    blurb:
      "The overlooked middle-ground formula - useful when Epley feels bold, Brzycki feels strict, and you want a tie-breaker.",
    pageIntro:
      "McGlothin rarely gets the spotlight, but it often lands right between the aggressive and conservative estimates. Run your numbers and see whether the quiet formula gives the most believable answer.",
    // GSC baseline 2026-03-24 (last 3 months): 2 clicks / 90 imp / 2.22% CTR /
    // pos 8.59.
    // GSC snapshot 2026-03-25 (last 7 days): 1 click / 22 imp / 4.55% CTR /
    // pos 7.55.
    // Previous title: "McGlothin Formula 1RM Calculator | McGlothin 1RM Formula"
    // Previous meta: "Estimate your one rep max with the McGlothin formula:
    // 1RM = 100w / (101.3 - 2.671r). Compare all 7 proven 1RM equations with
    // rep max tables and percentages."
    // GSC review 2026-03-25: test curiosity-gap framing as impressions grow.
    title: "McGlothin Formula 1RM Calculator | Overlooked Formula",
    description:
      "McGlothin sits between conservative and aggressive 1RM estimates. Calculate yours, compare all 7 formulas, and check your strength level instantly.",
    keywords:
      "mcglothin formula 1rm, mcglothin one rep max calculator, 1rm formula calculator",
    formulaSupport: {
      heading: "Use the McGlothin Formula 1RM Calculator",
      summary:
        "McGlothin is easy to miss because it rarely wins the popularity contest, but that is exactly why it is useful. When Epley feels high and Brzycki feels low, McGlothin often becomes the tie-breaker worth checking.",
      bestFor:
        "lifters who want a calmer middle-ground estimate instead of the most aggressive or most conservative answer",
      repRange:
        "solid in the middle rep ranges where you want a steady linear estimate without the biggest swings",
      links: [
        {
          href: "/calculator",
          label: "Compare All 7 Formulas",
          description:
            "See whether McGlothin really lands in the middle on your set.",
        },
        {
          href: "/calculator/epley-formula-1rm-calculator",
          label: "Compare Against Epley",
          description:
            "Useful if Epley feels a little too generous for your taste.",
        },
        {
          href: "/calculator/brzycki-formula-1rm-calculator",
          label: "Compare Against Brzycki",
          description:
            "Check whether McGlothin splits the difference on the same lift.",
        },
      ],
    },
    exampleSnippet: {
      heading: "Example McGlothin 1RM Calculation",
      input: "Input set: 225 lb x 5 reps",
      calculation: "Formula: 100 x 225 / (101.3 - 2.671 x 5) = 255.9",
      result: "Estimated 1RM: 256 lb",
      takeaway:
        "McGlothin stays fairly steady across a broad middle rep range, which makes it useful when you want a calmer linear comparison.",
    },
    faqItems: [
      {
        question: "Why is the McGlothin formula overlooked?",
        answer:
          "Mostly because Epley and Brzycki dominate the conversation. McGlothin is less famous, not useless. In practice, it can be helpful precisely because it often lands between the aggressive and conservative estimates on the same set.",
      },
      {
        question:
          "When should you check McGlothin instead of Epley or Brzycki?",
        answer:
          "Check McGlothin when the usual formulas disagree enough to make your projected max feel uncertain. It is a good tie-breaker when you want a steady linear estimate before choosing training percentages or an attempt goal.",
      },
    ],
  },
  "lombardi-formula-1rm-calculator": {
    type: "formula",
    formulaName: "Lombardi",
    equation: "w × r^0.1",
    blurb:
      "A power formula that tracks close to Epley early, then starts doing something more surprising as reps rise.",
    pageIntro:
      "Lombardi uses a power curve, not a linear formula, so the gap between it and Brzycki grows with every rep. Run your set and see when the split starts getting interesting.",
    // GSC baseline 2026-03-24 (last 3 months): 2 clicks / 787 imp / 0.25% CTR
    // / pos 4.85.
    // GSC snapshot 2026-03-25 (last 7 days): 0 clicks / 258 imp / 0% CTR /
    // pos 4.74.
    // Previous title: "Lombardi Formula 1RM Calculator | Lombardi 1RM Formula"
    // Previous meta: "Estimate your one rep max with the Lombardi formula: 1RM
    // = weight x reps^0.1. Compare all 7 proven 1RM equations with rep max
    // tables and percentages."
    // GSC review 2026-03-25: test divergence framing against Brzycki.
    title: "Lombardi Formula 1RM Calculator | Diverges at High Reps",
    description:
      "Lombardi uses a power curve instead of a linear formula - the gap between it and Brzycki grows with every rep. Compare all 7 estimates for your set.",
    keywords:
      "lombardi formula 1rm, lombardi one rep max calculator, 1rm formula calculator",
    formulaSupport: {
      heading: "Use the Lombardi Formula 1RM Calculator",
      summary:
        "Lombardi is useful because it does not stay boring for long. It often sits near Epley on low reps, then starts separating as the rep count rises, which makes it a great formula for spotting where your estimate becomes formula-sensitive.",
      bestFor:
        "lifters who want to see when a familiar estimate starts drifting into something unexpected",
      repRange:
        "helpful across the board, but most revealing once reps get high enough for the power curve to pull away",
      links: [
        {
          href: "/calculator",
          label: "Compare All 7 Formulas",
          description:
            "See exactly where Lombardi starts separating from the pack.",
        },
        {
          href: "/calculator/epley-formula-1rm-calculator",
          label: "Compare Against Epley",
          description: "Useful if you want to spot when the two stop agreeing.",
        },
        {
          href: "/calculator/mayhew-1rm-formula-calculator",
          label: "Compare Against Mayhew",
          description:
            "Check whether two higher-rep-sensitive formulas tell the same story.",
        },
      ],
    },
    exampleSnippet: {
      heading: "Example Lombardi 1RM Calculation",
      input: "Input set: 225 lb x 5 reps",
      calculation: "Formula: 225 x 5^0.1 = 264.2",
      result: "Estimated 1RM: 264 lb",
      takeaway:
        "Lombardi is quick to compute and often lands near Epley, so it works well as a fast cross-check rather than a sole answer.",
    },
    faqItems: [
      {
        question: "Why does Lombardi diverge at high reps?",
        answer:
          "Lombardi uses a power relationship instead of a simple linear step-up per rep, so the estimate changes shape as reps increase. That is why it can look familiar at low reps and noticeably different once the set gets longer.",
      },
      {
        question: "Is Lombardi accurate for low reps?",
        answer:
          "Lombardi often lands reasonably close to the more familiar formulas on low reps, which makes it a useful cross-check. Its real value is seeing how far it drifts once you move away from heavy triples, fours, and fives.",
      },
    ],
  },
  "oconner-formula-1rm-calculator": {
    type: "formula",
    formulaName: "OConner",
    equation: "w × (1 + r/40)",
    blurb:
      "A calmer, more conservative estimate for lifters who want a quick reality check before loading the bar.",
    pageIntro:
      "If Epley feels optimistic, O'Conner is the fast sanity check. Enter your set, compare all 7 formulas, and roll straight into warm-up percentages.",
    // GSC baseline 2026-03-24 (last 3 months): 4 clicks / 539 imp / 0.74% CTR
    // / pos 6.56.
    // GSC snapshot 2026-03-25 (last 7 days): 1 click / 327 imp / 0.31% CTR /
    // pos 7.00.
    // Previous title: "O'Conner Formula 1RM Calculator | OConner 1RM Formula"
    // Previous meta: "Estimate your one rep max with the O'Conner formula: 1RM
    // = weight x (1 + reps/40). Compare all 7 proven 1RM equations with rep
    // max tables and percentages."
    // GSC review 2026-03-25: test conservative-check framing plus warm-up tie-in.
    title: "O'Conner Formula 1RM Calculator | Conservative 1RM Check",
    description:
      "O'Conner's formula gives a conservative estimate similar to Brzycki. Enter your set, see where it lands across 7 formulas, and get your warm-up sets.",
    keywords:
      "oconner formula 1rm, o'conner one rep max calculator, 1rm formula calculator",
    formulaSupport: {
      heading: "Use the O'Conner Formula 1RM Calculator",
      summary:
        "O'Conner is a good formula to check when you want a projected max that does not get carried away. It gives you a quick conservative read, then lets you compare that answer against the more aggressive formulas before planning attempts or warm-ups.",
      bestFor:
        "lifters who want a simple, cautious estimate before using the number in training",
      repRange:
        "most useful when you want a conservative read from a normal working set without leaning too hard on higher-rep optimism",
      links: [
        {
          href: "/calculator",
          label: "Compare All 7 Formulas",
          description:
            "See where O'Conner sits relative to the full range of estimates.",
        },
        {
          href: "/calculator/brzycki-formula-1rm-calculator",
          label: "Compare Against Brzycki",
          description:
            "Useful if you want to compare two stricter formulas side by side.",
        },
        {
          href: "/warm-up-sets-calculator",
          label: "Build Warm-Up Sets",
          description:
            "Take the estimate straight into warm-up percentages for the day.",
        },
      ],
    },
    exampleSnippet: {
      heading: "Example O'Conner 1RM Calculation",
      input: "Input set: 225 lb x 5 reps",
      calculation: "Formula: 225 x (1 + 5/40) = 253.1",
      result: "Estimated 1RM: 253 lb",
      takeaway:
        "O'Conner tends to estimate slightly lower than Epley, so it is a useful conservative check when you want to avoid inflated higher-rep projections.",
    },
    faqItems: [
      {
        question: "Is O'Conner basically a more conservative Epley?",
        answer:
          "In practice, that is how many lifters use it. O'Conner usually comes out lower on the same set, so it works as a quick check when you want to avoid letting a generous estimate drive your training max too high.",
      },
      {
        question: "When is O'Conner useful for programming warm-up sets?",
        answer:
          "O'Conner is handy when you want a cautious projected max to base your percentages on. If you would rather start a little lighter and adjust up than overshoot from the first warm-up jump, the conservative estimate can be helpful.",
      },
    ],
  },

  // ── LIFT PAGES ─────────────────────────────────────────────────────────────
  "squat-1rm-calculator": {
    type: "lift",
    liftName: "Squat",
    blurb: [
      "Enter your squat working weight and reps. The back squat 1RM is a primary strength metric in powerlifting, tested at legal depth. A ",
      {
        text: "2006 prediction accuracy study",
        href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
      },
      " found that 5RM data produced the greatest prediction accuracy, so a hard set of 3-8 reps gives the most reliable estimate.",
    ],
    pageIntro:
      "Run your squat through all 7 major 1RM formulas, compare the estimates side by side, and see your strength level rating by age, sex, and bodyweight. A clean set of 3-8 reps gives the most useful signal.",
    title: "Squat 1RM Calculator | Max Squat Calculator — Free Tool",
    description:
      "Calculate your max squat using 7 proven 1RM formulas (Epley, Brzycki & more). Get squat rep-max tables, percentage training guides, and strength level ratings by age, sex, and bodyweight. Free, no login.",
    keywords:
      "squat 1rm calculator, max squat calculator, one rep max squat, squat max calculator, how to calculate squat max",
    exampleSnippet: {
      heading: "Example Squat 1RM Estimate",
      input: "Input set: 225 lb x 5 reps",
      calculation: "Using Brzycki: 225 / (1.0278 - 0.0278 x 5) = 252.8",
      result: "Estimated squat 1RM: 253 lb",
      takeaway:
        "A hard set of 5 is a practical input for most squat estimates because it is heavy enough to be meaningful without the risk of true max testing.",
    },
    faqItems: [
      {
        question: "What rep range gives the most accurate squat 1RM estimate?",
        answer: [
          "For most lifters, a hard set of 3-8 reps gives the best estimate. A ",
          {
            text: "2006 Journal of Strength and Conditioning Research study",
            href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
          },
          " found that 5RM data produced the greatest prediction accuracy. Above 10 reps, fatigue and form breakdown introduce more noise into the projection.",
        ],
      },
      {
        question: "How accurate are squat 1RM calculators?",
        answer:
          "Squat 1RM calculators are typically within 5-10% of a true max when the input set is in the 3-8 rep range with good form. Accuracy drops as reps increase, which is why comparing multiple formulas side by side helps you find a realistic range rather than relying on a single number.",
      },
      {
        question: "What is a good squat 1RM for my bodyweight?",
        answer:
          "Squat strength varies widely by bodyweight, age, sex, and training experience. As a rough guide, an intermediate male lifter might squat around 1.25-1.5x bodyweight. Use our strength level ratings on this page or check the full squat strength standards for a more precise comparison.",
      },
    ],
    liftLinks: [
      {
        href: "/strength-levels/squat",
        label: "Squat Strength Standards",
        description:
          "See where your squat ranks by bodyweight, age, and sex.",
      },
      {
        href: "/progress-guide/squat",
        label: "Squat Guide & PR Tracker",
        description:
          "Technique videos, E1RM history, rep PRs, and tonnage tracking.",
      },
      {
        href: "/warm-up-sets-calculator",
        label: "Build Warm-Up Sets",
        description:
          "Generate warm-up percentages from your estimated max.",
      },
    ],
  },
  "bench-press-1rm-calculator": {
    type: "lift",
    liftName: "Bench Press",
    pageIntro:
      "Run your bench press through all 7 major 1RM formulas, compare estimates side by side, and see your strength level rating by age, sex, and bodyweight. A hard set of 3-10 reps with consistent form gives the most reliable result.",
    blurb: [
      "Enter your bench press working weight and reps. Using a set of 3-10 reps gives the most accurate 1RM estimate. A 2006 ",
      {
        text: "bench and leg press prediction study",
        href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
      },
      " found 5RM data gave the strongest 1RM prediction accuracy, so a hard set of 5 is often the cleanest input. Results account for 7 proven formulas so you can see the full range.",
    ],
    title: "Bench Press 1RM Calculator | Max Bench Calculator — Free Tool",
    description:
      "Calculate your bench press one rep max using 7 proven formulas. Get rep-max tables, percentage guides, and strength level ratings. Free bench press 1RM calculator, no login required.",
    keywords:
      "bench press 1rm calculator, max bench calculator, bench press max calculator, one rep max bench press",
    exampleSnippet: {
      heading: "Example Bench Press 1RM Estimate",
      input: "Input set: 185 lb x 5 reps",
      calculation: "Using Brzycki: 185 / (1.0278 - 0.0278 x 5) = 207.9",
      result: "Estimated bench press 1RM: 208 lb",
      takeaway:
        "Bench press estimates are usually cleanest when the set stays in the 3-10 rep range, with 5 reps often acting as the sweet spot.",
    },
    faqItems: [
      {
        question: "What rep range gives the cleanest bench press 1RM estimate?",
        answer: [
          "For most lifters, a hard set somewhere around 3-10 reps works best, with 5 reps often being the cleanest compromise between load and fatigue. In a ",
          {
            text: "2006 Journal of Strength and Conditioning Research study",
            href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
          },
          " on chest press and leg press, 5RM data produced the strongest 1RM prediction accuracy.",
        ],
      },
      {
        question: "What is a good bench press 1RM for my bodyweight?",
        answer:
          "Bench press strength depends on bodyweight, age, sex, and training experience. As a rough guide, an intermediate male lifter might bench around 1.0-1.25x bodyweight. Use the strength level ratings on this page or check the full bench press strength standards for a detailed comparison.",
      },
      {
        question: "Does bench press arch affect 1RM calculator accuracy?",
        answer:
          "A larger arch shortens the range of motion, which can allow more weight or reps on the same set. The calculator does not account for arch. For consistent tracking, use the same setup every time so your estimates reflect real progress rather than technique changes.",
      },
    ],
    liftLinks: [
      {
        href: "/strength-levels/bench-press",
        label: "Bench Press Strength Standards",
        description:
          "See where your bench ranks by bodyweight, age, and sex.",
      },
      {
        href: "/progress-guide/bench-press",
        label: "Bench Press Guide & PR Tracker",
        description:
          "Technique videos, E1RM history, rep PRs, and tonnage tracking.",
      },
      {
        href: "/warm-up-sets-calculator",
        label: "Build Warm-Up Sets",
        description:
          "Generate warm-up percentages from your estimated max.",
      },
    ],
  },
  "deadlift-1rm-calculator": {
    type: "lift",
    liftName: "Deadlift",
    blurb: [
      "Enter your deadlift working weight and reps. The deadlift 1RM is the king of raw strength metrics. A ",
      {
        text: "2006 prediction accuracy study",
        href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
      },
      " recommended using no more than 10 repetitions for 1RM predictions, and deadlift estimates tend to hold up best with sets of 3-5 reps where grip and form stay solid.",
    ],
    pageIntro:
      "Run your deadlift through all 7 major 1RM formulas and compare the estimates side by side. Deadlift predictions tend to be most reliable from heavy, clean sets of 3-5 reps where grip fatigue and form breakdown are not distorting the result.",
    title: "Deadlift 1RM Calculator | Max Deadlift Calculator — Free Tool",
    description:
      "Calculate your deadlift one rep max using 7 proven formulas. Get rep-max tables, percentage guides, and strength level ratings. Free deadlift 1RM calculator, no login required.",
    keywords:
      "deadlift 1rm calculator, max deadlift calculator, one rep max deadlift, deadlift max calculator",
    exampleSnippet: {
      heading: "Example Deadlift 1RM Estimate",
      input: "Input set: 315 lb x 5 reps",
      calculation: "Using Brzycki: 315 / (1.0278 - 0.0278 x 5) = 353.9",
      result: "Estimated deadlift 1RM: 354 lb",
      takeaway:
        "Deadlift estimates usually hold up best when the set is heavy but not grindy, which is why many lifters use a clean set of 3-5 reps.",
    },
    faqItems: [
      {
        question:
          "Why are deadlift 1RM estimates less reliable at higher reps?",
        answer:
          "Deadlifts accumulate grip fatigue and lower back fatigue faster than most lifts. By the time you reach 8-10+ reps, form breakdown and grip failure can cut a set short before the muscles are truly exhausted, which causes the calculator to underestimate your real max.",
      },
      {
        question: "Should I use a belt or straps when testing my deadlift 1RM?",
        answer:
          "For calculator input, use whatever setup matches how you normally train. If you always pull with a belt, use belted numbers. The calculator estimates your max under the same conditions as the input set. Just be consistent so you can track progress over time.",
      },
      {
        question: "What is a good deadlift 1RM for my bodyweight?",
        answer:
          "Deadlift strength varies by bodyweight, age, sex, and training history. As a rough guide, an intermediate male lifter might deadlift around 1.5-2x bodyweight. Use the strength level ratings on this page or check the full deadlift strength standards for a detailed comparison.",
      },
    ],
    liftLinks: [
      {
        href: "/strength-levels/deadlift",
        label: "Deadlift Strength Standards",
        description:
          "See where your deadlift ranks by bodyweight, age, and sex.",
      },
      {
        href: "/progress-guide/deadlift",
        label: "Deadlift Guide & PR Tracker",
        description:
          "Technique videos, E1RM history, rep PRs, and tonnage tracking.",
      },
      {
        href: "/warm-up-sets-calculator",
        label: "Build Warm-Up Sets",
        description:
          "Generate warm-up percentages from your estimated max.",
      },
    ],
  },
  "strict-press-1rm-calculator": {
    type: "lift",
    liftName: "Strict Press",
    blurb: [
      "Enter your strict press working weight and reps. The strict press (overhead press) is the hardest of the big four lifts to estimate because small form changes have a large effect on the result. A ",
      {
        text: "2006 prediction accuracy study",
        href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf",
      },
      " recommended keeping rep counts moderate for 1RM predictions, and strict press benefits from this more than any other lift.",
    ],
    pageIntro:
      "Run your strict press through all 7 major 1RM formulas and compare the estimates side by side. Strict press estimates get noisy faster than the other big lifts, so a clean set of 3-6 reps with no leg drive gives the most trustworthy result.",
    title: "Strict Press 1RM Calculator | OHP Max Calculator — Free Tool",
    description:
      "Calculate your strict press one rep max using 7 proven formulas. Rep-max tables, percentage guides, and strength ratings. Free overhead press / OHP 1RM calculator, no login required.",
    keywords:
      "strict press 1rm calculator, overhead press 1rm calculator, ohp 1rm calculator, max overhead press, press max calculator",
    exampleSnippet: {
      heading: "Example Strict Press 1RM Estimate",
      input: "Input set: 135 lb x 5 reps",
      calculation: "Using Brzycki: 135 / (1.0278 - 0.0278 x 5) = 151.7",
      result: "Estimated strict press 1RM: 152 lb",
      takeaway:
        "Strict press estimates get noisy faster than squat or deadlift, so moderate rep sets with clean form tend to give the most useful signal.",
    },
    faqItems: [
      {
        question:
          "Why are strict press 1RM estimates less accurate than other lifts?",
        answer:
          "The strict press involves smaller muscle groups and is more sensitive to small form variations. A slight lean-back or leg drive can add 10-15 lb to a set, which inflates the estimated max. Keeping reps in the 3-6 range with strict form gives the cleanest signal.",
      },
      {
        question:
          "What is the difference between strict press and push press for 1RM?",
        answer:
          "A strict press uses no leg drive at all. A push press uses a dip-and-drive from the legs to initiate the lift. Push press numbers are typically 15-25% higher than strict press for the same lifter. This calculator is designed for strict press. If you use push press numbers, the estimate will overstate your strict press max.",
      },
      {
        question: "What is a good strict press 1RM for my bodyweight?",
        answer:
          "The strict press is the lightest of the big four lifts. An intermediate male lifter might press around 0.6-0.75x bodyweight. Use the strength level ratings on this page or check the full strict press strength standards for a detailed comparison by age, sex, and bodyweight.",
      },
    ],
    liftLinks: [
      {
        href: "/strength-levels/strict-press",
        label: "Strict Press Strength Standards",
        description:
          "See where your press ranks by bodyweight, age, and sex.",
      },
      {
        href: "/progress-guide/strict-press",
        label: "Strict Press Guide & PR Tracker",
        description:
          "Technique videos, E1RM history, rep PRs, and tonnage tracking.",
      },
      {
        href: "/warm-up-sets-calculator",
        label: "Build Warm-Up Sets",
        description:
          "Generate warm-up percentages from your estimated max.",
      },
    ],
  },
};

export async function getStaticPaths() {
  return {
    paths: Object.keys(PAGE_CONFIG).map((slug) => ({ params: { slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const config = PAGE_CONFIG[params.slug];
  const relatedArticles = await fetchRelatedArticles("One Rep Max Calculator");
  return {
    props: { relatedArticles, pageConfig: config, slug: params.slug },
    revalidate: 60 * 60,
  };
}

function flattenAnswer(answer) {
  if (typeof answer === "string") return answer;
  return answer
    .map((seg) => (typeof seg === "string" ? seg : seg.text))
    .join("");
}

export default function FormulaOrLiftCalculatorPage({
  relatedArticles,
  pageConfig,
  slug,
}) {
  const canonicalURL = `https://www.strengthjourneys.xyz/calculator/${slug}`;
  const isFormula = pageConfig.type === "formula";
  const pageName = isFormula
    ? `${pageConfig.formulaName} Formula 1RM Calculator`
    : `${pageConfig.liftName} 1RM Calculator`;
  const pageIntro = pageConfig.pageIntro ?? pageConfig.blurb;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: pageName,
        applicationCategory: "HealthApplication",
        operatingSystem: "Any",
        description: pageConfig.description,
        url: canonicalURL,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://www.strengthjourneys.xyz",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "One Rep Max Calculator",
            item: "https://www.strengthjourneys.xyz/calculator",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: pageName,
            item: canonicalURL,
          },
        ],
      },
      ...(pageConfig.faqItems
        ? [
            {
              "@type": "FAQPage",
              mainEntity: pageConfig.faqItems.map(({ question, answer }) => ({
                "@type": "Question",
                name: question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: flattenAnswer(answer),
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <Head>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Head>
      <NextSeo
        title={pageConfig.title}
        description={pageConfig.description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: pageConfig.title,
          description: pageConfig.description,
          type: "website",
          images: [
            {
              url: "https://www.strengthjourneys.xyz/strength_journeys_one_rep_max_calculator_og.png",
              alt: "Strength Journeys One Rep Max Calculator",
            },
          ],
          site_name: "Strength Journeys",
        }}
        twitter={{
          handle: "@wayneschuller",
          site: "@wayneschuller",
          cardType: "summary_large_image",
        }}
        additionalMetaTags={[
          { name: "keywords", content: pageConfig.keywords },
        ]}
      />
      <E1RMCalculatorMain
        relatedArticles={relatedArticles}
        forceFormula={isFormula ? pageConfig.formulaName : null}
        forceLift={isFormula ? null : pageConfig.liftName}
        pageTitle={pageName}
        pageDescription={pageIntro}
        formulaBlurb={
          isFormula
            ? { equation: pageConfig.equation, text: pageConfig.blurb }
            : null
        }
        exampleSnippet={pageConfig.exampleSnippet ?? null}
        formulaSupport={isFormula ? pageConfig.formulaSupport : null}
        liftLinks={pageConfig.liftLinks ?? null}
        faqItems={pageConfig.faqItems}
      />
    </>
  );
}
