import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

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

import { Checkbox } from "@/components/ui/checkbox";
import {
  interpolateStandard,
  LiftingStandardsKG,
} from "@/lib/lifting-standards-kg";

import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { devLog } from "@/lib/processing-utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { cn } from "@/lib/utils";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLocalStorage, useIsClient } from "usehooks-ts";

import { useStateFromQueryOrLocalStorage } from "../lib/use-state-from-query-or-localStorage";

const getUnitSuffix = (isMetric) => (isMetric ? "kg" : "lb");

export default function E1RMCalculator() {
  const router = useRouter();
  const { toast } = useToast();
  const [reps, setReps] = useStateFromQueryOrLocalStorage("reps", 5); // Will be a string
  const [weight, setWeight] = useStateFromQueryOrLocalStorage("weight", 225); // Will be a string
  const [isMetric, setIsMetric] = useStateFromQueryOrLocalStorage(
    "calcIsMetric",
    false,
  ); // Will be a string
  const [e1rmFormula, setE1rmFormula] = useStateFromQueryOrLocalStorage(
    "formula",
    "Brzycki",
  );
  const [isAdvancedAnalysis, setIsAdvancedAnalysis] = useLocalStorage(
    "SJ_E1RMAdvancedAnalysis",
    false,
  );
  const [bodyWeight, setBodyWeight] = useStateFromQueryOrLocalStorage(
    "AtheleteBodyWeight",
    200,
  );
  const [liftType, setLiftType] = useStateFromQueryOrLocalStorage(
    "AthleteLiftType",
    "",
  );
  const [age, setAge] = useStateFromQueryOrLocalStorage("AthleteAge", 30);
  const [sex, setSex] = useStateFromQueryOrLocalStorage("AthleteSex", "male");
  const [parent] = useAutoAnimate(/* optional config */);
  const isClient = useIsClient();

  useEffect(() => {
    if (router.isReady) {
      const { AthleteLiftType, AthleteSex, AtheleteBodyWeight, AthleteAge } =
        router.query;
      if (AthleteLiftType && AthleteSex && AtheleteBodyWeight && AthleteAge) {
        setIsAdvancedAnalysis(true);
      }
    }
  }, [router.isReady, router.query]);

  if (!isClient) return null; // Bypass Next.js hydration drama

  // FIXME: put inline
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
    let newWeight;
    let newBodyWeight;

    // devLog(`toggle is metric running...`);

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

    setWeight(newWeight);
    setBodyWeight(newBodyWeight);
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

    if (typeof window !== "undefined") {
      window.gtag("event", "calc_share_clipboard");
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
    <>
      <Head>
        <title>
          One Rep Max Calculator | Advanced Multi-Algorithm E1RM Calculator for
          Strength Athletes
        </title>
        <meta
          key="description"
          name="description"
          content="Discover your true strength level with our free, personalized calculator. Compare your lifts to standards based on age, gender, and bodyweight. Perfect for powerlifters, weightlifters, and strength athletes of all levels. Get instant results for multiple lifts and track your progress from beginner to elite. Start optimizing your training today with Strength Journeys."
        />
        <meta
          name="keywords"
          content="One rep max calculator, Barbell strength calculator, 1RM estimation tool, Weightlifting max calculator, Powerlifting 1RM calculator, Max lift predictor, Barbell training tool, Strength level estimator, Gym performance calculator, e1RM calculator, Max weight calculator, Barbell load calculator"
        />

        <link
          rel="canonical"
          href="https://www.strengthjourneys.xyz/calculator"
        />
        <meta name="robots" content="index, follow" />

        <meta
          property="og:title"
          content="One Rep Max Calculator | Advanced Multi-Algorithm E1RM Calculator for Strength Athletes"
        />
        <meta
          property="og:description"
          content="Discover your true strength level with our free, personalized calculator. Compare your lifts to standards based on age, gender, and bodyweight. Perfect for powerlifters, weightlifters, and strength athletes of all levels. Get instant results for multiple lifts and track your progress from beginner to elite. Start optimizing your training today with Strength Journeys."
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://www.strengthjourneys.xyz/calculator"
        />
        <meta
          property="og:image"
          content="https://www.strengthjourneys.xyz/strength_journeys_one_rep_max_calculator_og.png"
        />
      </Head>

      <main className="mx-4 md:mx-[5vw]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1>One Rep Max Calculator</h1>
            </CardTitle>
            <CardDescription>
              <h2>
                Estimate your max single based on reps and weight. Click{" "}
                <b>Advanced Analysis</b> for set specific strength ratings.
              </h2>
            </CardDescription>
          </CardHeader>

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
                    onCheckedChange={setIsAdvancedAnalysis}
                  />
                  <label
                    htmlFor="advanced"
                    className={cn(
                      "text-sm font-medium leading-none",
                      isAdvancedAnalysis ? "opacity-100" : "opacity-50",
                    )}
                  >
                    Advanced Analysis
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
              <ShareButton onClick={handleCopyToClipboard} />
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
      </main>
    </>
  );
}

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
  devLog(`liftRating: ${liftRating}`);

  const e1rmWeight = estimateE1RM(reps, weight, e1rmFormula);

  return (
    <Card className="border-4">
      <CardHeader>
        <CardTitle className="md:text-3xl">Estimated One Rep Max</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          {isAdvancedAnalysis && `${liftType} `}
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
          <div className="text-center text-xl font-semibold">{liftRating}</div>
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

const ShareButton = ({ onClick }) => {
  return (
    <>
      <Button className="border" variant="secondary" onClick={onClick}>
        <div className="mr-2">Copy to clipboard</div>
        <ShareIcon />
      </Button>
    </>
  );
};

const ShareIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
      />
    </svg>
  );
};

