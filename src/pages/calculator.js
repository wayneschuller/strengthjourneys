import Head from "next/head";
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

import { AthleteBioQuickSettings } from "@/components/athlete-bio-quick-settings";

import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { devLog } from "@/lib/processing-utils";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";
import { ShareCopyButton } from "@/components/share-copy-button";
import { getLiftSvgPath } from "@/components/year-recap/lift-svg";
import { cn } from "@/lib/utils";

import { useLocalStorage, useIsClient } from "usehooks-ts";

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useAthleteBio, getStrengthRatingForE1RM, STRENGTH_LEVEL_EMOJI } from "@/hooks/use-athlete-biodata";
import { useStateFromQueryOrLocalStorage } from "../hooks/use-state-from-query-or-localStorage";
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

function E1RMCalculatorMain({ relatedArticles }) {
  const router = useRouter();
  const { toast } = useToast();
  const {
    isMetric,
    setIsMetric,
    bodyWeight,
    setBodyWeight,
  } = useAthleteBio({ modifyURLQuery: true });
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
    const encodeQueryParam = (param) => encodeURIComponent(param);

    const createQueryString = (params) => {
      return Object.entries(params)
        .map(
          ([key, value]) =>
            `${encodeQueryParam(key)}=${encodeQueryParam(value)}`,
        )
        .join("&");
    };

    const unit = getUnitSuffix(isMetric);
    const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);

    const queryString = createQueryString({
      reps: reps,
      weight: weight,
      calcIsMetric: isMetric,
      formula: e1rmFormula,
    });

    const sentenceToCopy =
      `Lifting ${reps}@${weight}${unit} indicates a one rep max of ${e1rmWeight}${unit}, ` +
      `using the ${e1rmFormula} algorithm.\n` +
      `Source: https://strengthjourneys.xyz/calculator?${queryString}`;

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

  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const unit = getUnitSuffix(isMetric);

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Calculator}>
          One Rep Max Calculator
        </PageHeaderHeading>
        <PageHeaderDescription>
          Enter reps and weight to estimate your one-rep max across 7 proven
          formulas. See rep-max projections, percentage training guides, and
          personalized Big Four strength levels by age, sex, and bodyweight.
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
            <BigFourStrengthBars e1rmWeight={e1rmWeight} isMetric={isMetric} />
          </div>

          {/* Rep Range + Percentage Tables side by side */}
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <RepRangeTable
              key={`${e1rmFormula}-${weight}-${reps}`}
              reps={reps}
              weight={weight}
              e1rmFormula={e1rmFormula}
              isMetric={isMetric}
            />
            <PercentageTable
              key={`pct-${e1rmFormula}-${weight}-${reps}`}
              reps={reps}
              weight={weight}
              e1rmFormula={e1rmFormula}
              isMetric={isMetric}
            />
          </div>

        </CardContent>
      </Card>
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}


// Hero card — just the animated e1rm number, set/formula context, and bodyweight ratio.
const E1RMSummaryCard = ({ reps, weight, isMetric, e1rmFormula, estimateE1RM }) => {
  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const { bodyWeight } = useAthleteBio();

  const motionVal = useMotionValue(e1rmWeight);
  const springVal = useSpring(motionVal, { stiffness: 200, damping: 20 });
  const displayVal = useTransform(springVal, (v) => Math.round(v));

  useEffect(() => {
    motionVal.set(e1rmWeight);
  }, [e1rmWeight, motionVal]);

  return (
    <Card className="w-full max-w-md border-4">
      <CardHeader>
        <CardTitle className="text-center md:text-3xl">
          Estimated One Rep Max
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="text-center text-lg md:text-xl text-muted-foreground">
          {reps}@{weight}{isMetric ? "kg" : "lb"}
        </div>
        <div className="text-center text-5xl font-bold tracking-tight md:text-6xl xl:text-7xl">
          <motion.span className="tabular-nums">{displayVal}</motion.span>
          {isMetric ? "kg" : "lb"}
        </div>
        {bodyWeight > 0 && (
          <div className="mt-1 text-center text-sm text-muted-foreground">
            {(e1rmWeight / bodyWeight).toFixed(2)}× bodyweight
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

// Zoomed horizontal track showing the spread of all 7 e1rm algorithm estimates.
// Dots are clickable to switch the active formula. The band always occupies a
// fixed visual fraction of the track so the spread is legible regardless of
// how close the algorithms agree.
function AlgorithmRangeBars({ reps, weight, isMetric, e1rmFormula, setE1rmFormula }) {
  const unit = isMetric ? "kg" : "lb";
  const accentColor = "var(--primary)";

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

  // Merge labels that would overlap on the detail track (sorted low→high, same order as estimates).
  // Groups are merged greedily: if a label falls within the threshold of the previous group's
  // centre, it joins that group and the centre is recomputed as the average of all members.
  const LABEL_MERGE_THRESHOLD_PCT = 8;
  const mergedLabels = [];
  for (const { formula, value } of estimates) {
    const pct = detailPct(value);
    const last = mergedLabels[mergedLabels.length - 1];
    if (last && pct - last.pct < LABEL_MERGE_THRESHOLD_PCT) {
      last.formulas.push(formula);
      last.values.push(value);
      const memberPcts = last.formulas.map(
        (f) => detailPct(estimates.find((e) => e.formula === f).value),
      );
      last.pct = memberPcts.reduce((a, b) => a + b, 0) / memberPcts.length;
    } else {
      mergedLabels.push({ formulas: [formula], pct, values: [value] });
    }
  }

  const springConfig = { duration: 0 };
  const dotSpring = { duration: 0 };

  return (
    <div className="select-none">
      {/* ── Detail track: zoomed into the algorithm cluster ── */}
      <div>
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
                  backgroundColor: isSelected ? accentColor : "var(--muted-foreground)",
                  zIndex: isSelected ? 10 : 1,
                  boxShadow: isSelected ? `0 0 0 3px ${accentColor}30` : "none",
                  cursor: "pointer",
                  border: "none",
                }}
              />
            );
          })}
        </div>

        {/* Labels below — all formulas, merged when too close */}
        <div className="relative mt-1" style={{ height: "20px" }}>
          {mergedLabels.map((group, groupIndex) => {
            const isFirst = groupIndex === 0;
            const isLast = groupIndex === mergedLabels.length - 1;
            const minV = Math.min(...group.values);
            const maxV = Math.max(...group.values);
            const weightLabel = minV === maxV ? `${minV}${unit}` : `${minV}–${maxV}${unit}`;
            // Pin first label to left edge, last to right edge, others centred
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
                  "absolute top-0 whitespace-nowrap text-xs leading-none",
                  translateClass,
                )}
              >
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
                ))}{" "}
                <span className="opacity-60">{weightLabel}</span>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
}

