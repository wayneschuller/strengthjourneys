"use client";
import { useState, useEffect, useContext, useRef } from "react";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useTheme } from "next-themes";
import { Line } from "react-chartjs-2";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useWindowSize, useLocalStorage } from "usehooks-ts";
import { SidePanelSelectLiftsButton } from "@/components/side-panel-lift-chooser";
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
import { getTooltipOptions } from "./visualizer-chart-config-options";

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

  const scalesOptions = {
    x: {
      type: "time",
      // clip: false,
      // offset: false,
      // bounds: "data",
      min: xScaleMin,
      max: xScaleMax,
      // These don't work the way I want
      // suggestedMin: xScaleMin,
      // suggestedMax: xScaleMax,
      time: {
        minUnit: "day",
      },
      ticks: {
        // font: { family: "Catamaran", size: 15 },
        // font: { size: 15 },
        // color: mutedForegroundColor,
        display: true,
        // color: "red",
        // maxRotation: 0, // This causes layout shift on mobile but now I'm used to it.
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
      suggestedMax: roundedMaxWeightValue,
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
    title: {
      display: authStatus === "unauthenticated", // Show explanatory visualizer title in demo mode only
      color: theme === "dark" ? "white" : "black",
      text: isMobile
        ? "Demo mode: e1rm sample data"
        : "Visualizer Demo mode: One rep max estimations of different rep schemes per lift over time",
      font: {
        size: isMobile ? 19 : 22,
      },
    },
  };

  const dataLabelsOptions = {
    display: (context) => {
      const entry = context.dataset.data[context.dataIndex]; // Our parsedData tuple
      if (entry.isHistoricalPR) return "true";
      else return "auto";
    },
    formatter: (context) => {
      return `${context.y}${context.unitType}`;
    },
    font: (context) => {
      const entry = context.dataset.data[context.dataIndex]; // Our parsedData tuple
      // Mark heavy singles in bold data labels, and the e1rm estimate data labels as italic
      const liftSingle = entry.reps === 1;
      // FIXME: do something special for entry.isHistoricalPR here
      if (liftSingle) return { weight: "bold", size: 13 };
      else return { style: "italic", size: 12 };
    },
    align: "end",
    anchor: "end",
    offset: "10",
  };

  const tooltipOptions = getTooltipOptions(
    topLiftsByTypeAndReps,
    isMobile,
    e1rmFormula,
  );

  // Min zoom-in time range in is normally 60 days. Unless the data is less than 60 days...
  const sixtyDaysInMilliseconds = 60 * 24 * 60 * 60 * 1000; // Used for zoom config limits
  let minRange = sixtyDaysInMilliseconds;
  if (sixtyDaysInMilliseconds > lastDate - firstDate) {
    minRange = lastDate - firstDate;
    zoomPanEnabled = false;
  }

  const zoomOptions = {
    zoom: {
      wheel: { enabled: zoomPanEnabled },
      mode: "x",
      pinch: { enabled: zoomPanEnabled },
    },
    pan: {
      enabled: zoomPanEnabled,
      mode: "x",
      // onPanComplete: (chart) => {
      //   return; // FIXME: couldn't get this to work well.

      //   if (!chart?.chart?.scales?.x?.ticks) return;
      //   let ticks = chart.chart.scales.x.ticks;
      //   devLog(ticks);
      //   let xScaleMin = ticks[0].value;
      //   let xScaleMax = ticks[ticks.length - 1].value;

      //   if (xScaleMin && xScaleMax) {
      //     devLog(`onPanComplete: xMin ${xScaleMin}, xMax ${xScaleMax}`);
      //     setXScaleMin(xScaleMin);
      //     setXScaleMax(xScaleMax);
      //   }
      // },
    },
    limits: {
      x: {
        min: firstDate,
        // max: lastDate,
        max: xScaleMax, // xScaleMax is lastDate with padding
        minRange: minRange,
      },
    },
  };

  const options = {
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
      <Line ref={chartRef} options={options} data={{ datasets: chartData }} />
      {zoomPanEnabled && (
        <div className="hidden flex-row gap-4 md:flex">
          <Button
            variant="outline"
            onClick={(e) => {
              const chart = chartRef.current;
              if (chart) {
                chart.zoomScale(
                  "x",
                  {
                    min: firstDate,
                    // max: lastDate,
                    max: xScaleMax, // xScaleMax is lastDate with padding
                  },
                  "default",
                );
              }
            }}
          >
            Show All Time
          </Button>
          <Button
            variant="outline"
            onClick={(e) => {
              const chart = chartRef.current;
              if (chart) {
                chart.zoomScale(
                  "x",
                  {
                    min: xScaleMin,
                    max: xScaleMax,
                  },
                  "default",
                );
              }
            }}
          >
            Show Recent
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              const chart = chartRef.current;
              if (chart) chart.zoom(0.5, "default");
            }}
          >
            <ZoomOut />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              const chart = chartRef.current;
              if (chart) chart.zoom(1.5, "default");
            }}
          >
            <ZoomIn />
          </Button>
          <SidePanelSelectLiftsButton />
        </div>
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
