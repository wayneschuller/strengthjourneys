import Head from "next/head";
import { NextSeo } from "next-seo";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { E1RMCalculatorMain } from "./index";

// ── PAGE CONFIG ──────────────────────────────────────────────────────────────
// Slugs chosen to match top-impression queries from Search Console.

const PAGE_CONFIG = {
  // ── FORMULA PAGES ──────────────────────────────────────────────────────────
  // GSC review 2026-03-07: titles/descriptions in this block were tuned for
  // CTR on already-high-ranking formula pages. Keep exact-match phrasing
  // intentional unless fresher query data suggests otherwise.
  "epley-formula-1rm-calculator": {
    type: "formula",
    formulaName: "Epley",
    equation: "w × (1 + r/30)",
    blurb: "Developed by Boyd Epley in 1985, one of the most widely cited 1RM equations in strength research.",
    title: "Epley Formula 1RM Calculator | Epley 1RM Calculation",
    description:
      "Use the Epley formula to calculate your one rep max from reps and weight. Compare Epley vs 6 other 1RM equations, rep max tables, and percentage loads.",
    keywords:
      "epley formula 1rm, epley formula 1rm calculation, epley formula one rep max, epley 1rm calculator",
    formulaSupport: {
      heading: "Use the Epley Formula 1RM Calculator",
      summary: [
        "This page is tuned for lifters who want a fast Epley formula 1RM calculation from a normal working set, then compare that result against the other major equations. Reynolds, Gordon, and Robergs found that ",
        { text: "\"5RM data produced the greatest prediction accuracy\"", href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf" },
        ", which lines up with how most lifters use Epley in practice.",
      ],
      bestFor:
        "moderate rep sets when you want a widely cited estimate that most lifters already recognize",
      repRange: "usually strongest from about 3-10 reps before fatigue distorts the estimate",
      links: [
        {
          href: "/calculator",
          label: "Compare All 7 Formulas",
          description: "Run the same set through every 1RM equation side by side.",
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
  },
  "brzycki-formula-1rm-calculator": {
    type: "formula",
    formulaName: "Brzycki",
    equation: "w ÷ (1.0278 − 0.0278r)",
    blurb:
      "The Brzycki formula is considered especially accurate for lower rep ranges (1–10) and is widely used in powerlifting.",
    title: "Brzycki Formula 1RM Calculator | Brzycki 1RM Calculation",
    description:
      "Use the Brzycki formula to calculate your one rep max from reps and weight. Compare Brzycki vs 6 other 1RM equations, rep max tables, and percentage loads.",
    keywords:
      "brzycki formula 1rm, brzycki formula 1rm calculation, brzycki formula 1rm calculator, brzycki one rep max",
    formulaSupport: {
      heading: "Use the Brzycki Formula 1RM Calculator",
      summary: [
        "This page is built for Brzycki formula queries where the lifter wants the exact equation, a cleaner lower-rep estimate, and a direct comparison with the rest of the calculator stack. That lower-rep bias also fits a 2006 ",
        { text: "strength-prediction paper", href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf" },
        " showing that prediction quality held up best when rep counts stayed lower rather than drifting toward 20-rep fatigue sets.",
      ],
      bestFor:
        "heavier sets in the lower rep ranges when you want a more conservative one rep max estimate",
      repRange: [
        "usually strongest from about 1-10 reps, especially on the lower end; that same paper concluded ",
        { text: "\"no more than 10 repetitions should be used\"", href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf" },
        " for linear 1RM estimates in the movements they tested",
      ],
      links: [
        {
          href: "/calculator",
          label: "Compare All 7 Formulas",
          description: "See where Brzycki sits relative to the full range of estimates.",
        },
        {
          href: "/calculator/epley-formula-1rm-calculator",
          label: "Compare Against Epley",
          description: "Useful if you want the most common side-by-side comparison.",
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
          { text: "2006 1RM prediction paper", href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf" },
          ": prediction quality held up better with lower-rep testing, while very high-rep sets introduced more fatigue-related noise.",
        ],
      },
    ],
  },
  "mayhew-1rm-formula-calculator": {
    type: "formula",
    formulaName: "Mayhew",
    equation: "100w ÷ (52.2 + 41.9 × e^(−0.055r))",
    blurb: "The Mayhew formula uses an exponential curve, often cited as accurate for higher rep ranges.",
    title: "Mayhew 1RM Formula Calculator | One Rep Max Tool",
    description:
      "Use the Mayhew formula to estimate one rep max from a working set. Compare results against Epley, Brzycki, and 4 more 1RM equations.",
    keywords: "mayhew 1rm formula, mayhew formula calculator, mayhew one rep max",
    formulaSupport: {
      heading: "Use the Mayhew Formula 1RM Calculator",
      summary:
        "This page is for lifters who specifically want a Mayhew 1RM formula calculation and need to compare an exponential estimate against the more familiar Epley and Brzycki models.",
      bestFor:
        "higher-rep work where you want to see how an exponential equation changes the top-end estimate",
      repRange: "especially useful once your working sets move beyond the classic 3-5 rep zone",
      links: [
        {
          href: "/calculator",
          label: "Compare All 7 Formulas",
          description: "See how Mayhew moves versus every other 1RM method.",
        },
        {
          href: "/calculator/epley-formula-1rm-calculator",
          label: "Compare Against Epley",
          description: "Useful when you want a simpler linear benchmark beside Mayhew.",
        },
        {
          href: "/calculator/brzycki-formula-1rm-calculator",
          label: "Compare Against Brzycki",
          description: "Helpful if you want to contrast higher-rep and lower-rep bias.",
        },
      ],
    },
    exampleSnippet: {
      heading: "Example Mayhew 1RM Calculation",
      input: "Input set: 225 lb x 8 reps",
      calculation: "Formula: 100 x 225 / (52.2 + 41.9 x e^(-0.055 x 8)) = 284.1",
      result: "Estimated 1RM: 284 lb",
      takeaway:
        "Mayhew rises faster once reps climb, so it is useful when you want to compare a higher-rep estimate against simpler linear formulas.",
    },
  },
  "wathan-1rm-formula-calculator": {
    type: "formula",
    formulaName: "Wathan",
    equation: "100w ÷ (48.8 + 53.8 × e^(−0.075r))",
    blurb:
      "The Wathan formula is an exponential model published in the National Strength and Conditioning Association journal.",
    title: "Wathan Formula 1RM Calculator | Wathan 1RM Formula",
    description:
      "Use the Wathan 1RM formula to estimate your one rep max from reps and weight. Compare all 7 proven equations with rep max tables and percentage loads.",
    keywords: "wathan 1rm formula, wathan formula calculator, wathan one rep max",
    exampleSnippet: {
      heading: "Example Wathan 1RM Calculation",
      input: "Input set: 225 lb x 8 reps",
      calculation: "Formula: 100 x 225 / (48.8 + 53.8 x e^(-0.075 x 8)) = 281.7",
      result: "Estimated 1RM: 282 lb",
      takeaway:
        "Wathan is another curved formula, so it is useful when you want a research-backed estimate that does not stay perfectly linear as reps increase.",
    },
  },
  "mcglothin-formula-1rm-calculator": {
    type: "formula",
    formulaName: "McGlothin",
    equation: "100w ÷ (101.3 − 2.671r)",
    blurb:
      "The McGlothin formula is a linear model offering consistent estimates across a wide range of rep counts.",
    title: "McGlothin Formula 1RM Calculator | McGlothin 1RM Formula",
    description:
      "Use the McGlothin formula to estimate your one rep max from reps and weight. Compare all 7 proven 1RM equations with rep max tables and percentages.",
    keywords: "mcglothin formula 1rm, mcglothin one rep max calculator, 1rm formula calculator",
    exampleSnippet: {
      heading: "Example McGlothin 1RM Calculation",
      input: "Input set: 225 lb x 5 reps",
      calculation: "Formula: 100 x 225 / (101.3 - 2.671 x 5) = 255.9",
      result: "Estimated 1RM: 256 lb",
      takeaway:
        "McGlothin stays fairly steady across a broad middle rep range, which makes it useful when you want a calmer linear comparison.",
    },
  },
  "lombardi-formula-1rm-calculator": {
    type: "formula",
    formulaName: "Lombardi",
    equation: "w × r^0.1",
    blurb:
      "The Lombardi formula uses a power model — simple and fast to compute, suitable as a quick estimate.",
    title: "Lombardi Formula 1RM Calculator | Lombardi 1RM Formula",
    description:
      "Use the Lombardi formula to estimate your one rep max from reps and weight. Compare all 7 proven 1RM equations with rep max tables and percentages.",
    keywords: "lombardi formula 1rm, lombardi one rep max calculator, 1rm formula calculator",
    exampleSnippet: {
      heading: "Example Lombardi 1RM Calculation",
      input: "Input set: 225 lb x 5 reps",
      calculation: "Formula: 225 x 5^0.1 = 264.2",
      result: "Estimated 1RM: 264 lb",
      takeaway:
        "Lombardi is quick to compute and often lands near Epley, so it works well as a fast cross-check rather than a sole answer.",
    },
  },
  "oconner-formula-1rm-calculator": {
    type: "formula",
    formulaName: "OConner",
    equation: "w × (1 + r/40)",
    blurb:
      "The O'Conner formula is a simplified linear model that tends to give slightly more conservative 1RM estimates than Epley.",
    title: "O'Conner Formula 1RM Calculator | OConner 1RM Formula",
    description:
      "Use the O'Conner formula to estimate your one rep max from reps and weight. Compare all 7 proven 1RM equations with rep max tables and percentages.",
    keywords: "oconner formula 1rm, o'conner one rep max calculator, 1rm formula calculator",
    exampleSnippet: {
      heading: "Example O'Conner 1RM Calculation",
      input: "Input set: 225 lb x 5 reps",
      calculation: "Formula: 225 x (1 + 5/40) = 253.1",
      result: "Estimated 1RM: 253 lb",
      takeaway:
        "O'Conner tends to estimate slightly lower than Epley, so it is a useful conservative check when you want to avoid inflated higher-rep projections.",
    },
  },

  // ── LIFT PAGES ─────────────────────────────────────────────────────────────
  "squat-1rm-calculator": {
    type: "lift",
    liftName: "Squat",
    blurb:
      "Enter your squat working weight and reps below. The back squat 1RM is a primary strength metric in powerlifting, tested at legal depth. A working set of 3–10 reps gives the most reliable estimate.",
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
  },
  "bench-press-1rm-calculator": {
    type: "lift",
    liftName: "Bench Press",
    blurb: [
      "Enter your bench press working weight and reps. Using a set of 3-10 reps gives the most accurate 1RM estimate. A 2006 ",
      { text: "bench and leg press prediction study", href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf" },
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
          { text: "2006 Journal of Strength and Conditioning Research study", href: "/reynolds-gordon-robergs-2006-1rm-strength-prediction.pdf" },
          " on chest press and leg press, 5RM data produced the strongest 1RM prediction accuracy.",
        ],
      },
    ],
  },
  "deadlift-1rm-calculator": {
    type: "lift",
    liftName: "Deadlift",
    blurb:
      "Enter your deadlift working weight and reps. The deadlift 1RM is the king of raw strength metrics. Sets of 3–8 reps typically give the most reliable estimates.",
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
  },
  "strict-press-1rm-calculator": {
    type: "lift",
    liftName: "Strict Press",
    blurb:
      "Enter your strict press working weight and reps. The strict press 1RM is a key upper body strength benchmark. Sets of 3–8 reps give the most reliable estimates.",
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
  return answer.map((seg) => (typeof seg === "string" ? seg : seg.text)).join("");
}

export default function FormulaOrLiftCalculatorPage({ relatedArticles, pageConfig, slug }) {
  const canonicalURL = `https://www.strengthjourneys.xyz/calculator/${slug}`;
  const isFormula = pageConfig.type === "formula";
  const pageName = isFormula
    ? `${pageConfig.formulaName} Formula 1RM Calculator`
    : `${pageConfig.liftName} 1RM Calculator`;
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
        additionalMetaTags={[{ name: "keywords", content: pageConfig.keywords }]}
      />
      <E1RMCalculatorMain
        relatedArticles={relatedArticles}
        forceFormula={isFormula ? pageConfig.formulaName : null}
        forceLift={isFormula ? null : pageConfig.liftName}
        pageTitle={
          isFormula
            ? `${pageConfig.formulaName} Formula 1RM Calculator`
            : `${pageConfig.liftName} 1RM Calculator`
        }
        pageDescription={pageConfig.blurb}
        formulaBlurb={
          isFormula ? { equation: pageConfig.equation, text: pageConfig.blurb } : null
        }
        exampleSnippet={pageConfig.exampleSnippet ?? null}
        formulaSupport={isFormula ? pageConfig.formulaSupport : null}
        faqItems={pageConfig.faqItems}
      />
    </>
  );
}
