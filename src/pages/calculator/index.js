import Head from "next/head";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

import { RelatedArticles } from "@/components/article-cards";
import { MiniFeedbackWidget } from "@/components/feedback";

import { estimateE1RM, estimateWeightForReps } from "@/lib/estimate-e1rm";
import { UnitChooser } from "@/components/unit-type-chooser";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageHeaderRight,
} from "@/components/page-header";

import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { bigFourURLs } from "@/components/lift-type-indicator";
import Link from "next/link";

import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { devLog } from "@/lib/processing-utils";
import { gaTrackCalcShareCopy } from "@/lib/analytics";
import { ShareCopyButton } from "@/components/share-copy-button";
import { getLiftSvgPath } from "@/components/year-recap/lift-svg";
import { cn } from "@/lib/utils";

import { useLocalStorage, useIsClient, useReadLocalStorage } from "usehooks-ts";
import { calculatePlateBreakdown } from "@/lib/warmups";
import { PlateDiagram } from "@/components/warmups/plate-diagram";

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useAthleteBio, getStrengthRatingForE1RM, STRENGTH_LEVEL_EMOJI } from "@/hooks/use-athlete-biodata";
import { useTransientSuccess } from "@/hooks/use-transient-success";
import { useStateFromQueryOrLocalStorage } from "@/hooks/use-state-from-query-or-localStorage";
import { Calculator } from "lucide-react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";

const getUnitSuffix = (isMetric) => (isMetric ? "kg" : "lb");

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "One Rep Max Calculator";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

/**
 * One Rep Max Calculator page. Renders SEO metadata and delegates rendering to E1RMCalculatorMain.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles related to the One Rep Max Calculator topic, fetched via ISR.
 */
export default function E1RMCalculator({ relatedArticles }) {
  const title = "One Rep Max Calculator | Free 1RM Tool, No Login Required";
  const description =
    "Free 1RM calculator using 7 proven formulas (Epley, Brzycki & more). Get rep-max projection tables, percentage training guides, and Big Four strength level ratings benchmarked to your age, sex, and bodyweight. No login required.";
  const keywords =
    "one rep max calculator, 1RM calculator, ORM calculator, e1RM calculator, Epley formula, Brzycki formula, powerlifting 1RM calculator, weightlifting max calculator, max lift predictor, strength level estimator, rep max projections, percentage calculator, Big Four strength standards, barbell load calculator";
  const canonicalURL = "https://www.strengthjourneys.xyz/calculator";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_one_rep_max_calculator_og.png";

  return (
    <>
      <NextSeo
        title={title}
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: title,
          description: description,
          type: "website",
          images: [
            // FIXME: ahrefs suggests you need just singular 'image' tag?
            {
              url: ogImageURL,
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
          {
            name: "keywords",
            content: keywords,
          },
        ]}
      />
      {/* Keep the main component separate. I learned the hard way if it breaks server rendering you lose static metadata tags */}
      <E1RMCalculatorMain relatedArticles={relatedArticles} />
    </>
  );
}

/**
 * Inner client component for the One Rep Max Calculator page. Provides reps/weight sliders, an animated
 * E1RM summary card, algorithm range bars, Big Four strength standard bars, and rep-range/percentage tables.
 *
 * Formula selection strategy:
 * - Normal pages (/calculator, lift slug pages): URL query → localStorage → defaultFormula.
 *   The user's saved preference is respected; shared links carry the formula in the URL.
 * - Formula slug pages (/calculator/epley-formula-1rm-calculator etc.): forceFormula always wins.
 *   The formula prop drives the display directly — no state, no URL query, no localStorage.
 *   Clicking a different formula redirects to /calculator with all current state in the query
 *   so the user lands on the main calculator with their inputs intact and the new formula selected.
 *
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles to display in the related articles section.
 * @param {string} [props.defaultFormula="Brzycki"] - Fallback formula for normal pages when no URL
 *   query or localStorage value exists. Ignored when forceFormula is set.
 * @param {string|null} [props.forceFormula=null] - When set, this formula is always shown regardless
 *   of URL query or localStorage. Clicking a different formula navigates away to /calculator.
 *   Intended for formula slug pages where the slug itself communicates the formula.
 * @param {string|null} [props.forceLift=null] - When set, shows lift-specific UI enhancements:
 *   the lift SVG next to the page title, the lift name + strength rating in the hero card, and
 *   the target lift featured prominently in the strength standards section.
 *   Value should be a slug page lift name e.g. "Squat", "Bench Press", "Deadlift", "Strict Press".
 * @param {string} [props.pageTitle] - Heading text for the page.
 * @param {string} [props.pageDescription] - Description text under the heading.
 * @param {Object|null} [props.formulaBlurb] - If set, renders an equation + blurb line under the description.
 *   Shape: { equation: string, text: string }. Used by formula slug pages to show the formula equation.
 */