// Table projecting the estimated best lift at each rep count from 1–10RM,
// derived from the current e1rm via estimateWeightForReps. Highlights the
// row matching the user's current rep input. Re-mounts (re-animates) whenever
// the formula, weight, or reps change via the parent key prop.
function RepRangeTable({ reps, weight, e1rmFormula, isMetric }) {
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
      <h2 className="mb-1 text-base font-semibold">Rep Max Projections</h2>
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


// Table showing common training intensities from 100% down to 50% of e1rm
// in 5% steps — useful for bro-programming percentage-based templates.
// Sits beside RepRangeTable in a two-column grid on md+ screens.
function PercentageTable({ reps, weight, e1rmFormula, isMetric }) {
  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);
  const unit = isMetric ? "kg" : "lb";

  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
  const rows = percentages.map((pct) => ({
    pct,
    weight: Math.round((e1rmWeight * pct) / 100),
  }));

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold">Percentage Calculator</h2>
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

const NEXT_TIER = {
  "Physically Active": { name: "Beginner", key: "beginner" },
  Beginner: { name: "Intermediate", key: "intermediate" },
  Intermediate: { name: "Advanced", key: "advanced" },
  Advanced: { name: "Elite", key: "elite" },
  Elite: null,
};

// Four compact strength standard bars — one per Big Four lift — showing where
// the current calculator e1rm sits on the physicallyActive→elite spectrum.
// Bio data (age, bodyWeight, sex) comes from the global hook; defaults to 30yo
// 200lb male if the user hasn't set a profile. The AthleteBioQuickSettings
// dropdown lets them update it inline without leaving the page.
function BigFourStrengthBars({ e1rmWeight, isMetric }) {
  const { standards } = useAthleteBio();
  const unit = isMetric ? "kg" : "lb";

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="border-t pt-3">
          <h2 className="text-center text-base font-semibold">Big Four Strength Levels</h2>
          <div className="mt-1 flex justify-center">
            <AthleteBioQuickSettings variant="inline" />
          </div>
        </div>

        <div className="space-y-3">
          {BIG_FOUR.map((liftType) => {
            const standard = standards?.[liftType];
            if (!standard?.elite) return null;

            const rating = getStrengthRatingForE1RM(e1rmWeight, standard);
            const emoji = STRENGTH_LEVEL_EMOJI[rating] ?? "";
            const { physicallyActive, elite } = standard;
            const range = elite - physicallyActive;
            // Clamp marker to 2–98% so it's always visible even at extremes
            const pct = range > 0
              ? Math.min(98, Math.max(2, ((e1rmWeight - physicallyActive) / range) * 100))
              : 50;

            const nextTierInfo = NEXT_TIER[rating];
            const nextTierValue = nextTierInfo ? standard[nextTierInfo.key] : null;
            const diff = nextTierValue ? Math.ceil(nextTierValue - e1rmWeight) : null;

            // Resolve lift name -> static SVG asset (returns null when no mapping exists).
            const svgPath = getLiftSvgPath(liftType);

            return (
              <div key={liftType} className="flex items-center gap-3">
                {svgPath
                  ? <img src={svgPath} alt={liftType} className="h-12 w-12 shrink-0 object-contain opacity-75" />
                  // Keep the same footprint when an icon is missing so labels/bars stay aligned.
                  : <div className="h-12 w-12 shrink-0" />
                }
                <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{liftType}</span>
                <div className="relative flex-1">
                  <div
                    className="h-2 w-full rounded-full"
                    style={{ background: "linear-gradient(to right, #EAB308, #86EFAC, #166534)" }}
                  />
                  {/* Tier dividers at beginner, intermediate, advanced */}
                  {[standard.beginner, standard.intermediate, standard.advanced].map((val, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-2 w-px"
                      style={{ left: `${((val - physicallyActive) / range) * 100}%`, backgroundColor: "var(--background)", opacity: 0.7 }}
                    />
                  ))}
                  {/* e1rm marker with tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm ring-1 ring-background"
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
                </div>
                <span className="w-32 shrink-0 text-right text-xs font-medium">
                  {emoji} {rating}
                </span>
              </div>
            );
          })}
        </div>

        <div className="border-t" />
      </div>
    </TooltipProvider>
  );
}
