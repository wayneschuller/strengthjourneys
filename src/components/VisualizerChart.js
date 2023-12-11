"use client";
import { useState, useEffect, useContext, useRef, useMemo } from "react";
import { useTheme } from "next-themes";
import { getLiftColor } from "@/lib/getLiftColor";
import { Line } from "react-chartjs-2";
import { useSession } from "next-auth/react";
import useUserLiftData from "@/lib/useUserLiftData";
import { ParsedDataContext } from "@/pages/_app";
import useDrivePicker from "@fyelci/react-google-drive-picker";
import { estimateE1RM } from "@/lib/estimateE1RM";
import { Button } from "@/components/ui/button";
import { devLog } from "@/lib/SJ-utils";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useWindowSize, useLocalStorage } from "usehooks-ts";

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
import { endOfDay } from "date-fns";

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

export const VisualizerChart = () => {
  const { theme } = useTheme();
  const [primaryForegroundColor, setPrimaryForegroundColor] = useState(null);
  const [mutedColor, setMutedColor] = useState(null);
  const [mutedForegroundColor, setMutedForegroundColor] = useState(null);
  const [gridColor, setGridColor] = useState(null);
  const { parsedData, selectedLiftTypes, isDemoMode } =
    useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { isLoading } = useUserLiftData();
  const [openPicker, authResponse] = useDrivePicker();
  const chartRef = useRef(null);
  const { width } = useWindowSize();
  const [chartData, setChartData] = useState(null);

  // Local computed/derived variables
  let firstDate = null;
  let lastDate = null;
  let roundedMaxWeightValue = null;
  let xScaleMin = null;
  let xScaleMax = null;

  devLog(`<VisualizerChart /> rendering...`);

  // Main useEffect - wait for parsedData process component specfic data
  useEffect(() => {
    devLog(`VisualizerChart useEffect[parsedData, selectedLiftTypes]`);
    // devLog(parsedData);
    // devLog(selectedLiftTypes);
    if (!parsedData) return;

    // Generate chart data!
    // FIXME: we pass theme here so this causes a reprocessing of data on theme change - not ideal
    const chartData = processVisualizerData(
      parsedData,
      selectedLiftTypes,
      theme,
    );

    setChartData(chartData);
  }, [parsedData, selectedLiftTypes, theme]);

  useEffect(() => {
    // Accessing the HSL color variables
    // from the shadcn theme
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

  if (session === undefined) return null;

  if (isLoading && !isDemoMode && !parsedData) {
    return <Skeleton className="h-[80vh] w-[90vw]"></Skeleton>;
  }

  if (!chartData) return; // Eventually in the useEffect this will have data

  ({ firstDate, lastDate, roundedMaxWeightValue } =
    getFirstLastDatesMaxWeightFromChartData(chartData));

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

  let defaultRangeInMonths = 6; // Desktop default
  let xPaddingInDays = 10; // Desktop default
  if (width <= 768) {
    defaultRangeInMonths = 1; // Mobile default
    xPaddingInDays = 2; // Mobile default
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
      offset: true, // Prevents some clipping of points (not as good as my default padding)
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
  };

  const dataLabelsOptions = {
    display: true,
    formatter: (context) => {
      return `${context.y}${context.unitType}`;
    },
    font: (context) => {
      const entry = context.dataset.data[context.dataIndex]; // Our parsedData tuple
      // Mark heavy singles in bold data labels, and the e1rm estimate data labels as italic
      const liftSingle = entry.reps === 1;
      if (liftSingle) return { weight: "bold", size: 13 };
      else return { style: "italic", size: 12 };
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
      label: (context) => {
        if (!context) return;
        const entry = context.raw;
        const label = `${entry.reps}@${entry.weight}${entry.unitType}`;
        return label;
      },
      footer: (context) => {
        if (!context) return;
        // devLog(context);
        const entry = context[0].raw;
        const url = entry.URL;
        if (url) return `Click to open ${url.substring(0, 15)}...`; // Tooltip reminder they can click to open video
      },
    },
  };

  // Min zoom-in time range in is normally 60 days. Unless the data is less than 60 days...
  const sixtyDaysInMilliseconds = 60 * 24 * 60 * 60 * 1000; // Used for zoom config limits
  let minRange = sixtyDaysInMilliseconds;
  let zoomPanEnabled = true;
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
        max: lastDate,
        minRange: minRange,
      },
    },
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
                    max: lastDate,
                  },
                  "default",
                );
              }
            }}
          >
            Show All
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
        </div>
      )}
    </>
  );
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

function getFirstLastDatesMaxWeightFromChartData(chartData) {
  if (!Array.isArray(chartData) || chartData.length === 0) {
    console.log(`Error: Invalid or empty chartData.`);
    return null;
  }

  let maxWeightValue = -Infinity; // Initialize with a very small value

  const allDates = chartData.reduce((dates, dataset) => {
    dataset.data.forEach((point) => {
      const date = new Date(point.x);
      dates.push(date);

      // Update maxWeightValue if the current y value is higher
      if (point.y > maxWeightValue) {
        maxWeightValue = point.y;
      }
    });
    return dates;
  }, []);

  const firstDate = new Date(Math.min(...allDates)).getTime(); // Convert to Unix timestamp
  const lastDate = new Date(Math.max(...allDates)).getTime(); // Convert to Unix timestamp

  // Round maxWeightValue up to the next multiple of 50
  const roundedMaxWeightValue = Math.ceil(maxWeightValue / 50) * 50;

  // return { firstDate, lastDate };
  return {
    firstDate: firstDate,
    lastDate: lastDate,
    roundedMaxWeightValue,
  };
}

// This function uniquely processes the parsed Data for the Visualizer
// So it lives here in the <VisualizerChart /> component
function processVisualizerData(parsedData, selectedLiftTypes, theme) {
  if (parsedData === null) {
    console.log(`Error: visualizerProcessParsedData passed null.`);
    return;
  }

  const startTime = performance.now();
  const datasets = {};

  parsedData.forEach((entry) => {
    const liftTypeKey = entry.liftType;

    // Skip if the lift type is not selected
    if (selectedLiftTypes && !selectedLiftTypes.includes(liftTypeKey)) {
      return;
    }

    // Lazy initialization of dataset for the lift type
    if (!datasets[liftTypeKey]) {
      datasets[liftTypeKey] = {
        label: liftTypeKey,
        data: new Map(), // Using Map for efficient lookups
        backgroundColor: getLiftColor(liftTypeKey),
        borderColor: theme === "dark" ? "#EEEEEE" : "#111111",
        borderWidth: theme === "dark" ? 1 : 2, // Aesthetical
        pointStyle: "circle",
        radius: 4,
        hitRadius: 20,
        hoverRadius: 10,
        cubicInterpolationMode: "monotone",
      };
    }

    const oneRepMax = estimateE1RM(entry.reps, entry.weight, "Brzycki");
    const currentData = datasets[liftTypeKey].data.get(entry.date);

    if (!currentData || currentData.y < oneRepMax) {
      datasets[liftTypeKey].data.set(entry.date, {
        ...entry,
        x: entry.date,
        y: oneRepMax,
      });
    }
  });

  // Convert Map back to array and optionally sort
  const sortedDatasets = Object.values(datasets).map((dataset) => ({
    ...dataset,
    data: Array.from(dataset.data.values()), // no sorting needed
  }));

  devLog(
    "processVisualizerData execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return sortedDatasets;
}
