import { NextSeo } from "next-seo";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { E1RMCalculatorMain } from "./index";

// ── PAGE CONFIG ──────────────────────────────────────────────────────────────
// Slugs chosen to match top-impression queries from Search Console.

const PAGE_CONFIG = {
  // ── FORMULA PAGES ──────────────────────────────────────────────────────────
  "epley-formula-1rm-calculator": {
    type: "formula",
    formulaName: "Epley",
    equation: "w × (1 + r/30)",
    blurb: "Developed by Boyd Epley in 1985, one of the most widely cited 1RM equations in strength research.",
    title: "Epley Formula 1RM Calculator | One Rep Max with Epley Equation",
    description:
      "Calculate your one rep max using the Epley formula (w × (1 + r/30)). Compare against 6 other proven equations. Get rep projections, training percentages, and Big Four strength ratings. Free, no login.",
    keywords:
      "epley formula 1rm, epley formula 1rm calculation, epley formula one rep max, epley 1rm calculator",
  },
  "brzycki-formula-1rm-calculator": {
    type: "formula",
    formulaName: "Brzycki",
    equation: "w ÷ (1.0278 − 0.0278r)",
    blurb:
      "The Brzycki formula is considered especially accurate for lower rep ranges (1–10) and is widely used in powerlifting.",
    title: "Brzycki Formula 1RM Calculator | One Rep Max with Brzycki Equation",
    description:
      "Calculate your one rep max using the Brzycki formula (w ÷ (1.0278 − 0.0278r)). Compare against 6 other proven equations. Rep projections, percentage guides, strength ratings. Free, no login.",
    keywords:
      "brzycki formula 1rm, brzycki formula 1rm calculation, brzycki formula 1rm calculator, brzycki one rep max",
  },
  "mayhew-1rm-formula-calculator": {
    type: "formula",
    formulaName: "Mayhew",
    equation: "100w ÷ (52.2 + 41.9 × e^(−0.055r))",
    blurb: "The Mayhew formula uses an exponential curve, often cited as accurate for higher rep ranges.",
    title: "Mayhew Formula 1RM Calculator | One Rep Max Calculator",
    description:
      "Calculate your one rep max using the Mayhew 1RM formula. Compare all 7 proven equations side by side with rep projections and strength ratings. Free, no login.",
    keywords: "mayhew 1rm formula, mayhew formula calculator, mayhew one rep max",
  },
  "wathan-1rm-formula-calculator": {
    type: "formula",
    formulaName: "Wathan",
    equation: "100w ÷ (48.8 + 53.8 × e^(−0.075r))",
    blurb:
      "The Wathan formula is an exponential model published in the National Strength and Conditioning Association journal.",
    title: "Wathan Formula 1RM Calculator | One Rep Max Calculator",
    description:
      "Calculate your one rep max using the Wathan 1RM formula. Compare all 7 proven equations side by side. Free, no login required.",
    keywords: "wathan 1rm formula, wathan formula calculator, wathan one rep max",
  },
  "mcglothin-formula-1rm-calculator": {
    type: "formula",
    formulaName: "McGlothin",
    equation: "100w ÷ (101.3 − 2.671r)",
    blurb:
      "The McGlothin formula is a linear model offering consistent estimates across a wide range of rep counts.",
    title: "McGlothin Formula 1RM Calculator | One Rep Max Calculator",
    description:
      "Calculate your one rep max using the McGlothin formula. Compare all 7 proven 1RM equations. Free, no login required.",
    keywords: "mcglothin formula 1rm, mcglothin one rep max calculator, 1rm formula calculator",
  },
  "lombardi-formula-1rm-calculator": {
    type: "formula",
    formulaName: "Lombardi",
    equation: "w × r^0.1",
    blurb:
      "The Lombardi formula uses a power model — simple and fast to compute, suitable as a quick estimate.",
    title: "Lombardi Formula 1RM Calculator | One Rep Max Calculator",
    description:
      "Calculate your one rep max using the Lombardi formula. Compare all 7 proven 1RM equations. Free, no login required.",
    keywords: "lombardi formula 1rm, lombardi one rep max calculator, 1rm formula calculator",
  },
  "oconner-formula-1rm-calculator": {
    type: "formula",
    formulaName: "OConner",
    equation: "w × (1 + r/40)",
    blurb:
      "The O'Conner formula is a simplified linear model that tends to give slightly more conservative 1RM estimates than Epley.",
    title: "O'Conner Formula 1RM Calculator | One Rep Max Calculator",
    description:
      "Calculate your one rep max using the O'Conner formula. Compare all 7 proven 1RM equations. Free, no login required.",
    keywords: "oconner formula 1rm, o'conner one rep max calculator, 1rm formula calculator",
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
  },
  "bench-press-1rm-calculator": {
    type: "lift",
    liftName: "Bench Press",
    blurb:
      "Enter your bench press working weight and reps. Using a set of 3–10 reps gives the most accurate 1RM estimate. Results account for 7 proven formulas so you can see the full range.",
    title: "Bench Press 1RM Calculator | Max Bench Calculator — Free Tool",
    description:
      "Calculate your bench press one rep max using 7 proven formulas. Get rep-max tables, percentage guides, and strength level ratings. Free bench press 1RM calculator, no login required.",
    keywords:
      "bench press 1rm calculator, max bench calculator, bench press max calculator, one rep max bench press",
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
  },
  "overhead-press-1rm-calculator": {
    type: "lift",
    liftName: "Overhead Press",
    blurb:
      "Enter your overhead press working weight and reps. The OHP 1RM is a key upper body strength benchmark. Sets of 3–8 reps give the most reliable estimates.",
    title: "Overhead Press 1RM Calculator | OHP Max Calculator — Free Tool",
    description:
      "Calculate your overhead press one rep max using 7 proven formulas. Rep-max tables, percentage guides, and strength ratings. Free OHP 1RM calculator, no login required.",
    keywords:
      "overhead press 1rm calculator, ohp 1rm calculator, max overhead press, press max calculator",
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

export default function FormulaOrLiftCalculatorPage({ relatedArticles, pageConfig, slug }) {
  const canonicalURL = `https://www.strengthjourneys.xyz/calculator/${slug}`;
  const isFormula = pageConfig.type === "formula";

  return (
    <>
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
        defaultFormula={isFormula ? pageConfig.formulaName : "Brzycki"}
        pageTitle={
          isFormula
            ? `${pageConfig.formulaName} Formula 1RM Calculator`
            : `${pageConfig.liftName} 1RM Calculator`
        }
        pageDescription={pageConfig.blurb}
        formulaBlurb={
          isFormula ? { equation: pageConfig.equation, text: pageConfig.blurb } : null
        }
      />
    </>
  );
}
