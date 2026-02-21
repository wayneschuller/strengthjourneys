import Head from "next/head";
import Link from "next/link";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

import { RelatedArticles } from "@/components/article-cards";

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
} from "@/components/page-header";

import { Checkbox } from "@/components/ui/checkbox";
import {
  interpolateStandardKG,
  LiftingStandardsKG,
} from "@/lib/lifting-standards-kg";

import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { devLog } from "@/lib/processing-utils";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";
import { ShareCopyButton } from "@/components/share-copy-button";
import { getLiftSvgPath } from "@/components/year-recap/lift-svg";
import { cn } from "@/lib/utils";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLocalStorage, useIsClient } from "usehooks-ts";

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useAthleteBio, getStrengthRatingForE1RM } from "@/hooks/use-athlete-biodata";
import { useStateFromQueryOrLocalStorage } from "../hooks/use-state-from-query-or-localStorage";
import { Calculator } from "lucide-react";
import { useLiftColors } from "@/hooks/use-lift-colors";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";

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

export default function E1RMCalculator({ relatedArticles }) {
  const title = "One Rep Max Calculator | Free tool, no login required";
  const description =
    "The worlds greatest one-rep max (ORM) calculator. With multiple algorithms, units, and personalized strength ratings. For strong fat thumbed atheletes. Mobile friendly UI.";
  const keywords =
    "One rep max calculator, orm calcaultor, ORM calculator, OneRM Calculator , 1RM estimation tool, Weightlifting max calculator, Powerlifting 1RM calculator, Max lift predictor, orm calculator, Strength level estimator, Gym performance calculator, e1RM calculator, Max weight calculator, Barbell load calculator";
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

function E1RMCalculatorMain({ relatedArticles }) {
  const router = useRouter();
  const { toast } = useToast();
  // Controls whether advanced UI/bio-based insights are shown
  const [isAdvancedAnalysis, setIsAdvancedAnalysis] = useLocalStorage(
    LOCAL_STORAGE_KEYS.E1RM_ADVANCED_ANALYSIS,
    false,
    { initializeWithValue: false },
  );
  const {
    age,
    setAge,
    isMetric,
    setIsMetric,
    sex,
    setSex,
    bodyWeight,
    setBodyWeight,
    standards,
    liftType,
    setLiftType,
  } = useAthleteBio({
    modifyURLQuery: true,
    isAdvancedAnalysis,
  });
  // Order matters: each includes the ones before it when syncing to URL.
  // Weight last so changing it syncs full state (reps, formula, unit type) → shareable URL.
  const [reps, setReps] = useStateFromQueryOrLocalStorage(
    LOCAL_STORAGE_KEYS.REPS,
    5,
    true,
    { [LOCAL_STORAGE_KEYS.CALC_IS_METRIC]: isMetric },
  ); // Will be a string
  const [e1rmFormula, setE1rmFormula] = useStateFromQueryOrLocalStorage(
    LOCAL_STORAGE_KEYS.FORMULA,
    "Brzycki",
    true,
    {
      [LOCAL_STORAGE_KEYS.CALC_IS_METRIC]: isMetric,
      [LOCAL_STORAGE_KEYS.REPS]: reps,
    },
  );
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
  const portraitRef = useRef(null);
  // Capture the resolved theme font at mount time so html2canvas gets the actual
  // font name (not just the unresolved --font-sans CSS variable)
  const [themeFontFamily, setThemeFontFamily] = useState("system-ui, sans-serif");
  useEffect(() => {
    setThemeFontFamily(window.getComputedStyle(document.body).fontFamily);
  }, []);
  const { getColor } = useLiftColors();

  // When opening a shared link: turn on advanced UI if URL has all four athlete params or explicit advanced flag
  useEffect(() => {
    if (router.isReady && router.query) {
      const {
        AthleteLiftType,
        AthleteSex,
        AthleteBodyWeight,
        AthleteAge,
        advanced,
      } = router.query;
      const hasAdvancedParams =
        AthleteLiftType && AthleteSex && AthleteBodyWeight && AthleteAge;
      const hasAdvancedFlag =
        advanced === "true" || advanced === true;
      if (hasAdvancedParams || hasAdvancedFlag) {
        setIsAdvancedAnalysis(true);
      }
    }
  }, [router.isReady, router.query, setIsAdvancedAnalysis]);

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

  // Add/remove advanced params and explicit "advanced" flag so shared URLs restore full state
  const updateAdvancedAnalysisQueryParams = (isEnabled) => {
    const { query } = router;
    const updatedQuery = { ...query };

    if (isEnabled) {
      updatedQuery.AthleteLiftType = liftType;
      updatedQuery.AthleteSex = sex;
      updatedQuery.AthleteBodyWeight = bodyWeight;
      updatedQuery.AthleteAge = age;
      updatedQuery[LOCAL_STORAGE_KEYS.CALC_IS_METRIC] = isMetric;
      updatedQuery.advanced = "true";
    } else {
      delete updatedQuery.AthleteLiftType;
      delete updatedQuery.AthleteSex;
      delete updatedQuery.AthleteBodyWeight;
      delete updatedQuery.AthleteAge;
      delete updatedQuery.advanced;
    }

    router.replace(
      {
        pathname: router.pathname,
        query: updatedQuery,
      },
      undefined,
      { shallow: true },
    );
  };

  const handleAdvancedAnalysisChange = (checked) => {
    setIsAdvancedAnalysis(checked);
    updateAdvancedAnalysisQueryParams(checked);
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

    if (isAdvancedAnalysis) {
      setTimeout(() => {
        setBodyWeight(newBodyWeight);
      }, 200); // Adjust delay as needed
    }
  };

  const handleCopyToClipboard = async () => {
    const encodeQueryParam = (param) => encodeURIComponent(param);

    const createQueryString = (params) => {
      return Object.entries(params)
        .map(
          ([key, value]) =>
            `${encodeQueryParam(key)}=${encodeQueryParam(value)}`,
        )
        .join("&");
    };

    let sentenceToCopy;

    const unit = getUnitSuffix(isMetric);

    const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);

    if (!isAdvancedAnalysis) {
      const queryString = createQueryString({
        reps: reps,
        weight: weight,
        calcIsMetric: isMetric,
        formula: e1rmFormula,
      });

      sentenceToCopy =
        `Lifting ${reps}@${weight}${unit} indicates a one rep max of ${e1rmWeight}${unit}, ` +
        `using the ${e1rmFormula} algorithm.\n` +
        `Source: https://strengthjourneys.xyz/calculator?${queryString}`;
    } else {
      const queryString = createQueryString({
        reps: reps,
        weight: weight,
        calcIsMetric: isMetric,
        formula: e1rmFormula,
        AthleteAge: age,
        AthleteBodyWeight: bodyWeight,
        AthleteSex: sex,
        AthleteLiftType: liftType,
        advanced: "true",
      });

      const bodyWeightMultiplier = (e1rmWeight / bodyWeight).toFixed(2);

      sentenceToCopy =
        `${liftType} ${reps}@${weight}${unit} indicates a one rep max of ${e1rmWeight}${unit}, ` +
        `using the ${e1rmFormula} algorithm.\n` +
        `${bodyWeightMultiplier}x bodyweight.\n` +
        `Lift Strength Rating: ${liftRating}\n` +
        `Source: https://strengthjourneys.xyz/calculator?${queryString}`;
    }

    // Create a temporary textarea element
    const textarea = document.createElement("textarea");
    // Set the value of the textarea to the sentence you want to copy
    textarea.value = sentenceToCopy;
    // Append the textarea to the document
    document.body.appendChild(textarea);
    // Select the text in the textarea
    textarea.select();

    // Execute the 'copy' command to copy the selected text to the clipboard
    // FIXME: deprecated function still works
    document.execCommand("copy");
    // Remove the temporary textarea
    document.body.removeChild(textarea);

    toast({
      description: "Result copied to clipboard.",
    });

    gaEvent(GA_EVENT_TAGS.CALC_SHARE_CLIPBOARD, { page: "/calculator", type: "text" });

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
              gaEvent(GA_EVENT_TAGS.CALC_SHARE_CLIPBOARD, { page: "/calculator", type: "image" });
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

  const sortedFormulae = getSortedFormulae(reps, weight);
  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const liftColor = isAdvancedAnalysis ? getColor(liftType) : null;
  const unit = getUnitSuffix(isMetric);

  let liftRating = "";

  if (isAdvancedAnalysis)
    liftRating = getStandardRatingString(
      age,
      bodyWeight,
      sex,
      reps,
      weight,
      liftType,
      isMetric,
      e1rmFormula,
    );

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Calculator}>
          One Rep Max Calculator
        </PageHeaderHeading>
        <PageHeaderDescription>
          Estimate your max single based on reps and weight. With optional
          strength level insights.
        </PageHeaderDescription>
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

          {/* Hidden portrait card — 9:16 for Instagram Stories image capture (360×640 → 1080×1920 at scale:3) */}
          <div
            ref={portraitRef}
            style={{
              position: "fixed",
              left: "-9999px",
              top: 0,
              width: "360px",
              height: "640px",
              fontFamily: themeFontFamily,
              ...(liftColor ? { borderTopColor: liftColor, borderTopWidth: 8 } : {}),
            }}
            className="relative flex flex-col items-center justify-center gap-6 rounded-xl border-4 bg-card px-8 py-10 text-card-foreground"
          >
            {/* Label + context */}
            <div className="w-full text-center" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>
                One Rep Max
              </div>
              {isAdvancedAnalysis && (
                <div style={{ fontSize: "26px", fontWeight: 700, color: liftColor || "inherit" }}>
                  {liftType}
                </div>
              )}
              <div style={{ fontSize: "20px", opacity: 0.6 }}>
                {reps} reps @ {weight}{isMetric ? "kg" : "lb"}
              </div>
            </div>

            {/* Hero number */}
            <div style={{ textAlign: "center", lineHeight: 1 }}>
              <div style={{ fontSize: "128px", fontWeight: 800, letterSpacing: "-0.04em", color: liftColor || "inherit" }}>
                {e1rmWeight}
              </div>
              <div style={{ fontSize: "40px", fontWeight: 700, opacity: 0.55, marginTop: "4px" }}>
                {isMetric ? "kg" : "lb"}
              </div>
            </div>

            {/* Strength rating (advanced only) */}
            {isAdvancedAnalysis && liftRating && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>
                  Strength Rating
                </div>
                <div style={{ fontSize: "30px", fontWeight: 700, marginTop: "4px" }}>{liftRating}</div>
              </div>
            )}

            {/* Formula */}
            <div style={{ fontSize: "15px", opacity: 0.45 }}>
              {e1rmFormula} formula
            </div>
          </div>

          {/* Two-column layout: hero + algo bar (left, primary), strength insights (right, secondary) */}
          <div className="my-6 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">

            {/* Left column: hero card + copy buttons */}
            <div className="flex flex-col items-center gap-3">
              <E1RMSummaryCard
                reps={reps}
                weight={weight}
                isMetric={isMetric}
                e1rmFormula={e1rmFormula}
                estimateE1RM={estimateE1RM}
                isAdvancedAnalysis={isAdvancedAnalysis}
                liftType={liftType}
                liftRating={liftRating}
                bodyWeight={bodyWeight}
              />
              <div className="flex gap-2">
                <ShareCopyButton label="Copy Text" onClick={handleCopyToClipboard} />
                <ShareCopyButton
                  label="Copy Image"
                  onClick={handleCopyImage}
                  isLoading={isCapturingImage}
                  disabled={isCapturingImage}
                  tooltip="Copy portrait image for Instagram Stories"
                />
              </div>
            </div>

            {/* Right column: Strength Insights (secondary) */}
            <Card className="border-muted/60">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="advanced"
                    checked={isAdvancedAnalysis}
                    onCheckedChange={handleAdvancedAnalysisChange}
                  />
                  <label
                    htmlFor="advanced"
                    className={cn(
                      "cursor-pointer select-none text-base font-semibold leading-none",
                      isAdvancedAnalysis ? "opacity-100" : "opacity-60",
                    )}
                  >
                    Strength Level Insights
                  </label>
                </div>
              </CardHeader>
              <AnimatePresence>
                {isAdvancedAnalysis && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <CardContent className="pt-0">
                      <OptionalAtheleBioData
                        isMetric={isMetric}
                        bodyWeight={bodyWeight}
                        setBodyWeight={setBodyWeight}
                        liftType={liftType}
                        setLiftType={setLiftType}
                        age={age}
                        setAge={setAge}
                        sex={sex}
                        setSex={setSex}
                      />
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>

          {/* Algorithm Range Bar — full width below both columns */}
          <div className="mb-6">
            <AlgorithmRangeBars
              reps={reps}
              weight={weight}
              isMetric={isMetric}
              e1rmFormula={e1rmFormula}
              setE1rmFormula={setE1rmFormula}
              liftColor={liftColor}
              isAdvancedAnalysis={isAdvancedAnalysis}
              standards={standards}
              liftType={liftType}
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
              isAdvancedAnalysis={isAdvancedAnalysis}
              liftType={liftType}
            />
            <PercentageTable
              key={`pct-${e1rmFormula}-${weight}-${reps}`}
              reps={reps}
              weight={weight}
              e1rmFormula={e1rmFormula}
              isMetric={isMetric}
              isAdvancedAnalysis={isAdvancedAnalysis}
              liftType={liftType}
            />
          </div>

        </CardContent>
      </Card>
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}