export function E1RMCalculatorMain({
  relatedArticles,
  defaultFormula = "Brzycki",
  forceFormula = null,
  forceLift = null,
  pageTitle = "One Rep Max Calculator",
  pageDescription = "Enter reps and weight to estimate your one-rep max across 7 proven formulas. See rep-max projections, percentage training guides, and personalized Big Four strength levels by age, sex, and bodyweight.",
  formulaBlurb = null,
}) {
  const router = useRouter();
  const { toast } = useToast();
  const {
    isMetric,
    setIsMetric,
    bodyWeight,
    setBodyWeight,
    standards,
    age,
    sex,
    bioDataIsDefault,
  } = useAthleteBio({ modifyURLQuery: true });
  // Order matters: each includes the ones before it when syncing to URL.
  // Weight last so changing it syncs full state (reps, formula, unit type) → shareable URL.
  const [reps, setReps] = useStateFromQueryOrLocalStorage(
    LOCAL_STORAGE_KEYS.REPS,
    5,
    true,
    { [LOCAL_STORAGE_KEYS.CALC_IS_METRIC]: isMetric },
  ); // Will be a string
  // For normal pages: URL query → localStorage → defaultFormula.
  // For formula slug pages: forceFormula prop drives the display directly (no state involved).
  // Clicking a different formula redirects to /calculator with all current state in the query.
  const [hookFormula, setHookFormula] = useStateFromQueryOrLocalStorage(
    LOCAL_STORAGE_KEYS.FORMULA,
    defaultFormula,
    true,
    {
      [LOCAL_STORAGE_KEYS.CALC_IS_METRIC]: isMetric,
      [LOCAL_STORAGE_KEYS.REPS]: reps,
    },
  );
  const e1rmFormula = forceFormula ?? hookFormula;
  const setE1rmFormula = forceFormula !== null
    ? (newFormula) => router.push({
        pathname: "/calculator",
        query: {
          [LOCAL_STORAGE_KEYS.FORMULA]: JSON.stringify(newFormula),
          [LOCAL_STORAGE_KEYS.REPS]: JSON.stringify(reps),
          [LOCAL_STORAGE_KEYS.WEIGHT]: JSON.stringify(weight),
          [LOCAL_STORAGE_KEYS.CALC_IS_METRIC]: JSON.stringify(isMetric),
        },
      })
    : setHookFormula;
  const [weight, setWeight] = useStateFromQueryOrLocalStorage(
    LOCAL_STORAGE_KEYS.WEIGHT,
    225,
    true,
    {
      [LOCAL_STORAGE_KEYS.CALC_IS_METRIC]: isMetric,
      [LOCAL_STORAGE_KEYS.REPS]: reps,
      [LOCAL_STORAGE_KEYS.FORMULA]: e1rmFormula,
    },
  ); // Will be a string
  const isClient = useIsClient();
  const [isCapturingImage, setIsCapturingImage] = useState(false);
  const { isSuccess: isTextCopied, triggerSuccess: triggerTextCopied } = useTransientSuccess();
  const portraitRef = useRef(null);
  // Capture the resolved theme font at mount time so html2canvas gets the actual
  // font name (not just the unresolved --font-sans CSS variable)
  const [themeFontFamily, setThemeFontFamily] = useState("system-ui, sans-serif");
  useEffect(() => {
    setThemeFontFamily(window.getComputedStyle(document.body).fontFamily);
  }, []);
  // Helper function
  const updateQueryParams = (updatedParams) => {
    router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, ...updatedParams },
      },
      undefined,
      { shallow: true },
    );
  };

  const handleWeightSliderChange = (value) => {
    let newWeight = value[0];

    if (isMetric) {
      newWeight = 2.5 * Math.ceil(newWeight / 2.5); // For kg only allow nice multiples of 2.5kg
    } else {
      newWeight = 5 * Math.ceil(newWeight / 5); // For lb only allow nice multiples of 5lb
    }

    setWeight(newWeight);
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      // Defocus the input by removing focus
      event.target.blur();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      // Defocus the input by removing focus
      event.target.blur();
    }
  };

  const toggleIsMetric = (isMetric) => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.UNIT_PREFERENCE_SET, "1");
    let newWeight;
    let newBodyWeight;

    devLog(`toggle is metric running...`);

    if (!isMetric) {
      // Going from kg to lb
      newWeight = Math.round(weight * 2.2046);
      newBodyWeight = Math.round(bodyWeight * 2.2046);
      setIsMetric(false);
    } else {
      // Going from lb to kg
      newWeight = Math.round(weight / 2.2046);
      newBodyWeight = Math.round(bodyWeight / 2.2046);
      setIsMetric(true);
    }

    // Delay setting weight and bodyWeight states by 100ms
    // This hack allows the query params to update the above isMetric value before we update other values
    // We have race conditions with router updates and useEffects - please don't judge me, this works
    setTimeout(() => {
      setWeight(newWeight);
    }, 100); // Adjust delay as needed

    setTimeout(() => {
      setBodyWeight(newBodyWeight);
    }, 200); // Adjust delay as needed
  };

  const handleCopyToClipboard = async () => {
    const unit = getUnitSuffix(isMetric);
    const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);

    let sentenceToCopy;

    if (forceLift) {
      // Lift slug pages — rich copy with strength rating, bodyweight ratio, and next tier.
      const bigFourName = LIFT_SLUG_TO_BIG_FOUR[forceLift];
      const liftData = bigFourName ? getLiftBarData(bigFourName, standards, e1rmWeight) : null;

      const params = new URLSearchParams({
        [LOCAL_STORAGE_KEYS.REPS]: reps,
        [LOCAL_STORAGE_KEYS.WEIGHT]: weight,
        [LOCAL_STORAGE_KEYS.CALC_IS_METRIC]: isMetric,
        [LOCAL_STORAGE_KEYS.FORMULA]: e1rmFormula,
      });
      params.set("unit", unit);
      if (!bioDataIsDefault) {
        params.set(LOCAL_STORAGE_KEYS.ATHLETE_AGE, age);
        params.set(LOCAL_STORAGE_KEYS.ATHLETE_SEX, sex);
        params.set(LOCAL_STORAGE_KEYS.ATHLETE_BODY_WEIGHT, bodyWeight);
      }

      const lines = [
        `${bigFourName ?? forceLift} ${reps}@${weight}${unit} indicates a one rep max of ${e1rmWeight}${unit}, using the ${e1rmFormula} algorithm.`,
      ];
      if (!bioDataIsDefault && bodyWeight > 0) {
        lines.push(`${(e1rmWeight / bodyWeight).toFixed(2)}× bodyweight`);
      }
      if (liftData) {
        lines.push(`${bigFourName ?? forceLift}: ${liftData.emoji} ${liftData.rating}`);
        if (liftData.nextTierInfo && liftData.diff) {
          lines.push(`Next: ${STRENGTH_LEVEL_EMOJI[liftData.nextTierInfo.name] ?? ""} ${liftData.nextTierInfo.name} — ${liftData.diff}${unit} away`);
        }
      }
      const slugPath = router.asPath.split("?")[0];
      lines.push(`Source: https://www.strengthjourneys.xyz${slugPath}?${params.toString()}`);
      sentenceToCopy = lines.join("\n");
    } else {
      // Generic calculator page — simple one-liner.
      const encodeQueryParam = (param) => encodeURIComponent(param);
      const createQueryString = (p) =>
        Object.entries(p).map(([k, v]) => `${encodeQueryParam(k)}=${encodeQueryParam(v)}`).join("&");
      const queryString = createQueryString({
        reps,
        weight,
        unit,
        calcIsMetric: isMetric,
        formula: e1rmFormula,
      });
      sentenceToCopy =
        `Lifting ${reps}@${weight}${unit} indicates a one rep max of ${e1rmWeight}${unit}, ` +
        `using the ${e1rmFormula} algorithm.\n` +
        `Source: https://www.strengthjourneys.xyz/calculator?${queryString}`;
    }

    const textarea = document.createElement("textarea");
    let didCopy = false;
    try {
      textarea.value = sentenceToCopy;
      document.body.appendChild(textarea);
      textarea.select();

      // FIXME: deprecated function still works
      didCopy = document.execCommand("copy");
      if (!didCopy) {
        throw new Error("Copy command failed");
      }

      triggerTextCopied();
    } catch (error) {
      console.error("Unable to copy calculator text:", error);
      toast({ variant: "destructive", title: "Could not copy result" });
    } finally {
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }

    // This fails in React - but it's the new API
    // if (navigator?.clipboard?.writeText) {
    //   try {
    //     await navigator.clipboard.writeText(sentenceToCopy);
    //     alert("Result copied to clipboard. Use ctrl-v to paste elsewhere.");
    //   } catch (error) {
    //     console.error("Unable to copy to clipboard:", error);
    //   }
    // } else {
    //   // Fallback for browsers that do not support the Clipboard API
    //   console.warn("Clipboard API not supported. You may need to copy the text manually.");
    // }
  };

  const handleCopyImage = async () => {
    if (!portraitRef.current) return;
    setIsCapturingImage(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;

      let watermarkEl = null;
      try {
        watermarkEl = document.createElement("div");
        watermarkEl.textContent = "strengthjourneys.xyz";
        Object.assign(watermarkEl.style, {
          position: "absolute",
          right: "12px",
          bottom: "12px",
          padding: "4px 12px",
          borderRadius: "9999px",
          background: "rgba(15, 23, 42, 0.86)",
          color: "rgba(248, 250, 252, 0.98)",
          fontSize: "11px",
          fontWeight: "500",
          letterSpacing: "0.03em",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          boxShadow: "0 6px 16px rgba(15, 23, 42, 0.55)",
          pointerEvents: "none",
          zIndex: "10",
        });
        portraitRef.current.appendChild(watermarkEl);

        const canvas = await html2canvas(portraitRef.current, {
          backgroundColor: null,
          scale: 3,
        });

        canvas.toBlob((blob) => {
          navigator.clipboard
            .write([new ClipboardItem({ "image/png": blob })])
            .then(() => {
              toast({ title: "Image copied! Paste into Instagram or anywhere." });
              gaTrackCalcShareCopy("image", { page: router.asPath });
            })
            .catch((err) => {
              console.error("Copy image error:", err);
              toast({ variant: "destructive", title: "Could not copy image to clipboard" });
            });
        }, "image/png");
      } finally {
        if (watermarkEl && watermarkEl.parentNode) {
          watermarkEl.parentNode.removeChild(watermarkEl);
        }
      }
    } finally {
      setIsCapturingImage(false);
    }
  };

  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const unit = getUnitSuffix(isMetric);

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Calculator}>
          {pageTitle}
        </PageHeaderHeading>
        <PageHeaderDescription>
          {pageDescription}
        </PageHeaderDescription>
        {formulaBlurb && (
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {formulaBlurb.equation} — {formulaBlurb.text}
          </p>
        )}
        {forceLift && getLiftSvgPath(forceLift) && LIFT_SLUG_TO_INSIGHTS_URL[forceLift] && (
          <PageHeaderRight>
            <Link
              href={LIFT_SLUG_TO_INSIGHTS_URL[forceLift]}
              className="hover:bg-muted flex w-64 items-center gap-3 rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex-1">
                <h3 className="text-base font-semibold">{forceLift} Insights</h3>
                <p className="text-muted-foreground text-sm">
                  Standards, PRs &amp; progress →
                </p>
              </div>
              <img
                src={getLiftSvgPath(forceLift)}
                alt={forceLift}
                className="h-24 w-24 flex-shrink-0 object-contain opacity-90 transition-opacity hover:opacity-50"
              />
            </Link>
          </PageHeaderRight>
        )}
      </PageHeader>
      <Card>
        <CardContent>
          {/* Two main sliders */}
          <div className="mt-4 grid grid-cols-1 items-center gap-6 md:grid-cols-6 md:gap-4">
            <div className="ml-2 justify-self-center text-2xl md:hidden">
              {reps} reps
            </div>
            <Slider
              className="md:col-span-5"
              value={[reps]}
              min={1}
              max={20}
              step={1}
              onValueChange={(values) => setReps(values[0])}
              aria-label="Reps"
            />
            <div className="ml-2 hidden justify-self-center text-lg md:block md:w-[7rem] md:justify-self-start">
              {reps} reps
            </div>
            <div className="ml-2 mt-6 w-[9rem] justify-self-center md:hidden">
              <div className="flex items-center gap-1 text-2xl">
                <Input
                  className="text-2xl"
                  type="number"
                  min="1"
                  step="1"
                  id="weightInput"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  onKeyPress={handleKeyPress}
                  onKeyDown={handleKeyDown}
                  aria-label="Weight"
                />
                <UnitChooser
                  isMetric={isMetric}
                  onSwitchChange={toggleIsMetric}
                />
              </div>
            </div>
            <Slider
              className="md:col-span-5"
              value={[weight]}
              min={1}
              max={isMetric ? 250 : 600}
              onValueChange={handleWeightSliderChange}
              aria-label="Weight"
            />
            <div className="ml-1 hidden w-[8rem] justify-self-center md:block md:justify-self-start">
              <div className="flex items-center gap-1">
                <Input
                  className="text-lg"
                  type="number"
                  min="1"
                  step="1"
                  id="weightInput"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  onKeyPress={handleKeyPress}
                  onKeyDown={handleKeyDown}
                  aria-label="Weight"
                />
                <UnitChooser
                  isMetric={isMetric}
                  onSwitchChange={toggleIsMetric}
                />
              </div>
            </div>
          </div>

          {/* Hidden portrait card — 9:16 for Instagram Stories image capture */}
          <div
            ref={portraitRef}
            style={{
              position: "fixed",
              left: "-9999px",
              top: 0,
              width: "360px",
              height: "640px",
              fontFamily: themeFontFamily,
            }}
            className="relative flex flex-col items-center justify-center gap-6 rounded-xl border-4 bg-card px-8 py-10 text-card-foreground"
          >
            <div className="w-full text-center" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>
                One Rep Max
              </div>
              <div style={{ fontSize: "20px", opacity: 0.6 }}>
                {reps} reps @ {weight}{isMetric ? "kg" : "lb"}
              </div>
            </div>
            <div style={{ textAlign: "center", lineHeight: 1 }}>
              <div style={{ fontSize: "128px", fontWeight: 800, letterSpacing: "-0.04em" }}>
                {e1rmWeight}
              </div>
              <div style={{ fontSize: "40px", fontWeight: 700, opacity: 0.55, marginTop: "4px" }}>
                {isMetric ? "kg" : "lb"}
              </div>
            </div>
            <div style={{ fontSize: "15px", opacity: 0.45 }}>
              {e1rmFormula} formula
            </div>
          </div>

          {/* Hero card — always centered */}
          <div className="my-6 flex flex-col items-center gap-3">
            <E1RMSummaryCard
              reps={reps}
              weight={weight}
              isMetric={isMetric}
              e1rmFormula={e1rmFormula}
              estimateE1RM={estimateE1RM}
              forceLift={forceLift}
            />
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
              <div className="justify-self-start">
                <MiniFeedbackWidget
                  prompt="Useful calculator?"
                  contextId="e1rm_calculator"
                  page="/calculator"
                  analyticsExtra={{ context: "e1rm_calculator_card" }}
                />
              </div>
              <ShareCopyButton
                label="Copy Text"
                successLabel="Copied"
                isSuccess={isTextCopied}
                className="min-w-[112px] justify-self-center"
                onPressAnalytics={() => gaTrackCalcShareCopy("text", { page: router.asPath })}
                onClick={handleCopyToClipboard}
              />
              <div aria-hidden className="justify-self-end" />
            </div>
          </div>
          {/* Algorithm comparison bar */}
          <div className="mb-6">
            <AlgorithmRangeBars
              reps={reps}
              weight={weight}
              isMetric={isMetric}
              e1rmFormula={e1rmFormula}
              setE1rmFormula={setE1rmFormula}
            />
          </div>

          {/* Big Four strength standards — always shown */}
          <div className="mb-6">
            <BigFourStrengthBars
              reps={reps}
              weight={weight}
              e1rmWeight={e1rmWeight}
              isMetric={isMetric}
              e1rmFormula={e1rmFormula}
              forceLift={forceLift}
            />
          </div>

          {/* Rep Range + Percentage Tables side by side */}
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <RepRangeTable
              key={`${e1rmFormula}-${weight}-${reps}`}
              reps={reps}
              weight={weight}
              e1rmFormula={e1rmFormula}
              isMetric={isMetric}
              forceLift={forceLift}
            />
            <PercentageTable
              key={`pct-${e1rmFormula}-${weight}-${reps}`}
              reps={reps}
              weight={weight}
              e1rmFormula={e1rmFormula}
              isMetric={isMetric}
              forceLift={forceLift}
            />
          </div>
        </CardContent>
      </Card>
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}