function E1RMFormulaRadioGroup({
  formulae,
  e1rmFormula,
  setE1rmFormula,
  reps,
  weight,
  isMetric,
}) {
  return (
    <fieldset className="">
      <legend>
        <Label>E1RM Algorithm:</Label>
      </legend>
      <RadioGroup
        value={e1rmFormula}
        onValueChange={setE1rmFormula}
        className="mt-2 grid grid-cols-2 space-y-1 lg:grid-cols-1"
        aria-label="Select E1RM Algorithm"
      >
        {formulae.map((formula) => (
          <div key={formula} className="flex items-center space-x-2">
            <RadioGroupItem value={formula} id={`e1rm-formula-${formula}`} />
            <Label htmlFor={`e1rm-formula-${formula}`} className="">
              {formula} ({estimateE1RM(reps, weight, formula)}
              {isMetric ? "kg" : "lb"})
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
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
          aria-label="Number of repetitions"
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
              <Label htmlFor={lift}>{lift}</Label>
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
  const bodyWeightKG = isMetric ? bodyWeight : bodyWeight * 2.204;
  const standard = interpolateStandard(
    age,
    bodyWeightKG,
    sex,
    liftType,
    LiftingStandardsKG,
  );

  let liftRating;

  const oneRepMax = estimateE1RM(reps, weight, e1rmFormula);

  if (standard) {
    const { physicallyActive, beginner, intermediate, advanced, elite } =
      standard;

    // We don't give anything below "Physically Active" although data may be below the model
    if (oneRepMax < beginner) {
      liftRating = "Physically Active";
    } else if (oneRepMax < intermediate) {
      liftRating = "Beginner";
    } else if (oneRepMax < advanced) {
      liftRating = "Intermediate";
    } else if (oneRepMax < elite) {
      liftRating = "Advanced";
    } else {
      liftRating = "Elite";
    }
  }

  return liftRating;
};

export async function getStaticProps() {
  return {
    props: {}, // will be passed to the page component as props
  };
}
