"use client";
import { useState, useEffect, useContext, useRef } from "react";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useTheme } from "next-themes";
import { Line } from "react-chartjs-2";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";
import { useWindowSize, useReadLocalStorage } from "usehooks-ts";
import { devLog } from "@/lib/processing-utils";

import {
  defaults as chartDefaults,
  Chart as ChartJS,
  TimeScale,
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
import { processVisualizerData } from "./visualizer-processing";
import { getFirstLastDatesMaxWeightFromChartData } from "./visualizer-processing";
import {
  getLegendOptions,
  getDataLabelsOptions,
  getTooltipOptions,
  getZoomOptions,
  getScalesOptions,
} from "./visualizer-chart-config-options";
import { VisualizerChartControls } from "./visualizer-chart-controls";

ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ChartDataLabels,
  zoomPlugin,
);

// Break convention and export a default function for the next.js dynamic loader
export default function VisualizerChart() {
  const { theme } = useTheme();
  const [primaryForegroundColor, setPrimaryForegroundColor] = useState(null);
  const [mutedColor, setMutedColor] = useState(null);
  const [mutedForegroundColor, setMutedForegroundColor] = useState(null);
  const [gridColor, setGridColor] = useState(null);
  const { parsedData, selectedLiftTypes, topLiftsByTypeAndReps, isLoading } =
    useUserLiftingData();
  const chartRef = useRef(null);
  const { width } = useWindowSize();
  const [chartData, setChartData] = useState(null);
  const [e1rmFormula, setE1rmFormula] = useState("Brzycki"); // FIXME: use the hook for this?
  const { status: authStatus } = useSession();
  const [xZoomPan, setXZoomPan] = useState(null);

  devLog(xZoomPan);

  // Local computed/derived variables
  let firstDate = null;
  let lastDate = null;
  let roundedMaxWeightValue = null;
  let xScaleMin = null;
  let xScaleMax = null;
  let isMobile = false;
  let zoomPanEnabled = true; // We will set to false if we don't have much data

  // Main useEffect - wait for parsedData process component specfic data
  useEffect(() => {
    // devLog(`VisualizerChart useEffect[parsedData, selectedLiftTypes]`);
    // devLog(parsedData);
    // devLog(selectedLiftTypes);
    if (!parsedData) return;

    // Generate chart data!
    const e1rmFormula =
      JSON.parse(localStorage.getItem("e1rmFormula")) || "Brzycki";
    setE1rmFormula(e1rmFormula);

    const chartData = processVisualizerData(
      parsedData,
      selectedLiftTypes,
      e1rmFormula,
    );

    setChartData(chartData); // This should trigger everything
  }, [parsedData, selectedLiftTypes]);

  useEffect(() => {
    // Accessing the HSL color variables from the shadcn theme
    // FIXME: Not sure this is worth it
    const root = document.documentElement;

    // const computedPrimaryColor = getComputedStyle(root).getPropertyValue(
    //   "--primary-foreground",
    // );
    // setPrimaryForegroundColor(convertToHslFormat(computedPrimaryColor));

    // const computedMutedColor =
    //   getComputedStyle(root).getPropertyValue("--foreground");
    // setMutedColor(convertToHslFormat(computedMutedColor));

    const computedMutedForegroundColor =
      getComputedStyle(root).getPropertyValue("--muted-foreground");
    setMutedForegroundColor(convertToHslFormat(computedMutedForegroundColor));

    setGridColor(
      fadeHslColor(computedMutedForegroundColor, 30, theme === "dark"),
    );

    // console.log(gridColor);
  }, [theme]);

  // Show skeleton until chartData state is ready to go
  if (
    isLoading ||
    !chartData ||
    !Array.isArray(chartData) ||
    chartData.length === 0
  ) {
    return <Skeleton className="mt-4 h-[80vh] w-[90vw]"></Skeleton>;
  }

  // We imported chartDefaults from chart.js above
  // chartDefaults.font.family = "'Inter', 'Helvetica','Arial'";
  // chartDefaults.font.family = "'Inter'";
  // chartDefaults.font.size = 20;
  chartDefaults.normalized = true;

  // Set sensible default range for desktop and mobile
  // If user has less data than range, then their data is the range (with less padding)

  // Get sensible padded boundaries from the user data
  // firstDate, lastDate and scaleMin will all be Unix timestamps
  ({ firstDate, lastDate, roundedMaxWeightValue } =
    getFirstLastDatesMaxWeightFromChartData(chartData));

  if (width <= 768) {
    isMobile = true;
  }

  let defaultRangeInMonths = 6; // Desktop default
  let xPaddingInDays = 15; // Desktop default
  if (isMobile) {
    defaultRangeInMonths = 1; // Mobile default
    xPaddingInDays = 3; // Mobile default
  }

  const defaultRangeMilliseconds =
    1000 * 60 * 60 * 24 * 30 * defaultRangeInMonths;
  let xPaddingInMilliseconds = xPaddingInDays * 24 * 60 * 60 * 1000;

  if (lastDate - firstDate < defaultRangeMilliseconds) {
    xPaddingInDays = 1; // Small padding with small data
    xPaddingInMilliseconds = xPaddingInDays * 24 * 60 * 60 * 1000;

    // Set xScaleMin to be just before the first entry on the chart
    // xScaleMin = firstDate - xPaddingInMilliseconds;
    xScaleMin = firstDate - xPaddingInMilliseconds;
  } else {
    // Set xScaleMin to just before the preferred time range on the chart
    // xScaleMin = lastDate - defaultRangeMilliseconds - xPaddingInMilliseconds;
    xScaleMin = lastDate - defaultRangeMilliseconds - xPaddingInMilliseconds;
  }

  // set xScaleMax to preferred padding at right end of chart
  // xScaleMax = lastDate + xPaddingInMilliseconds;
  xScaleMax = lastDate + xPaddingInMilliseconds;

  const titleOptions = {
    display: false,
  };

  const scalesOptions = getScalesOptions(
    theme,
    xScaleMax,
    xScaleMin,
    gridColor,
    roundedMaxWeightValue,
    xZoomPan,
    setXZoomPan,
  );
  const legendOptions = getLegendOptions(theme, isMobile, authStatus);
  const dataLabelsOptions = getDataLabelsOptions();
  const zoomOptions = getZoomOptions(
    firstDate,
    lastDate,
    xScaleMax,
    setXZoomPan,
  );
  const tooltipOptions = getTooltipOptions(
    topLiftsByTypeAndReps,
    isMobile,
    e1rmFormula,
  );

  const chartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    // resizeDelay: 20,
    scales: scalesOptions,
    // backgroundColor: `#FFFFFF`,
    // backgroundColor: `#000`,
    onClick: (event, item) => {
      // Used to detect a click on a graph point and open URL in the data.
      if (isMobile) return; // Clicking on mobile is for viewing the tooltip
      if (item && item.length > 0) {
        const url = item[0].element.$context.raw.URL;
        if (url) window.open(url);
      }
    },
    plugins: {
      title: titleOptions,
      legend: legendOptions,
      datalabels: dataLabelsOptions,
      tooltip: tooltipOptions,
      zoom: zoomOptions,
    },
  };

  return (
    <>
      <Line
        ref={chartRef}
        options={chartOptions}
        data={{ datasets: chartData }}
      />
      {zoomPanEnabled && (
        <VisualizerChartControls
          chartRef={chartRef}
          xScaleMin={xScaleMin}
          xScaleMax={xScaleMax}
          firstDate={firstDate}
        />
      )}
    </>
  );
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
