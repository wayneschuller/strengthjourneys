"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { getLiftColor } from "@/lib/getLiftColor";
import { Line } from "react-chartjs-2";

import {
  defaults as chartDefaults,
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
import zoomPlugin from "chartjs-plugin-zoom";

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
  zoomPlugin,
);

const VisualizerChart = ({ rawData }) => {
  const { theme } = useTheme();
  const [primaryForegroundColor, setPrimaryForegroundColor] = useState(null);
  const [mutedColor, setMutedColor] = useState(null);
  const [mutedForegroundColor, setMutedForegroundColor] = useState(null);
  const [gridColor, setGridColor] = useState(null);

  useEffect(() => {
    // Accessing the HSL color variables
    // from the shadcn theme
    // FIXME: Not sure this is worth it
    const root = document.documentElement;

    const computedPrimaryColor = getComputedStyle(root).getPropertyValue(
      "--primary-foreground",
    );
    setPrimaryForegroundColor(convertToHslFormat(computedPrimaryColor));

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

  // We imported chartDefaults from chart.js above
  // chartDefaults.font.family = "'Inter', 'Helvetica','Arial'";
  // chartDefaults.font.family = "'Inter'";
  // chartDefaults.font.size = 20;
  chartDefaults.normalized = true;

  // Function to calculate 1RM using Brzycki formula
  function calculateOneRepMax(weight, reps) {
    return Math.round(weight * (1 - (0.025 * reps) / 100));
  }

  // Process the data to create an array of arrays per lift
  const liftArrays = {};

  rawData.forEach((entry) => {
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
        display: true,
        // color: "red",
        maxRotation: 0, // The default rotation is good on desktop but on mobile causes constant layout shifting on zoom
      },
      grid: {
        // color: mutedColor,
        color: gridColor,
        display: true,
        tickColor: theme === "dark" ? "white" : "black",
      },
    },
    y: {
      suggestedMin: 0,
      suggestedMax: 250,
      ticks: {
        display: false,

        // font: { family: "Catamaran", size: 15 },
        // color: mutedForegroundColor,
        callback: (value) => {
          return `${value}`; // FIXME: insert unitType from data
        },
      },
      grid: {
        display: false,
        color: gridColor,
      },
    },
  };

  const titleOptions = {
    display: false,
  };

  const legendOptions = {
    display: true,
    position: "top",
    labels: {
      color: theme === "dark" ? "white" : "black",
      // color: primaryForegroundColor,
      font: {
        size: 16,
        // family: "'Inter', 'Sans'",
        // family: "'Arial'",
      },
    },
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

  const zoomOptions = {
    zoom: {
      wheel: { enabled: true },
      mode: "x",
      pinch: { enabled: true },
    },
    pan: {
      enabled: true,
      mode: "x",
    },
    // limits: {
    // x: {
    // min: visualizerData.padDateMin,
    // max: visualizerData.padDateMax,
    // minRange: minRange,
    // },
    // },
  };

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    // resizeDelay: 20,

    scales: scalesOptions,
    plugins: {
      title: titleOptions,
      legend: legendOptions,
      datalabels: dataLabelsOptions,
      tooltip: tooltipOptions,
      zoom: zoomOptions,
    },
  };

  return <Line options={options} data={{ datasets: chartData }} />;
};

export default VisualizerChart;

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
  // console.log(originalHsl);
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