const liftSlugMap = {
  "Back Squat": "barbell-squat-insights",
  "Bench Press": "barbell-bench-press-insights",
  "Deadlift": "barbell-deadlift-insights",
  "Strict Press": "barbell-strict-press-insights",
};

const getSortedFormulae = (reps, weight) => {
  return e1rmFormulae.slice().sort((a, b) => {
    const e1rmA = estimateE1RM(reps, weight, a);
    const e1rmB = estimateE1RM(reps, weight, b);
    return e1rmA - e1rmB;
  });
};

// Hero card showing the e1rm result. Animates the number up/down with a spring
// when reps, weight, or formula changes. Shows lift type, bodyweight ratio, and
// strength rating when Strength Level Insights is enabled.
const E1RMSummaryCard = ({
  reps,
  weight,
  isMetric,
  e1rmFormula,
  estimateE1RM,
  isAdvancedAnalysis,
  liftRating,
  liftType,
  bodyWeight,
}) => {
  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const { getColor } = useLiftColors();
  const liftColor = isAdvancedAnalysis ? getColor(liftType) : null;

  // Animated count-up/count-down when e1rm changes
  const motionVal = useMotionValue(e1rmWeight);
  const springVal = useSpring(motionVal, { stiffness: 200, damping: 20 });
  const displayVal = useTransform(springVal, (v) => Math.round(v));

  useEffect(() => {
    motionVal.set(e1rmWeight);
  }, [e1rmWeight, motionVal]);

  return (
    <Card
      className="w-full max-w-md border-4"
      style={liftColor ? { borderTopColor: liftColor, borderTopWidth: 6 } : {}}
    >
      <CardHeader>
        <CardTitle className="text-center md:text-3xl">
          Estimated One Rep Max
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="text-center text-lg md:text-xl">
          {isAdvancedAnalysis && (
            <>
              <Link
                href={liftSlugMap[liftType] ? `/${liftSlugMap[liftType]}` : "#"}
                style={{
                  textDecoration: "underline",
                  textDecorationColor: liftColor,
                  textDecorationThickness: "2px",
                  textUnderlineOffset: "3px",
                }}
              >
                {liftType}
              </Link>{" "}
            </>
          )}
          {reps}@{weight}
          {isMetric ? "kg" : "lb"}
        </div>
        <div className="text-center text-5xl font-bold tracking-tight md:text-6xl xl:text-7xl">
          <motion.span className="tabular-nums">{displayVal}</motion.span>
          {isMetric ? "kg" : "lb"}
        </div>
        {isAdvancedAnalysis && (
          <div className="text-center text-lg">
            {(e1rmWeight / bodyWeight).toFixed(2)}x bodyweight
          </div>
        )}
        {isAdvancedAnalysis && liftRating && (
          <div>
            <Link
              href="/strength-level-calculator"
              className="flex flex-col justify-center gap-1 text-center align-middle text-xl hover:underline hover:underline-offset-4 xl:flex-row"
            >
              <div className="text-muted-foreground hover:text-muted-foreground/80">
                Your Strength Rating:
              </div>
              <div className="text-xl font-semibold">{liftRating}</div>
            </Link>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-muted-foreground">
        <div className="flex-1 text-center">
          Using the <strong>{e1rmFormula}</strong> formula
        </div>
      </CardFooter>
    </Card>
  );
};

// Two stacked horizontal tracks visualising the spread of e1rm estimates across
// all 7 algorithms. The overview bar shows where the cluster sits on the full
// 0–250kg/600lb scale (with optional strength-standards overlay when advanced).
// The detail bar zooms into the cluster so individual algorithm dots are
// clickable to switch the active formula.
function AlgorithmRangeBars({ reps, weight, isMetric, e1rmFormula, setE1rmFormula, liftColor, isAdvancedAnalysis, standards, liftType }) {
  const { getColor } = useLiftColors();
  const unit = isMetric ? "kg" : "lb";
  const accentColor = liftColor || getColor(liftType) || "hsl(var(--primary))";
  const standard = isAdvancedAnalysis ? standards?.[liftType] : null;

  // All 7 formulae sorted low→high by their estimate for this reps/weight
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

  // ── Overview track: fixed axis matching the weight slider ──────────────
  const overviewMax = isMetric ? 250 : 600;
  const overviewPct = (v) => Math.min(100, Math.max(0, (v / overviewMax) * 100));
  const overviewBandLeft = overviewPct(minVal);
  const overviewBandWidth = overviewPct(maxVal) - overviewBandLeft;

  // ── Detail track: zoomed into the algorithm cluster ────────────────────
  // Detail track: band always occupies a fixed visual fraction of the track.
  // The track range is back-calculated from the band width, so the band stays
  // the same size regardless of how spread the algorithms are. The axis labels
  // at the edges update to show the actual values at those positions.
  const BAND_LEFT_PCT = 10;
  const BAND_RIGHT_PCT = 90;
  const bandSpanPct = BAND_RIGHT_PCT - BAND_LEFT_PCT; // 70%
  const trackRange = range > 0
    ? range / (bandSpanPct / 100)
    : (isMetric ? 10 : 25); // fallback when all algorithms agree
  const detailMin = Math.max(0, minVal - (BAND_LEFT_PCT / 100) * trackRange);
  const detailMax = detailMin + trackRange;
  const detailPct = (v) => ((v - detailMin) / trackRange) * 100;
  const detailBandLeft = detailPct(minVal);
  const detailBandWidth = detailPct(maxVal) - detailBandLeft;

  // Alternating above/below rows for detail labels
  const aboveRaw = estimates.filter((_, i) => i % 2 === 0);
  const belowRaw = estimates.filter((_, i) => i % 2 !== 0);
  const dedupe = (arr) => {
    const seen = new Map();
    arr.forEach((e) => {
      if (!seen.has(e.value) || e.formula === e1rmFormula) seen.set(e.value, e);
    });
    return Array.from(seen.values());
  };
  const aboveLabels = dedupe(aboveRaw);
  const belowLabels = dedupe(belowRaw);

  const springConfig = { duration: 0 };
  const dotSpring = { duration: 0 };

  return (
    <div className="select-none">

      {/* ── Overview track (full scale, bracket notches at min/max) ── */}
      <div>
        <div className="relative" style={{ height: "24px" }}>
          {/* Base track */}
          <div className="absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-muted" />

          {/* Strength standards gradient overlay */}
          {standard?.elite && (
            <>
              <div
                style={{
                  position: "absolute",
                  left: `${overviewPct(standard.physicallyActive ?? 0)}%`,
                  width: `${overviewPct(standard.elite) - overviewPct(standard.physicallyActive ?? 0)}%`,
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: "12px",
                  background: `linear-gradient(to right, ${accentColor}18, ${accentColor}65)`,
                  borderRadius: "2px",
                }}
              />
              {[standard.beginner, standard.intermediate, standard.advanced, standard.elite].map((val, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${overviewPct(val)}%`,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "1px",
                    height: "16px",
                    backgroundColor: "hsl(var(--background))",
                    opacity: 0.7,
                  }}
                />
              ))}
            </>
          )}

          {/* Algorithm range band */}
          <motion.div
            style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", height: "12px", backgroundColor: accentColor, opacity: 0.35, borderRadius: "4px" }}
            animate={{ left: `${overviewBandLeft}%`, width: `${Math.max(overviewBandWidth, 0.3)}%` }}
            transition={springConfig}
          />
          {/* Left bracket notch */}
          <motion.div
            style={{ position: "absolute", top: "50%", transform: "translate(-50%, -50%)", width: "3px", height: "20px", borderRadius: "2px", backgroundColor: accentColor }}
            animate={{ left: `${overviewBandLeft}%` }}
            transition={springConfig}
          />
          {/* Right bracket notch */}
          <motion.div
            style={{ position: "absolute", top: "50%", transform: "translate(-50%, -50%)", width: "3px", height: "20px", borderRadius: "2px", backgroundColor: accentColor }}
            animate={{ left: `${overviewBandLeft + Math.max(overviewBandWidth, 0.3)}%` }}
            transition={springConfig}
          />
        </div>

        {/* Tier labels (when advanced) */}
        {standard?.elite && (
          <div className="relative mt-0.5" style={{ height: "14px" }}>
            {[
              { label: "Active", value: standard.physicallyActive ?? 0 },
              { label: "Beginner", value: standard.beginner },
              { label: "Intermediate", value: standard.intermediate },
              { label: "Advanced", value: standard.advanced },
              { label: "Elite", value: standard.elite },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{ left: `${overviewPct(value)}%` }}
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground/80"
              >
                {label}
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 flex justify-between text-sm text-foreground/90">
          <span>0{unit}</span>
          <span>{overviewMax}{unit}</span>
        </div>
      </div>

      {/* Dashed connector lines from overview notches to detail band edges */}
      <svg
        aria-hidden="true"
        className="w-full pointer-events-none"
        style={{ height: "20px", display: "block" }}
      >
        <line
          x1={`${overviewBandLeft}%`} y1="0"
          x2={`${detailBandLeft}%`} y2="100%"
          stroke={accentColor} strokeDasharray="4 3" strokeOpacity="0.45" strokeWidth="1.5"
        />
        <line
          x1={`${overviewBandLeft + Math.max(overviewBandWidth, 0.3)}%`} y1="0"
          x2={`${detailBandLeft + detailBandWidth}%`} y2="100%"
          stroke={accentColor} strokeDasharray="4 3" strokeOpacity="0.45" strokeWidth="1.5"
        />
      </svg>

      {/* ── Detail track (zoomed, with labels) ── */}
      <div>
        {/* Labels above */}
        <div className="relative mb-1" style={{ height: "20px" }}>
          {aboveLabels.map(({ formula, value }) => (
            <button
              key={formula}
              onClick={() => setE1rmFormula(formula)}
              style={{ left: `${detailPct(value)}%` }}
              className={cn(
                "absolute bottom-0 -translate-x-1/2 cursor-pointer whitespace-nowrap text-xs leading-none transition-colors",
                formula === e1rmFormula
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground/80 hover:text-foreground",
              )}
            >
              {formula}
            </button>
          ))}
        </div>

        {/* Track */}
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
              <motion.button
                key={formula}
                onClick={() => setE1rmFormula(formula)}
                animate={{
                  width: isSelected ? "14px" : "10px",
                  height: isSelected ? "14px" : "10px",
                  opacity: isSelected ? 1 : 0.45,
                }}
                transition={dotSpring}
                style={{
                  position: "absolute",
                  left: `${detailPct(value)}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  borderRadius: "9999px",
                  backgroundColor: isSelected ? accentColor : "hsl(var(--muted-foreground))",
                  zIndex: isSelected ? 10 : 1,
                  boxShadow: isSelected ? `0 0 0 3px ${accentColor}30` : "none",
                  cursor: "pointer",
                  border: "none",
                }}
              />
            );
          })}
        </div>

        {/* Labels below */}
        <div className="relative mt-1" style={{ height: "20px" }}>
          {belowLabels.map(({ formula, value }) => (
            <button
              key={formula}
              onClick={() => setE1rmFormula(formula)}
              style={{ left: `${detailPct(value)}%` }}
              className={cn(
                "absolute top-0 -translate-x-1/2 cursor-pointer whitespace-nowrap text-xs leading-none transition-colors",
                formula === e1rmFormula
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground/80 hover:text-foreground",
              )}
            >
              {formula}
            </button>
          ))}
        </div>

        {/* Detail axis endpoints */}
        <div className="mt-2 flex justify-between text-sm text-foreground/90">
          <span>{Math.round(detailMin)}{unit}</span>
          <span>{Math.round(detailMax)}{unit}</span>
        </div>
      </div>

    </div>
  );
}

// Table projecting the estimated best lift at each rep count from 1–10RM,
// derived from the current e1rm via estimateWeightForReps. Highlights the
// row matching the user's current rep input. Re-mounts (re-animates) whenever
// the formula, weight, or reps change via the parent key prop.
function RepRangeTable({ reps, weight, e1rmFormula, isMetric, isAdvancedAnalysis, liftType }) {
  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const { getColor } = useLiftColors();
  const liftColor = isAdvancedAnalysis ? getColor(liftType) : null;
  const unit = isMetric ? "kg" : "lb";
  const currentReps = Number(reps);

  const rows = Array.from({ length: 10 }, (_, i) => {
    const r = i + 1;
    return { reps: r, weight: estimateWeightForReps(e1rmWeight, r, e1rmFormula) };
  });

  return (
    <div>
      <h3 className="mb-1 text-base font-semibold">Rep Max Projections</h3>
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
                  transition={{ delay: i * 0.04, ease: "easeOut" }}
                  className={cn(
                    "border-b last:border-b-0",
                    isCurrentReps ? "font-semibold" : "",
                    isCurrentReps && !liftColor ? "bg-accent" : "",
                  )}
                  style={
                    isCurrentReps && liftColor
                      ? { backgroundColor: liftColor + "20" }
                      : {}
                  }
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


// Table showing common training intensities from 100% down to 50% of e1rm
// in 5% steps — useful for bro-programming percentage-based templates.
// Sits beside RepRangeTable in a two-column grid on md+ screens.
function PercentageTable({ reps, weight, e1rmFormula, isMetric, isAdvancedAnalysis, liftType }) {
  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const { getColor } = useLiftColors();
  const liftColor = isAdvancedAnalysis ? getColor(liftType) : null;
  const unit = isMetric ? "kg" : "lb";

  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
  const rows = percentages.map((pct) => ({
    pct,
    weight: Math.round((e1rmWeight * pct) / 100),
  }));

  return (
    <div>
      <h3 className="mb-1 text-base font-semibold">Percentage Calculator</h3>
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
                    isMax ? "font-semibold" : "",
                    isMax && !liftColor ? "bg-accent" : "",
                  )}
                  style={isMax && liftColor ? { backgroundColor: liftColor + "20" } : {}}
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


// Expandable panel of athlete bio inputs (age, sex, bodyweight, lift type)
// used by Strength Level Insights. Rendered inside an AnimatePresence collapse
// in the right-column card. Lift type uses a 2x2 SVG grid for the Big Four.
function OptionalAtheleBioData({
  isMetric,
  bodyWeight,
  setBodyWeight,
  liftType,
  setLiftType,
  age,
  setAge,
  sex,
  setSex,
}) {
  const { getColor } = useLiftColors();

  return (
    <div className="flex flex-col gap-4 px-4">
      <div>
        <div className="flex flex-row gap-2">
          <Label>Age: {age}</Label>
        </div>
        <Slider
          min={13}
          max={100}
          step={1}
          value={[age]}
          onValueChange={(values) => setAge(values[0])}
          className="mt-2 flex-1"
          aria-label="Age"
        />
      </div>
      <div className="mt-1 flex flex-row gap-4">
        <Label>Sex: </Label>
        <RadioGroup
          value={sex}
          onValueChange={setSex}
          // orientation="horizontal"
          className="flex space-x-4" // Really makes it horizontal
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="male" id="male" />
            <Label htmlFor="male">Male</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="female" id="female" />
            <Label htmlFor="female">Female</Label>
          </div>
        </RadioGroup>
      </div>
      <div>
        <div className="flex flex-row gap-2">
          <Label>
            Bodyweight: {bodyWeight}
            {isMetric ? "kg" : "lb"}
          </Label>
        </div>
        <Slider
          min={isMetric ? 40 : 100}
          max={isMetric ? 230 : 500}
          step={1}
          value={[bodyWeight]}
          onValueChange={(values) => setBodyWeight(values[0])}
          className="mt-2 flex-1"
          aria-label={`Weight in ${isMetric ? "kilograms" : "pounds"}`}
        />
      </div>
      <div>
        <Label className="mb-2 block text-sm">Lift Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {["Back Squat", "Bench Press", "Deadlift", "Strict Press"].map((lift) => {
            const isSelected = liftType === lift;
            const color = getColor(lift);
            const svgPath = getLiftSvgPath(lift);
            return (
              <button
                key={lift}
                type="button"
                onClick={() => setLiftType(lift)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors cursor-pointer",
                  isSelected ? "border-2" : "border-muted hover:border-muted-foreground/40",
                )}
                style={isSelected ? { borderColor: color, backgroundColor: color + "18" } : {}}
              >
                {svgPath && (
                  <img src={svgPath} alt={lift} className="h-12 w-12 object-contain" />
                )}
                <span className={cn(
                  "text-xs leading-tight",
                  isSelected ? "font-semibold" : "text-muted-foreground",
                )}>
                  {lift}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const getStandardRatingString = (
  age,
  bodyWeight,
  sex,
  reps,
  weight,
  liftType,
  isMetric,
  e1rmFormula,
) => {
  const bodyWeightKG = isMetric ? bodyWeight : Math.round(bodyWeight / 2.204);

  // FIXME: We don't need to call this, we should be getting the standard from the custom AthelteBioData hook
  let standard = interpolateStandardKG(
    age,
    bodyWeightKG,
    sex,
    liftType,
    LiftingStandardsKG,
  );

  // If the user wants lb units we should convert back into lb units now
  if (!isMetric && standard) {
    standard = {
      physicallyActive: Math.round(standard.physicallyActive * 2.204),
      beginner: Math.round(standard.beginner * 2.204),
      intermediate: Math.round(standard.intermediate * 2.204),
      advanced: Math.round(standard.advanced * 2.204),
      elite: Math.round(standard.elite * 2.204),
    };
  }

  const oneRepMax = estimateE1RM(reps, weight, e1rmFormula);
  return standard ? getStrengthRatingForE1RM(oneRepMax, standard) : undefined;
};
