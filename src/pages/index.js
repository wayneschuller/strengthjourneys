/** @format */

"use client";

import { useState, useEffect } from "react";
import Head from "next/head";
import { estimateE1RM } from "../lib/estimateE1RM";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { ThemeProvider } from "@/components/theme-provider";
import { UnitChooser } from "../components/UnitChooser";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { e1rmFormulae } from "../lib/estimateE1RM";
import { Input } from "@/components/ui/input";

import { Slider } from "@/components/ui/slider";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";

export default function Home() {
  const title = "E1RM One Rep Max Calculator";

  return (
    <div>
      <Head>
        <title>{title}</title>
        {/* <link rel="icon" href="/favicon.ico" /> */}
        <meta
          name="description"
          content="A one rep max strength calculator you can use with chalked up hands on your phone in the middle of a gym session. 
                We give estimates using multiple exercise science formulas. Designed by lifters for lifters. 
                Useful for powerlifting, strong lifts, crossfit, starting strength and other programs."
        />

        <link rel="canonical" href="https://www.onerepmaxcalculator.xyz/" />
      </Head>
      <main className={`flex justify-center `}>
        <E1RMCalculator />
      </main>
      <Toaster />
    </div>
  );
}

let didInit = false;

const E1RMCalculator = () => {
  const [reps, setReps] = useState(5);
  const [weight, setWeight] = useState(225);
  const [isMetric, setIsMetric] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const defaultFormula = "Brzycki"; // One day we might make this configurable.

  // useEffect on first init get defaults from localStorage
  useEffect(() => {
    if (!didInit) {
      didInit = true;

      let initIsMetric = localStorage.getItem("calcIsMetric");
      initIsMetric = initIsMetric === "true"; // boolean is true if string is "true" otherwise false
      setIsMetric(initIsMetric);
    }
  }, []);

  useEffect(() => {
    // Get some initial values from URL parameters
    const initReps = router?.query?.reps ?? 5;

    let initIsMetric;
    if (router?.query?.isMetric === "false") {
      initIsMetric = false;
    } else if (router?.query?.isMetric === "true") {
      initIsMetric = true;
    } else {
      // The URL has no guidance. So check localStorage then default to false (pounds)
      initIsMetric = localStorage.getItem("calcIsMetric") === "true" || false;
    }

    let initWeight;
    if (router?.query?.weight) {
      initWeight = router.query.weight;
    } else if (initIsMetric) {
      initWeight = 100;
    } else {
      initWeight = 225;
    }

    // Update state if query is now different to state values
    // This could be on first load
    // Or could be if user clicks back/forward browser button
    if (initReps !== reps) setReps(initReps);
    if (initWeight !== weight) setWeight(initWeight);
    if (initIsMetric !== isMetric) setIsMetric(initIsMetric);
  }, [router.query]);

  const handleRepsSliderChange = (value) => {
    // console.log(`reps change: ${value[0]}`);
    setReps(value[0]);
  };

  const handleWeightSliderChange = (value) => {
    let newWeight = value[0];
    // console.log(`weight change: ${newWeight} `);

    if (isMetric) {
      newWeight = 2.5 * Math.ceil(newWeight / 2.5); // For kg only allow nice multiples of 2.5kg
    } else {
      newWeight = 5 * Math.ceil(newWeight / 5); // For lb only allow nice multiples of 5lb
    }

    setWeight(newWeight);
  };

  // When user lets go of weight slider, update the URL params
  // onCommit means we won't flood the browser with URL changes
  const handleWeightSliderCommit = (value) => {
    const newWeight = value;

    router.push(
      {
        pathname: router.pathname,
        query: { reps: reps, weight: newWeight, isMetric: isMetric },
      },
      undefined,
      { scroll: false },
    );
  };

  // When user lets go of reps slider, update the URL params
  // onCommit means we won't flood the browser with URL changes
  const handleRepsSliderCommit = (value) => {
    const newReps = value;

    router.push(
      {
        pathname: router.pathname,
        query: { reps: newReps, weight: weight, isMetric: isMetric },
      },
      undefined,
      { scroll: false },
    );
  };

  const handleEntryWeightChange = (event) => {
    const newWeight = event.target.value;

    setWeight(newWeight);

    // Update the browser URL instantly
    router.push({
      pathname: router.pathname,
      query: { reps: reps, weight: newWeight, isMetric: isMetric },
    });
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

    // Update the browser URL instantly
    router.push({
      pathname: router.pathname,
      query: { reps: reps, weight: newWeight, isMetric: isMetric },
    });

    // Save in localStorage for this browser device
    localStorage.setItem("calcIsMetric", isMetric);
  };

  const handleCopyToClipboard = async () => {
    const sentenceToCopy = `Lifting ${reps}@${weight}${
      isMetric ? "kg" : "lb"
    } indicates a one rep max of ${estimateE1RM(reps, weight, "Brzycki")}${
      isMetric ? "kg" : "lb"
    } using Brzycki algorithm.\n(Source: onerepmaxcalculator.org/?reps=${reps}&weight=${weight}&isMetric=${isMetric})`;

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

  return (
    <div className="w-11/12 rounded-xl border-2 border-background bg-muted/50 p-4 md:w-4/5 md:p-6">
      <div className="flex flex-row gap-1 md:gap-2">
        <h1 className="flex-1 scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl ">
          E1RM One Rep Max Calculator
        </h1>
        <div className="flex flex-col gap-1 md:flex-row">
          <UnitChooser isMetric={isMetric} onSwitchChange={toggleIsMetric} />
        </div>
      </div>
      <h3 className="mb-10 mt-2 flex-1 scroll-m-20 text-xl tracking-tight md:mb-8 md:text-2xl">
        Estimate your max single based on reps and weight (see this{" "}
        <a
          href="https://en.wikipedia.org/wiki/One-repetition_maximum"
          className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
        >
          Wikipedia article
        </a>{" "}
        for the theory)
      </h3>

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
          onValueCommit={handleRepsSliderCommit}
        />
        <div className="ml-2 hidden justify-self-center text-lg md:block md:w-[7rem] md:justify-self-start">
          {reps} reps
        </div>
        <div className="ml-2 mt-6 w-[8rem] justify-self-center md:hidden">
          <div className="flex items-center gap-1 text-2xl">
            <Input
              className="text-2xl"
              type="number"
              min="1"
              step="1"
              id="weightInput"
              value={weight}
              onChange={handleEntryWeightChange}
              onKeyPress={handleKeyPress}
              onKeyDown={handleKeyDown}
            />
            {isMetric ? "kg" : "lb"}
          </div>
        </div>
        <Slider
          className="md:col-span-5"
          value={[weight]}
          min={1}
          max={isMetric ? 250 : 600}
          onValueChange={handleWeightSliderChange}
          onValueCommit={handleWeightSliderCommit}
        />
        <div className="ml-1 hidden w-[7rem] justify-self-center md:block md:justify-self-start">
          <div className="flex items-center gap-1">
            <Input
              className="text-lg"
              type="number"
              min="1"
              step="1"
              id="weightInput"
              value={weight}
              onChange={handleEntryWeightChange}
              onKeyPress={handleKeyPress}
              onKeyDown={handleKeyDown}
            />
            {isMetric ? "kg" : "lb"}
          </div>
        </div>
      </div>

      {/* Center card */}
      <div className="mt-8 flex flex-1 justify-center gap-4">
        <Card className="hover:ring-1">
          <CardHeader>
            <CardTitle>Estimated One Rep Max</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              {reps}@{weight}
              {isMetric ? "kg" : "lb"}
            </div>
            <div className="text-center text-4xl font-bold tracking-tight md:text-5xl">
              {estimateE1RM(reps, weight, defaultFormula)}
              {isMetric ? "kg" : "lb"}
            </div>
          </CardContent>
          <CardFooter className="text-muted-foreground">
            Using {defaultFormula} formula
          </CardFooter>
        </Card>
      </div>
      <div className="mt-4 flex justify-center">
        <ShareButton onClick={handleCopyToClipboard} />
      </div>

      {/* Grid of other formulae cards */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {e1rmFormulae.map((formula, index) =>
          formula === defaultFormula ? null : (
            <div key={index} className="card">
              <Card className="hover:ring-1">
                <CardHeader>
                  <CardTitle className="text-xl text-muted-foreground">
                    {formula}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold tracking-tight md:text-2xl">
                    {estimateE1RM(reps, weight, formula)}
                    {isMetric ? "kg" : "lb"}
                  </p>
                </CardContent>
              </Card>
            </div>
          ),
        )}
      </div>
    </div>
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