/**
 * Hero card displaying the animated estimated one-rep max number, the input set context, and
 * optionally a bodyweight ratio when athlete bio data is available.
 * When forceLift is set, also shows the lift name in the title and the strength level rating.
 * @param {Object} props
 * @param {number|string} props.reps - Number of reps performed.
 * @param {number|string} props.weight - Weight lifted.
 * @param {boolean} props.isMetric - Whether weight is in kg (true) or lb (false).
 * @param {string} props.e1rmFormula - Name of the E1RM formula currently selected.
 * @param {Function} props.estimateE1RM - Function to compute the estimated one-rep max.
 * @param {string|null} [props.forceLift=null] - When set, shows lift name in title and strength rating.
 */
const E1RMSummaryCard = ({ reps, weight, isMetric, e1rmFormula, estimateE1RM, forceLift = null }) => {
  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const { bodyWeight, bioDataIsDefault, standards } = useAthleteBio();

  const motionVal = useMotionValue(e1rmWeight);
  const springVal = useSpring(motionVal, { stiffness: 200, damping: 20 });
  const displayVal = useTransform(springVal, (v) => Math.round(v));

  useEffect(() => {
    motionVal.set(e1rmWeight);
  }, [e1rmWeight, motionVal]);

  // Strength rating for the forced lift type, when on a lift slug page
  const bigFourName = forceLift ? LIFT_SLUG_TO_BIG_FOUR[forceLift] : null;
  const liftStandard = bigFourName ? standards?.[bigFourName] : null;
  const liftRating = liftStandard?.elite ? getStrengthRatingForE1RM(e1rmWeight, liftStandard) : null;
  const liftRatingEmoji = liftRating ? (STRENGTH_LEVEL_EMOJI[liftRating] ?? "") : null;

  // Plate diagram: read warmup-calc preferences from localStorage, falling back to warmup-calc defaults
  const storedBarType = useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_BAR_TYPE, { initializeWithValue: false }) ?? "standard";
  const storedPlatePreference = useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_PLATE_PREFERENCE, { initializeWithValue: false }) ?? "red";
  const barWeight = isMetric ? (storedBarType === "womens" ? 15 : 20) : (storedBarType === "womens" ? 35 : 45);
  const plateBreakdown = calculatePlateBreakdown(e1rmWeight, barWeight, isMetric, storedPlatePreference);
  const unit = isMetric ? "kg" : "lb";
  const warmupURL = `/warm-up-sets-calculator?${LOCAL_STORAGE_KEYS.WARMUP_WEIGHT}=${e1rmWeight}&${LOCAL_STORAGE_KEYS.CALC_IS_METRIC}=${isMetric}`;
  const diagramAnimKey = `${e1rmWeight}-${isMetric}-${storedBarType}-${storedPlatePreference}`;

  return (
    <Card className="w-full max-w-2xl border-4">
      <CardHeader>
        <CardTitle className="text-center md:text-3xl">
          {forceLift ? `${forceLift} — Estimated 1RM` : "Estimated One Rep Max"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="md:grid md:grid-cols-2 md:gap-6">
          {/* Left: number display */}
          <div>
            <div className="text-center text-lg md:text-xl text-muted-foreground">
              {reps}@{weight}{unit}
            </div>
            <div className="text-center text-5xl font-bold tracking-tight md:text-6xl xl:text-7xl">
              <motion.span className="tabular-nums">{displayVal}</motion.span>
              {unit}
            </div>
            {liftRating && (
              <div className="mt-2 text-center text-base font-semibold">
                {liftRatingEmoji} {liftRating}
              </div>
            )}
            {!bioDataIsDefault && bodyWeight > 0 && (
              <div className="mt-1 text-center text-sm text-muted-foreground">
                {(e1rmWeight / bodyWeight).toFixed(2)}× bodyweight
              </div>
            )}
          </div>

          {/* Right: plate diagram (desktop only) — click to open warmup calculator */}
          <div className="hidden md:flex md:flex-col md:items-end md:justify-center">
            <Link
              href={warmupURL}
              className="group flex flex-col items-end rounded-lg p-2 transition-colors hover:bg-muted"
              title="Plan warmup sets to build to this weight"
            >
              <PlateDiagram
                platesPerSide={plateBreakdown.platesPerSide}
                barWeight={barWeight}
                isMetric={isMetric}
                animationKey={diagramAnimKey}
                useScrollTrigger={false}
              />
              <div className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                Plan warmup sets →
              </div>
            </Link>
            {plateBreakdown.remainder !== 0 && (
              <div className="px-2 text-right text-xs text-muted-foreground">
                Closest: {plateBreakdown.closestWeight}{unit}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground">
        <div className="flex-1 text-center">
          Using the <strong>{e1rmFormula}</strong> formula
        </div>
      </CardFooter>
    </Card>
  );
};

/**
 * Zoomed horizontal track visualizing the spread of all 7 E1RM algorithm estimates. Dots are clickable
 * to switch the active formula, and labels merge when adjacent estimates are too close to distinguish.
 * @param {Object} props
 * @param {number|string} props.reps - Number of reps performed.
 * @param {number|string} props.weight - Weight lifted.
 * @param {boolean} props.isMetric - Whether weight is in kg (true) or lb (false).
 * @param {string} props.e1rmFormula - Currently active E1RM formula name.
 * @param {Function} props.setE1rmFormula - Setter to change the active formula.
 */
function AlgorithmRangeBars({ reps, weight, isMetric, e1rmFormula, setE1rmFormula }) {
  const unit = isMetric ? "kg" : "lb";
  const accentColor = "var(--primary)";
  const [openPopoverKey, setOpenPopoverKey] = useState(null);

  // All 7 formulae sorted low→high
  const estimates = useMemo(
    () =>
      e1rmFormulae
        .map((formula) => ({ formula, value: estimateE1RM(reps, weight, formula) }))
        .sort((a, b) => a.value - b.value),
    [reps, weight],
  );

  const minVal = estimates[0].value;
  const maxVal = estimates[estimates.length - 1].value;
  const range = maxVal - minVal;

  // Track spans exactly from the lowest to highest algorithm estimate.
  // Fallback padding only when all algorithms agree (range === 0) so the dot stays visible.
  const trackRange = range > 0 ? range : (isMetric ? 10 : 25);
  const detailMin = range > 0 ? minVal : minVal - trackRange / 2;
  const detailMax = detailMin + trackRange;
  const detailPct = (v) => ((v - detailMin) / trackRange) * 100;
  const detailBandLeft = detailPct(minVal);
  const detailBandWidth = detailPct(maxVal) - detailBandLeft;

  // Helper used by both merge passes.
  const getLabelText = (formulas, values) => {
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const wStr = minV === maxV ? `${minV}${unit}` : `${minV}–${maxV}${unit}`;
    return formulas.join(" / ") + " " + wStr;
  };

  // Desktop merge — classic centre-to-centre threshold. Less aggressive; desktop tracks are
  // wide enough that only truly overlapping neighbours need grouping.
  const DESKTOP_MERGE_THRESHOLD_PCT = 8;
  const desktopMergedLabels = [];
  for (const { formula, value } of estimates) {
    const pct = detailPct(value);
    const last = desktopMergedLabels[desktopMergedLabels.length - 1];
    if (last && pct - last.pct < DESKTOP_MERGE_THRESHOLD_PCT) {
      last.formulas.push(formula);
      last.values.push(value);
      const memberPcts = last.formulas.map(
        (f) => detailPct(estimates.find((e) => e.formula === f).value),
      );
      last.pct = memberPcts.reduce((a, b) => a + b, 0) / memberPcts.length;
    } else {
      desktopMergedLabels.push({ formulas: [formula], pct, values: [value] });
    }
  }

  // Mobile merge — text-width-aware using the *initials* label that's actually rendered
  // (e.g. "B/W 123kg"), not the full formula names. Initials are much shorter so far fewer
  // groups need merging. Assumes ~1.2% per char (≈7px on ~580px track).
  const getMobileInitialsText = (formulas, values) => {
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const wStr = minV === maxV ? `${minV}${unit}` : `${minV}–${maxV}${unit}`;
    return formulas.map((f) => f[0]).join("/") + " " + wStr;
  };
  const CHAR_WIDTH_PCT = 1.2;
  const mobileMergedLabels = [];
  for (const { formula, value } of estimates) {
    const pct = detailPct(value);
    const last = mobileMergedLabels[mobileMergedLabels.length - 1];
    if (last) {
      const lastWidthPct = getMobileInitialsText(last.formulas, last.values).length * CHAR_WIDTH_PCT;
      const isLastFirst = mobileMergedLabels.length === 1;
      const lastRightEdge = isLastFirst ? last.pct + lastWidthPct : last.pct + lastWidthPct / 2;
      if (pct - lastRightEdge < 4) {
        last.formulas.push(formula);
        last.values.push(value);
        const memberPcts = last.formulas.map(
          (f) => detailPct(estimates.find((e) => e.formula === f).value),
        );
        last.pct = memberPcts.reduce((a, b) => a + b, 0) / memberPcts.length;
      } else {
        mobileMergedLabels.push({ formulas: [formula], pct, values: [value] });
      }
    } else {
      mobileMergedLabels.push({ formulas: [formula], pct, values: [value] });
    }
  }

  const springConfig = { duration: 0 };
  const dotSpring = { duration: 0 };

  return (
    <div className="select-none">
      {/* ── Detail track: zoomed into the algorithm cluster ── */}
      <div>
        {/* Track */}
        <TooltipProvider>
          <div className="relative" style={{ height: "20px" }}>
            <div className="absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-muted" />
            <motion.div
              className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: accentColor, opacity: 0.4 }}
              animate={{ left: `${detailBandLeft}%`, width: `${Math.max(detailBandWidth, 0.5)}%` }}
              transition={springConfig}
            />
            {estimates.map(({ formula, value }) => {
              const isSelected = formula === e1rmFormula;
              return (
                <Tooltip key={formula}>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => setE1rmFormula(formula)}
                      animate={{
                        width: isSelected ? "14px" : "10px",
                        height: isSelected ? "14px" : "10px",
                        opacity: isSelected ? 1 : 0.45,
                      }}
                      transition={dotSpring}
                      style={{
                        position: "absolute",
                        left: `${Math.min(Math.max(detailPct(value), 1.5), 98.5)}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        borderRadius: "9999px",
                        backgroundColor: isSelected ? accentColor : "var(--muted-foreground)",
                        zIndex: isSelected ? 10 : 1,
                        boxShadow: isSelected ? `0 0 0 3px ${accentColor}30` : "none",
                        cursor: "pointer",
                        border: "none",
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-semibold">{formula}</p>
                    <p>{value}{unit}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Labels: desktop — full formula names */}
        <div className="relative mt-1 hidden md:block" style={{ height: "34px" }}>
          {desktopMergedLabels.map((group, groupIndex) => {
            const isFirst = groupIndex === 0;
            const isLast = groupIndex === desktopMergedLabels.length - 1;
            const minV = Math.min(...group.values);
            const maxV = Math.max(...group.values);
            const weightLabel = minV === maxV ? `${minV}${unit}` : `${minV}–${maxV}${unit}`;
            const translateClass = isFirst
              ? "translate-x-0"
              : isLast
                ? "-translate-x-full"
                : "-translate-x-1/2";
            return (
              <div
                key={group.formulas.join("-")}
                style={{ left: `${group.pct}%` }}
                className={cn(
                  "absolute top-0 whitespace-nowrap text-xs leading-tight",
                  translateClass,
                )}
              >
                <div>
                  {group.formulas.map((formula, fi) => (
                    <span key={formula}>
                      {fi > 0 && <span className="text-muted-foreground/40"> / </span>}
                      <button
                        onClick={() => setE1rmFormula(formula)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          e1rmFormula === formula
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground/80 hover:text-foreground",
                        )}
                      >
                        {formula}
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-0.5 opacity-60">{weightLabel}</div>
              </div>
            );
          })}
        </div>

        {/* Labels: mobile — first letter(s) only, popover for merged groups */}
        <div className="relative mt-1 md:hidden" style={{ height: "34px" }}>
          {mobileMergedLabels.map((group, groupIndex) => {
            const isFirst = groupIndex === 0;
            const isLast = groupIndex === mobileMergedLabels.length - 1;
            const minV = Math.min(...group.values);
            const maxV = Math.max(...group.values);
            const weightLabel = minV === maxV ? `${minV}${unit}` : `${minV}–${maxV}${unit}`;
            const translateClass = isFirst
              ? "translate-x-0"
              : isLast
                ? "-translate-x-full"
                : "-translate-x-1/2";
            const groupKey = group.formulas.join("-");
            const initials = group.formulas.map((f) => f[0]).join("/");
            const isGroupSelected = group.formulas.includes(e1rmFormula);
            const labelCls = cn(
              "cursor-pointer transition-colors",
              isGroupSelected ? "font-semibold text-foreground" : "text-muted-foreground/80",
            );
            return (
              <div
                key={groupKey}
                style={{ left: `${group.pct}%` }}
                className={cn(
                  "absolute top-0 whitespace-nowrap text-xs leading-tight",
                  translateClass,
                )}
              >
                {/* Always show popover on mobile — single or merged — so the full name and
                    value are visible before committing, and the UX is consistent. */}
                <Popover
                  open={openPopoverKey === groupKey}
                  onOpenChange={(o) => setOpenPopoverKey(o ? groupKey : null)}
                >
                  <PopoverTrigger asChild>
                    <button className={cn("text-left", labelCls)}>
                      <span className="block">{initials}</span>
                      <span className="mt-0.5 block opacity-60">{weightLabel}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-2"
                    align={isFirst ? "start" : isLast ? "end" : "center"}
                  >
                    <div className="flex flex-col gap-0.5">
                      {group.formulas.map((formula) => {
                        const val = estimates.find((e) => e.formula === formula)?.value ?? 0;
                        const isSelected = e1rmFormula === formula;
                        return (
                          <button
                            key={formula}
                            onClick={() => { setE1rmFormula(formula); setOpenPopoverKey(null); }}
                            className={cn(
                              "flex items-center gap-3 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted text-left",
                              isSelected ? "font-semibold" : "",
                            )}
                          >
                            <span className="flex-1">{formula}</span>
                            <span className="text-muted-foreground">{val}{unit}</span>
                            {isSelected && <span className="text-primary">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
}

/**
 * Table projecting the estimated best lift at each rep count from 1–20RM, derived from the current
 * E1RM. Highlights the row matching the user's current rep input and animates in on each re-mount.
 * @param {Object} props
 * @param {number|string} props.reps - Currently selected rep count (used to highlight the matching row).
 * @param {number|string} props.weight - Weight lifted.
 * @param {string} props.e1rmFormula - E1RM formula used for all projections.
 * @param {boolean} props.isMetric - Whether weight is in kg (true) or lb (false).
 */
function RepRangeTable({ reps, weight, e1rmFormula, isMetric, forceLift = null }) {
  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const unit = isMetric ? "kg" : "lb";
  const currentReps = Number(reps);

  const repPoints = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20];
  const rows = repPoints.map((r) => ({
    reps: r,
    weight: estimateWeightForReps(e1rmWeight, r, e1rmFormula),
  }));

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold">
        {forceLift ? `${forceLift} Rep Max Projections` : "Rep Max Projections"}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{e1rmFormula} algorithm</p>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium">Reps</th>
              <th className="px-4 py-2 text-right font-medium">Weight ({unit})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ reps: r, weight: w }, i) => {
              const isCurrentReps = r === currentReps;
              return (
                <motion.tr
                  key={r}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.04, ease: "easeOut" }}
                  className={cn(
                    "border-b last:border-b-0",
                    isCurrentReps ? "font-semibold bg-accent" : "",
                  )}
                >
                  <td className="px-4 py-2">
                    {r}RM
                    {isCurrentReps && (
                      <span className="ml-2 text-xs text-muted-foreground">(current)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {w}{unit}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/**
 * Table showing common training intensities from 100% down to 50% of the estimated one-rep max in 5%
 * steps, useful for percentage-based programming templates.
 * @param {Object} props
 * @param {number|string} props.reps - Number of reps performed (used to derive E1RM).
 * @param {number|string} props.weight - Weight lifted.
 * @param {string} props.e1rmFormula - E1RM formula used to compute the base max.
 * @param {boolean} props.isMetric - Whether weight is in kg (true) or lb (false).
 */
function PercentageTable({ reps, weight, e1rmFormula, isMetric, forceLift = null }) {
  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const unit = isMetric ? "kg" : "lb";

  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
  const rows = percentages.map((pct) => ({
    pct,
    weight: Math.round((e1rmWeight * pct) / 100),
  }));

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold">
        {forceLift ? `${forceLift} Percentage Calculator` : "Percentage Calculator"}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Based on {e1rmWeight}{unit} estimated max
      </p>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium">Intensity</th>
              <th className="px-4 py-2 text-right font-medium">Weight ({unit})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ pct, weight: w }, i) => {
              const isMax = pct === 100;
              return (
                <motion.tr
                  key={pct}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, ease: "easeOut" }}
                  className={cn(
                    "border-b last:border-b-0",
                    isMax ? "font-semibold bg-accent" : "",
                  )}
                >
                  <td className="px-4 py-2 tabular-nums">{pct}%</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {w}{unit}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


const BIG_FOUR = ["Back Squat", "Bench Press", "Deadlift", "Strict Press"];

// Pure helper — computes display data for a single strength-level bar row.
// Hoisted to module level so handleCopyToClipboard can use it for the hero copy button.
function getLiftBarData(liftType, standards, e1rmWeight) {
  const standard = standards?.[liftType];
  if (!standard?.elite) return null;
  const rating = getStrengthRatingForE1RM(e1rmWeight, standard);
  const emoji = STRENGTH_LEVEL_EMOJI[rating] ?? "";
  const { physicallyActive, elite } = standard;
  const range = elite - physicallyActive;
  const pct = range > 0
    ? Math.min(98, Math.max(2, ((e1rmWeight - physicallyActive) / range) * 100))
    : 50;
  const nextTierInfo = NEXT_TIER[rating];
  const nextTierValue = nextTierInfo ? standard[nextTierInfo.key] : null;
  const diff = nextTierValue ? Math.ceil(nextTierValue - e1rmWeight) : null;
  const svgPath = getLiftSvgPath(liftType);
  return { standard, rating, emoji, physicallyActive, range, pct, nextTierInfo, diff, svgPath };
}

// Maps lift slug page names (from PAGE_CONFIG in [slug].js) to the internal BIG_FOUR names
// used as keys in the strength standards lookup.
const LIFT_SLUG_TO_BIG_FOUR = {
  "Squat": "Back Squat",
  "Bench Press": "Bench Press",
  "Deadlift": "Deadlift",
  "Strict Press": "Strict Press",
};

// Maps lift slug page names to the dedicated lift insights page URL.
const LIFT_SLUG_TO_INSIGHTS_URL = {
  "Squat": "/barbell-squat-insights",
  "Bench Press": "/barbell-bench-press-insights",
  "Deadlift": "/barbell-deadlift-insights",
  "Strict Press": "/barbell-strict-press-insights",
};

const NEXT_TIER = {
  "Physically Active": { name: "Beginner", key: "beginner" },
  Beginner: { name: "Intermediate", key: "intermediate" },
  Intermediate: { name: "Advanced", key: "advanced" },
  Advanced: { name: "Elite", key: "elite" },
  Elite: null,
};

/**
 * Strength standard bars showing where the current calculator E1RM sits on the
 * physically-active-to-elite spectrum, with inline athlete bio settings.
 * When forceLift is set, renders the target lift prominently first, then the other
 * three lifts subordinately below a "Compare to Big Four" label.
 * @param {Object} props
 * @param {number|string} props.reps - Number of reps performed.
 * @param {number|string} props.weight - Weight lifted.
 * @param {number} props.e1rmWeight - Computed estimated one-rep max.
 * @param {boolean} props.isMetric - Whether weight is in kg (true) or lb (false).
 * @param {string} props.e1rmFormula - Active E1RM formula name, included in copied text.
 * @param {string|null} [props.forceLift=null] - When set, features that lift prominently.
 */
function BigFourStrengthBars({ reps, weight, e1rmWeight, isMetric, e1rmFormula, forceLift = null }) {
  const { standards, age, sex, bodyWeight, bioDataIsDefault } = useAthleteBio();
  const { toast } = useToast();
  const unit = isMetric ? "kg" : "lb";

  const handleCopyLift = (liftType, rating, emoji, nextTierInfo, diff) => {
    const params = new URLSearchParams({
      [LOCAL_STORAGE_KEYS.REPS]: reps,
      [LOCAL_STORAGE_KEYS.WEIGHT]: weight,
      [LOCAL_STORAGE_KEYS.CALC_IS_METRIC]: isMetric,
      [LOCAL_STORAGE_KEYS.FORMULA]: e1rmFormula,
    });
    if (!bioDataIsDefault) {
      params.set(LOCAL_STORAGE_KEYS.ATHLETE_AGE, age);
      params.set(LOCAL_STORAGE_KEYS.ATHLETE_SEX, sex);
      params.set(LOCAL_STORAGE_KEYS.ATHLETE_BODY_WEIGHT, bodyWeight);
    }

    const lines = [
      `${liftType} ${reps}@${weight}${unit} indicates a one rep max of ${e1rmWeight}${unit}, using the ${e1rmFormula} algorithm.`,
    ];
    if (!bioDataIsDefault && bodyWeight > 0) {
      lines.push(`${(e1rmWeight / bodyWeight).toFixed(2)}× bodyweight`);
    }
    lines.push(`${liftType}: ${emoji} ${rating}`);
    if (nextTierInfo && diff) {
      lines.push(`Next: ${STRENGTH_LEVEL_EMOJI[nextTierInfo.name] ?? ""} ${nextTierInfo.name} — ${diff}${unit} away`);
    }
    lines.push(`Source: https://www.strengthjourneys.xyz/calculator?${params.toString()}`);

    const textarea = document.createElement("textarea");
    try {
      textarea.value = lines.join("\n");
      document.body.appendChild(textarea);
      textarea.select();
      const didCopy = document.execCommand("copy");
      if (!didCopy) {
        throw new Error("Copy command failed");
      }

      toast({ description: "Result copied to clipboard." });
      return true;
    } catch (error) {
      console.error(`Unable to copy ${liftType} result:`, error);
      toast({ variant: "destructive", title: "Could not copy result" });
      return false;
    } finally {
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }
  };

  const [openPopoverLift, setOpenPopoverLift] = useState(null);

  // For lift slug pages: resolve the slug lift name to the BIG_FOUR internal key.
  const featuredBigFourName = forceLift ? LIFT_SLUG_TO_BIG_FOUR[forceLift] : null;

  // getLiftBarData is defined at module level; bind the current standards + e1rmWeight.

  // Renders a single lift bar row. featured=true uses larger SVG and taller bar.
  const renderLiftRow = (liftType, data, featured = false) => {
    const { standard, rating, emoji, physicallyActive, range, pct, nextTierInfo, diff, svgPath } = data;
    return (
      <div key={liftType} className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
        {/* Row 1 on mobile: SVG + lift name + rating badge */}
        <div className="flex items-center gap-3">
          <Link href={bigFourURLs[liftType] ?? "#"} className="shrink-0 transition-opacity hover:opacity-50">
            {svgPath
              ? <img src={svgPath} alt={liftType} className={cn("object-contain opacity-90", featured ? "h-16 w-16" : "h-12 w-12")} />
              : <div className={featured ? "h-16 w-16" : "h-12 w-12"} />
            }
          </Link>
          <Link
            href={bigFourURLs[liftType] ?? "#"}
            className={cn("flex-1 text-muted-foreground transition-opacity hover:opacity-70 md:flex-none md:truncate", featured ? "text-sm font-medium md:w-28" : "text-xs md:w-24")}
          >
            {liftType}
          </Link>
          {/* Rating badge: mobile only (desktop shows it at the end) */}
          <span className={cn("shrink-0 text-right font-medium md:hidden", featured ? "text-sm" : "text-xs")}>
            {emoji} {rating}
          </span>
        </div>
        {/* Row 2 on mobile / middle col on desktop: bar + copy button */}
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <div
              className={cn("w-full rounded-full", featured ? "h-3" : "h-2")}
              style={{ background: "linear-gradient(to right, #EAB308, #86EFAC, #166534)" }}
            />
            {/* Tier dividers at beginner, intermediate, advanced */}
            {[standard.beginner, standard.intermediate, standard.advanced].map((val, i) => (
              <div
                key={i}
                className={cn("absolute top-0 w-px", featured ? "h-3" : "h-2")}
                style={{ left: `${((val - physicallyActive) / range) * 100}%`, backgroundColor: "var(--background)", opacity: 0.7 }}
              />
            ))}
            {/* e1rm marker — desktop: hover tooltip; mobile: tap popover */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 hidden h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm ring-1 ring-background md:block"
                  style={{ left: `${pct}%` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold">{liftType}</p>
                <p>{emoji} {rating} · {Math.round(e1rmWeight)}{unit}</p>
                {nextTierInfo ? (
                  <p className="text-muted-foreground">
                    Next: {STRENGTH_LEVEL_EMOJI[nextTierInfo.name] ?? ""} {nextTierInfo.name} — {diff}{unit} away
                  </p>
                ) : (
                  <p className="text-muted-foreground">Already at the top!</p>
                )}
              </TooltipContent>
            </Tooltip>
            <Popover
              open={openPopoverLift === liftType}
              onOpenChange={(o) => setOpenPopoverLift(o ? liftType : null)}
            >
              <PopoverTrigger asChild>
                <button
                  className="absolute top-1/2 flex h-6 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center md:hidden"
                  style={{ left: `${pct}%` }}
                  aria-label={`${liftType} strength level`}
                >
                  <div className="h-4 w-1.5 rounded-full bg-foreground shadow-sm ring-1 ring-background" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-auto p-2 text-xs">
                <p className="font-semibold">{liftType}</p>
                <p>{emoji} {rating} · {Math.round(e1rmWeight)}{unit}</p>
                {nextTierInfo ? (
                  <p className="text-muted-foreground">
                    Next: {STRENGTH_LEVEL_EMOJI[nextTierInfo.name] ?? ""} {nextTierInfo.name} — {diff}{unit} away
                  </p>
                ) : (
                  <p className="text-muted-foreground">Already at the top!</p>
                )}
              </PopoverContent>
            </Popover>
          </div>
          {/* Copy button — immediately after the bar on all screen sizes */}
          <LiftResultCopyButton
            liftType={liftType}
            onCopy={() => handleCopyLift(liftType, rating, emoji, nextTierInfo, diff)}
          />
        </div>
        {/* Rating at end — desktop only (shown in row 1 on mobile) */}
        <span className={cn("hidden w-32 shrink-0 text-right font-medium md:block", featured ? "text-sm" : "text-xs")}>
          {emoji} {rating}
        </span>
      </div>
    );
  };

  const featuredData = featuredBigFourName ? getLiftBarData(featuredBigFourName, standards, e1rmWeight) : null;
  const comparisonLifts = BIG_FOUR.filter((l) => l !== featuredBigFourName);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="border-t pt-3">
          <h2 className="text-center text-base font-semibold">
            <Link
              href={featuredBigFourName ? (bigFourURLs[featuredBigFourName] ?? "/strength-level-calculator") : "/strength-level-calculator"}
              className="transition-opacity hover:opacity-70"
            >
              {featuredBigFourName ? `${forceLift} Strength Level` : "Big Four Strength Levels"}
            </Link>
          </h2>
          <div className="mt-1 flex justify-center">
            <AthleteBioInlineSettings liftNote={`lifting ${e1rmWeight}${unit}${featuredBigFourName ? "" : " in each lift type"}`} />
          </div>
        </div>

        {/* Featured lift (lift slug pages only) */}
        {featuredData && (
          <div className="space-y-3">
            {renderLiftRow(featuredBigFourName, featuredData, true)}
          </div>
        )}

        {/* All four lifts on normal pages; lift slug pages show only the featured lift */}
        {!featuredBigFourName && (
          <div className="space-y-3">
            {comparisonLifts.map((liftType) => {
              const data = getLiftBarData(liftType, standards, e1rmWeight);
              if (!data) return null;
              return renderLiftRow(liftType, data, false);
            })}
          </div>
        )}

        <div className="border-t" />
      </div>
    </TooltipProvider>
  );
}

function LiftResultCopyButton({ liftType, onCopy }) {
  const router = useRouter();
  const { isSuccess, triggerSuccess } = useTransientSuccess();

  const handleClick = () => {
    const didCopy = onCopy?.();
    if (didCopy) {
      triggerSuccess();
    }
  };

  return (
    <ShareCopyButton
      iconOnly
      size="icon"
      label={`Copy ${liftType} result`}
      tooltip={`Copy e1rm estimate with ${liftType} rating included`}
      isSuccess={isSuccess}
      className="h-6 w-6 text-muted-foreground/50 hover:text-foreground"
      onPressAnalytics={() => gaTrackCalcShareCopy("lift_bar", { page: router.asPath, liftType })}
      onClick={handleClick}
    />
  );
}
