"use client";
import { useState, useEffect, useContext, useRef } from "react";
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
import { useWindowSize } from "usehooks-ts";

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
  const [chartData, setChartData] = useState(null);
  const { width } = useWindowSize();

  // Local computed data.
  let firstDate = null;
  let lastDate = null;
  let roundedMaxWeightValue = null;

  devLog(`<VisualizerChart /> rendering...`);
  // Main useEffect - wait for parsedData process component specfic data
  useEffect(() => {
    if (!parsedData) return;

    // Generate chart data!
    const chartData = processVisualizerData(parsedData, selectedLiftTypes);
    setChartData(chartData);
  }, [parsedData, selectedLiftTypes]);

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

  if (isLoading && !isDemoMode) {
    return <Skeleton className="h-[80vh] w-[90vw]"></Skeleton>;
  }

  if (!chartData) return; // Eventually in the useEffect this will have data

  // Get sensible padded boundaries from the user data
  ({ firstDate, lastDate, roundedMaxWeightValue } =
    getFirstLastDatesMaxWeightFromChartData(chartData));

  // We imported chartDefaults from chart.js above
  // chartDefaults.font.family = "'Inter', 'Helvetica','Arial'";
  // chartDefaults.font.family = "'Inter'";
  // chartDefaults.font.size = 20;
  chartDefaults.normalized = true;

  // devLog(firstDate);

  // Set sensible default range for desktop and mobile
  let defaultRangeInMonths = 6;
  if (width <= 768) defaultRangeInMonths = 2;
  const defaultRangeMilliseconds =
    1000 * 60 * 60 * 24 * 30 * defaultRangeInMonths;

  const scalesOptions = {
    x: {
      type: "time",
      min: lastDate - defaultRangeMilliseconds,
      max: lastDate,
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
                    min: lastDate - defaultRangeMilliseconds,
                    max: lastDate,
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

  const firstDate = new Date(Math.min(...allDates));
  const lastDate = new Date(Math.max(...allDates));

  // Hardcoded padding value of 10 days
  const paddingDays = 10;

  // Pad the start and end dates
  const paddedStartDate = new Date(firstDate);
  const paddedEndDate = new Date(lastDate);

  paddedStartDate.setDate(firstDate.getDate() - paddingDays);
  paddedEndDate.setDate(lastDate.getDate() + paddingDays);

  // Round maxWeightValue up to the next multiple of 50
  const roundedMaxWeightValue = Math.ceil(maxWeightValue / 50) * 50;

  // return { firstDate, lastDate };
  return {
    firstDate: paddedStartDate,
    lastDate: paddedEndDate,
    roundedMaxWeightValue,
  };
}

// This function uniquely processes the parsed Data for the Visualizer
// So it lives here in the <VisualizerChart /> component
function processVisualizerData(parsedData, selectedLiftTypes) {
  if (parsedData === null) {
    console.log(`Error: visualizerProcessParsedData passed null.`);
    return;
  }

  const startTime = performance.now(); // We measure critical processing steps

  const datasets = {};

  parsedData.forEach((entry) => {
    // Create a unique identifier for each lift type
    const liftKey = entry.liftType;

    // Check if selectedLiftTypes is provided and if the current lift type is not in the array
    if (selectedLiftTypes && !selectedLiftTypes.includes(liftKey)) {
      return; // Skip processing if not in selectedLiftTypes
    }

    // Calculate one-rep max using the provided function (e.g., "Brzycki" formula)
    const oneRepMax = estimateE1RM(entry.reps, entry.weight, "Brzycki");

    // Check if the lift type already exists in datasets
    if (!datasets[liftKey]) {
      datasets[liftKey] = {
        label: entry.liftType,
        data: [],
        backgroundColor: getLiftColor(entry.liftType),
        borderColor: "rgb(50, 50, 50)",
        borderWidth: 2,
        pointStyle: "circle",
        radius: 4,
        hitRadius: 20,
        hoverRadius: 10,
        cubicInterpolationMode: "monotone",
      };
    }

    // Check if the date already exists in the dataset for the lift type
    const existingDataIndex = datasets[liftKey].data.findIndex(
      (item) => item.x === entry.date,
    );

    // If the date doesn't exist or the new one-rep max is higher, update the dataset
    if (
      existingDataIndex === -1 ||
      datasets[liftKey].data[existingDataIndex].y < oneRepMax
    ) {
      if (existingDataIndex === -1) {
        // If the date doesn't exist, add it to the dataset
        datasets[liftKey].data.push({
          x: entry.date,
          y: oneRepMax,
        });
      } else {
        // If the date exists but the new one-rep max is higher, update it
        datasets[liftKey].data[existingDataIndex] = {
          x: entry.date,
          y: oneRepMax,
        };
      }
    }
  });

  // Sort datasets based on the size of the data (number of entries)
  const sortedDatasets = Object.values(datasets).sort(
    (a, b) => b.data.length - a.data.length,
  );

  devLog(
    "processVisualizerData execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return sortedDatasets;
}
