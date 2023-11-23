"use client";

import Head from "next/head";
import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";

import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sampleData } from "@/lib/sampleData";

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

import { Line } from "react-chartjs-2";

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
);

const Visualizer = () => {
  const [time, setTime] = useState(1);

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
      <div className="w-11/12 md:w-4/5">
        <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight lg:text-5xl ">
          Strength Visualizer
        </h1>
        <div className="mt-6">
          <Chart2 />
        </div>
      </div>
    </>
  );
};
export default Visualizer;

const Chart2 = ({}) => {
  const { theme } = useTheme();
  const [primaryColor, setPrimaryColor] = useState("");
  const [mutedColor, setMutedColor] = useState("");
  const [mutedForegroundColor, setMutedForegroundColor] = useState("");

  // const tickColor = theme === "dark" ? "white" : "black";
  const lineColor = theme === "dark" ? "#222" : "#BBB";

  useEffect(() => {
    console.log("getting css colors...");
    // Accessing the HSL color variable
    const root = document.documentElement;

    const computedMutedColor =
      getComputedStyle(root).getPropertyValue("--muted");
    const computedMutedForegroundColor =
      getComputedStyle(root).getPropertyValue("--muted-foreground");

    setMutedColor(convertToHslFormat(computedMutedColor));
    setMutedForegroundColor(convertToHslFormat(computedMutedForegroundColor));
    // console.log(computedMutedForegroundColor);
    // console.log(convertToHslFormat(computedMutedForegroundColor));
  }, [theme]);

  // Function to calculate 1RM using Brzycki formula
  function calculateOneRepMax(weight, reps) {
    return weight * (1 - (0.025 * reps) / 100);
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
  }));

  // console.log(chartData);

  const options = {
    scales: {
      x: {
        ticks: {
          color: mutedForegroundColor,
        },
        grid: {
          color: mutedForegroundColor,
        },
      },
      y: {
        ticks: {
          color: mutedForegroundColor,
        },
        grid: {
          color: mutedForegroundColor,
        },
      },
    },
    plugins: {
      title: {
        display: false,
      },
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
