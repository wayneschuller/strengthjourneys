import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

import { RelatedArticles } from "@/components/article-cards";

import { estimateE1RM } from "@/lib/estimate-e1rm";
import { Button } from "@/components/ui/button";
import { UnitChooser } from "@/components/unit-type-chooser";
import {
  Card,
  CardContent,
  CardDescription,
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
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { cn } from "@/lib/utils";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLocalStorage, useIsClient } from "usehooks-ts";

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useAthleteBio, getStrengthRatingForE1RM } from "@/hooks/use-athlete-biodata";
import { useStateFromQueryOrLocalStorage } from "../hooks/use-state-from-query-or-localStorage";
import { Calculator } from "lucide-react";
import { useLiftColors } from "@/hooks/use-lift-colors";

const getUnitSuffix = (isMetric) => (isMetric ? "kg" : "lb");

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { E1RMFormulaRadioGroup } from "@/components/e1rm-formula-radio-group";

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
  const [parent] = useAutoAnimate(/* optional config */);
  const isClient = useIsClient();

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

    gaEvent(GA_EVENT_TAGS.CALC_SHARE_CLIPBOARD, { page: "/calculator" });

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

  const sortedFormulae = getSortedFormulae(reps, weight);

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

          <div className="my-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="order-3 lg:order-1" ref={parent}>
              <div className="mb-4 flex flex-row gap-2">
                <Checkbox
                  id="advanced"
                  checked={isAdvancedAnalysis}
                  // onCheckedChange={setIsAdvancedAnalysis}
                  onCheckedChange={handleAdvancedAnalysisChange}
                />
                <label
                  htmlFor="advanced"
                  className={cn(
                    "text-sm font-medium leading-none",
                    isAdvancedAnalysis ? "opacity-100" : "opacity-50",
                  )}
                >
                  Strength Level Insights
                </label>
              </div>
              {isAdvancedAnalysis && (
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
              )}
            </div>
            <div className="order-1 place-self-center lg:order-2">
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
            </div>
            <div className="order-2 place-self-center md:pl-4 lg:order-3 lg:place-self-auto">
              <E1RMFormulaRadioGroup
                formulae={sortedFormulae}
                e1rmFormula={e1rmFormula}
                setE1rmFormula={setE1rmFormula}
                reps={reps}
                weight={weight}
                isMetric={isMetric}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-4">
            <ShareCopyButton label="Copy to clipboard" onClick={handleCopyToClipboard} />
          </div>

          {/* <h4 className="mt-10 scroll-m-20 text-xl font-semibold tracking-tight">
            Citations and background for these exercise science formulae are
            found in this{" "}
            <a
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              href="https://en.wikipedia.org/wiki/One-repetition_maximum"
              target="_blank"
            >
              Wikipedia article
            </a>
          </h4> */}
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

  return (
    <Card
      className="border-4"
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
          {e1rmWeight}
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

  let liftRating;

  const oneRepMax = estimateE1RM(reps, weight, e1rmFormula);
  return standard ? getStrengthRatingForE1RM(oneRepMax, standard) : undefined;
};
