"use client";

import Head from "next/head";
import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";

import { Inter, Righteous } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sampleData } from "@/lib/sampleData";
import { getLiftColor } from "@/lib/getLiftColor";

import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  Chart as ChartJS,
  Colors,
  TimeScale,
  TimeSeriesScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import "chartjs-adapter-date-fns";
import ChartDataLabels from "chartjs-plugin-datalabels";

import { Line } from "react-chartjs-2";
import { Bold } from "lucide-react";

ChartJS.register(
  Colors,
  TimeScale,
  TimeSeriesScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels,
);

const Visualizer = () => {
  console.log(getLiftColor("Back Squat"));

  return (
    <>
      <Head>
        <title>Strength Visualizer (Strength Journeys)</title>
        <meta
          name="description"
          content="Strength Journeys Strength Analyzer"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="">
        <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl ">
          Strength Visualizer
        </h1>
        <div>{/* <LiftChooserPanel /> */}</div>
        <div
          style={{ position: "relative", height: "85vh", width: "92vw" }}
          className="mt-4"
        >
          <VisualizerChart />
        </div>
      </div>
    </>
  );
};
export default Visualizer;

const LiftChooserPanel = ({}) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="mt-2 px-2 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 ">
          {/* <ViewVerticalIcon className="h-5 w-5" /> */}
          Choose Lifts
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <div className="flex w-min flex-col">
          <div>Back Squat</div>
          <div>Deadlift</div>
          <div>Bench Press</div>
          <SheetClose asChild className="flex justify-center">
            <Button>Close controls</Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const VisualizerChart = ({}) => {
  const { theme } = useTheme();
  const [primaryColor, setPrimaryColor] = useState("");
  const [mutedColor, setMutedColor] = useState("");
  const [mutedForegroundColor, setMutedForegroundColor] = useState("");
  const [gridColor, setGridColor] = useState("");

  useEffect(() => {
    // Accessing the HSL color variables
    // from the shadcn theme
    const root = document.documentElement;

    const computedMutedColor =
      getComputedStyle(root).getPropertyValue("--foreground");
    setMutedColor(convertToHslFormat(computedMutedColor));

    const computedMutedForegroundColor =
      getComputedStyle(root).getPropertyValue("--muted-foreground");
    setMutedForegroundColor(convertToHslFormat(computedMutedForegroundColor));

    setGridColor(
      fadeHslColor(computedMutedForegroundColor, 30, theme === "dark"),
    );

    // console.log(gridColor);
  }, [theme]);

  // Function to calculate 1RM using Brzycki formula
  function calculateOneRepMax(weight, reps) {
    return Math.round(weight * (1 - (0.025 * reps) / 100));
  }

  // Process the data to create an array of arrays per lift
  const liftArrays = {};

  sampleData.forEach((entry) => {
    const { date, name, reps, weight } = entry;
    const oneRepMax = calculateOneRepMax(weight, reps);

    if (!liftArrays[name]) {
      liftArrays[name] = [];
    }

    const existingEntry = liftArrays[name].find((item) => item[0] === date);

    if (!existingEntry || existingEntry[1] < oneRepMax) {
      // If there's no existing entry for this date or the existing one is lower, update it
      liftArrays[name] = liftArrays[name].filter((item) => item[0] !== date);
      liftArrays[name].push([date, oneRepMax]);
    }
  });

  // Sort the arrays chronologically
  Object.values(liftArrays).forEach((arr) => {
    arr.sort((a, b) => new Date(a[0]) - new Date(b[0]));
  });

  // console.log(liftArrays);

  // Convert liftArrays to Chart.js compatible format
  const chartData = Object.entries(liftArrays).map(([lift, data]) => ({
    label: lift,
    data: data.map(([date, value]) => ({ x: date, y: value })),
    backgroundColor: getLiftColor(lift),
    borderColor: "rgb(50, 50, 50)",
    borderWidth: 2,
    pointStyle: "circle",
    radius: 4,
    hitRadius: 20,
    hoverRadius: 10,
    cubicInterpolationMode: "monotone",
    // hidden: hidden, // This is for chart.js config
  }));

  // console.log(chartData);

  const scalesOptions = {
    x: {
      type: "time",
      // min: sixMonthsAgo,
      // suggestedMax: visualizerData.padDateMax,
      time: {
        minUnit: "day",
      },
      ticks: {
        // font: { family: "Catamaran", size: 15 },
        // font: { size: 15 },
        // color: mutedForegroundColor,
      },
      grid: {
        // color: mutedColor,
        color: gridColor,
        display: true,
      },
    },
    y: {
      // suggestedMin: 0,
      // suggestedMax: visualizerData.highestWeight,

      ticks: {
        display: false, // Google Material UI guidelines suggest you don't always have to show axes if you have datalabels
        // font: { family: "Catamaran", size: 15 },
        // color: mutedForegroundColor,
        callback: (value) => {
          return `${value}`; // FIXME: insert unitType from data
        },
      },
      grid: {
        display: true,
        color: gridColor,
      },
    },
  };

  const titleOptions = {
    display: false,
  };

  const legendOptions = {
    display: false,
    position: "right",
  };

  const dataLabelsOptions = {
    display: true,
    formatter: (context) => {
      // console.log(context);
      return `${context.y}kg`;
    },
    font: (context) => {
      // FIXME: Mark heavy singles in bold data labels, and the e1rm estimate data labels as italic
      // return { family: "Sans", size: 12 };
      return { weight: "bold" };
    },
    align: "end",
    anchor: "end",
  };

  const tooltipOptions = {
    enabled: true,
    callbacks: {
      title: (context) => {
        const d = new Date(context[0].parsed.x);
        const formattedDate = d.toLocaleString([], {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return formattedDate;
      },
    },
  };

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    resizeDelay: 20,

    scales: scalesOptions,
    plugins: {
      title: titleOptions,
      legend: legendOptions,
      datalabels: dataLabelsOptions,
      tooltip: tooltipOptions,
    },
  };

  return <Line options={options} data={{ datasets: chartData }} />;
};

// Function to generate random colors
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function convertToHslFormat(originalHsl) {
  // Split the original HSL string into individual components
  const [hue, saturation, lightness] = originalHsl.split(" ");

  // Extract numeric values
  const numericHue = parseFloat(hue);
  const numericSaturation = parseFloat(saturation);
  const numericLightness = parseFloat(lightness);

  // Construct the HSL format string
  const hslFormat = `hsl(${numericHue}, ${numericSaturation}%, ${numericLightness}%)`;

  return hslFormat;
}

function fadeHslColor(originalHsl, fadeAmount, isDarkMode) {
  console.log(originalHsl);
  // Split the original HSL string into individual components
  const [hue, saturation, lightness] = originalHsl.split(" ");

  // Extract numeric values
  const numericHue = parseFloat(hue);
  const numericSaturation = parseFloat(saturation);
  let numericLightness = parseFloat(lightness);

  // Adjust lightness based on mode
  if (isDarkMode) {
    // Dark mode: decrease lightness
    numericLightness = Math.max(0, numericLightness - fadeAmount);
  } else {
    // Light mode: increase lightness
    numericLightness = Math.min(100, numericLightness + fadeAmount);
  }

  // Construct the new HSL format string
  const fadedHsl = `hsl(${numericHue}, ${numericSaturation}%, ${numericLightness}%)`;

  return fadedHsl;
}
