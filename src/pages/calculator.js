"use client";

import Head from "next/head";
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
import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { devLog } from "@/lib/processing-utils";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { useStateFromQueryOrLocalStorage } from "../lib/use-state-from-query-or-localStorage";

export default function E1RMCalculator() {
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

  // FIXME: put inline
  const handleRepsSliderChange = (value) => {
    setReps(value[0]);
  };

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

    // devLog(`toggle is metric running...`);

    if (!isMetric) {
      // Going from kg to lb
      newWeight = Math.round(weight * 2.2046);
      setIsMetric(false);
    } else {
      // Going from lb to kg
      newWeight = Math.round(weight / 2.2046);
      setIsMetric(true);
    }

    setWeight(newWeight);

    // FIXME: update the body weight in localstorage so it's consistent with the unit change
  };

  const handleCopyToClipboard = async () => {
    const sentenceToCopy = `Lifting ${reps}@${weight}${
      isMetric ? "kg" : "lb"
    } indicates a one rep max of ${estimateE1RM(reps, weight, e1rmFormula)}${
      isMetric ? "kg" : "lb"
    } using the ${e1rmFormula} algorithm.\n(Source: https://strengthjourneys.xyz/calculator?reps=${reps}&weight=${weight}&isMetric=${isMetric}&formula=${e1rmFormula})`;

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

  return (
    <div className="mx-4 md:mx-[5vw]">
      <Head>
        <title>E1RM Calculator (Strength Journeys)</title>
        <meta
          name="description"
          content="E1RM One Rep Max Calculator App (Strength Journeys)"
        />
      </Head>

      <Card>
        <CardHeader>
          <CardTitle>One Rep Max Calculator</CardTitle>
          <CardDescription>
            Estimate your max single based on reps and weight
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
              onValueChange={handleRepsSliderChange}
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
                />
                <UnitChooser
                  isMetric={isMetric}
                  onSwitchChange={toggleIsMetric}
                />
              </div>
            </div>
          </div>

          <div className="my-8 grid grid-cols-1 place-items-center gap-6 lg:grid-cols-3">
            <div className="hidden md:block">{/* Empty first column */}</div>
            <E1RMSummaryCard
              reps={reps}
              weight={weight}
              isMetric={isMetric}
              e1rmFormula={e1rmFormula}
              estimateE1RM={estimateE1RM}
            />
            <E1RMFormulaRadioGroup
              formulae={sortedFormulae}
              e1rmFormula={e1rmFormula}
              setE1rmFormula={setE1rmFormula}
              reps={reps}
              weight={weight}
              isMetric={isMetric}
            />
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
    </div>
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
}) => {
  return (
    <Card className="border-4">
      <CardHeader>
        <CardTitle className="md:text-3xl">Estimated One Rep Max</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          {reps}@{weight}
          {isMetric ? "kg" : "lb"}
        </div>
        <div className="text-center text-5xl font-bold tracking-tight md:text-6xl xl:text-7xl">
          {estimateE1RM(reps, weight, e1rmFormula)}
          {isMetric ? "kg" : "lb"}
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
    <div className="flex flex-col space-y-2">
      <Label className="text-sm font-light">E1RM Algorithm</Label>
      <RadioGroup
        value={e1rmFormula}
        onValueChange={setE1rmFormula}
        className="flex flex-col space-y-1"
      >
        {formulae.map((formula) => (
          <div key={formula} className="flex items-center space-x-2">
            <RadioGroupItem value={formula} id={formula} />
            <Label htmlFor={formula} className="">
              {formula} ({estimateE1RM(reps, weight, formula)}
              {isMetric ? "kg" : "lb"})
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
