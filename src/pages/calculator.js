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

          {/* Hero: E1RM Result Card — centered, full visual weight */}
          <div className="my-8 flex flex-col items-center gap-3">
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

          {/* Algorithm Range — full width, directly below hero */}
          <div className="mb-6">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Algorithm Range
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {e1rmFormula}: {e1rmWeight}{unit}
              </span>
            </div>
            <AlgorithmRangeBar
              reps={reps}
              weight={weight}
              isMetric={isMetric}
              e1rmFormula={e1rmFormula}
              setE1rmFormula={setE1rmFormula}
              liftColor={liftColor}
            />
          </div>

          {/* Strength Analysis */}
          <Card className="mb-8">
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

          {/* Rep Range Projection Table — re-animates when formula/weight/reps changes */}
          <RepRangeTable
            key={`${e1rmFormula}-${weight}-${reps}`}
            reps={reps}
            weight={weight}
            e1rmFormula={e1rmFormula}
            isMetric={isMetric}
            isAdvancedAnalysis={isAdvancedAnalysis}
            liftType={liftType}
          />

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
      className="w-full max-w-sm border-4"
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

function AlgorithmRangeBar({ reps, weight, isMetric, e1rmFormula, setE1rmFormula, liftColor }) {
  const unit = isMetric ? "kg" : "lb";
  const accentColor = liftColor || "hsl(var(--primary))";

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
  // Extra padding so labels at the edges don't get clipped
  const pad = Math.max(range * 0.55, isMetric ? 3 : 5);
  const axisMin = Math.max(0, minVal - pad);
  const axisMax = maxVal + pad;
  const axisRange = axisMax - axisMin;
  const pct = (v) => ((v - axisMin) / axisRange) * 100;

  const bandLeft = pct(minVal);
  const bandWidth = pct(maxVal) - bandLeft;

  // Alternating above/below rows — de-dupe at identical values, preferring selected formula
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

  return (
    <div className="select-none px-1">
      {/* Labels above track */}
      <div className="relative mb-1" style={{ height: "20px" }}>
        {aboveLabels.map(({ formula, value }) => (
          <button
            key={formula}
            onClick={() => setE1rmFormula(formula)}
            style={{ left: `${pct(value)}%` }}
            className={cn(
              "absolute bottom-0 -translate-x-1/2 cursor-pointer whitespace-nowrap text-[10px] leading-none transition-colors",
              formula === e1rmFormula
                ? "font-semibold text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
          >
            {formula}
          </button>
        ))}
      </div>

      {/* Track with animated band + clickable dots */}
      <div className="relative" style={{ height: "16px" }}>
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
        <motion.div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: accentColor, opacity: 0.4 }}
          animate={{ left: `${bandLeft}%`, width: `${Math.max(bandWidth, 0.5)}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{
                position: "absolute",
                left: `${pct(value)}%`,
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

      {/* Labels below track */}
      <div className="relative mt-1" style={{ height: "20px" }}>
        {belowLabels.map(({ formula, value }) => (
          <button
            key={formula}
            onClick={() => setE1rmFormula(formula)}
            style={{ left: `${pct(value)}%` }}
            className={cn(
              "absolute top-0 -translate-x-1/2 cursor-pointer whitespace-nowrap text-[10px] leading-none transition-colors",
              formula === e1rmFormula
                ? "font-semibold text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
          >
            {formula}
          </button>
        ))}
      </div>

      {/* Axis: min / max values */}
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground/40">
        <span>{minVal}{unit}</span>
        <span>{maxVal}{unit}</span>
      </div>
    </div>
  );
}

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
    <div className="mb-8">
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
  const uniqueLiftNames = Array.from(
    new Set(LiftingStandardsKG.map((item) => item.liftType)),
  );
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
        <Label>Lift Type:</Label>
        <RadioGroup value={liftType} onValueChange={setLiftType}>
          {uniqueLiftNames.map((lift) => (
            <div key={lift} className="flex items-center space-x-2">
              <RadioGroupItem value={lift} id={lift} />
              <Label htmlFor={lift}>
                {liftSlugMap[lift] ? (
                  <Link
                    href={`/${liftSlugMap[lift]}`}
                    style={{
                      textDecoration: "underline",
                      textDecorationColor: getColor(lift),
                      textDecorationThickness: "2px",
                      textUnderlineOffset: "3px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lift}
                  </Link>
                ) : (
                  lift
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>
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
