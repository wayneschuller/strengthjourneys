"use client";
import { useState, useEffect, useContext } from "react";
import { useTheme } from "next-themes";
import { getLiftColor } from "@/lib/getLiftColor";
import { Line } from "react-chartjs-2";
import { useSession, signIn } from "next-auth/react";
import useUserLiftData from "@/lib/useUserLiftData";
import { ParsedDataContext } from "@/pages/_app";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import useDrivePicker from "@fyelci/react-google-drive-picker";
import { handleOpenPicker } from "@/components/handleOpenPicker";

import useSWR from "swr";

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
import { sampleData } from "@/lib/sampleData";

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

const fetcher = (...args) => fetch(...args).then((res) => res.json()); // Generic fetch for useSWR

export const VisualizerChart = () => {
  const { theme } = useTheme();
  const [primaryForegroundColor, setPrimaryForegroundColor] = useState(null);
  const [mutedColor, setMutedColor] = useState(null);
  const [mutedForegroundColor, setMutedForegroundColor] = useState(null);
  const [gridColor, setGridColor] = useState(null);
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { data, isLoading } = useUserLiftData(ssid);
  const { toast } = useToast();
  const [openPicker, authResponse] = useDrivePicker();

  // const { data, isError, isLoading } = useUserLiftData(ssid);
  // const { data, isLoading } = useSWR(`/api/readGSheet?ssid=${ssid}`, fetcher, {
  // revalidateOnFocus: false,
  // });

  useEffect(() => {
    console.log(`VisualizerChart useEffect isLoading: ${isLoading}`);
    if (isLoading) return;

    if (!session) {
      toast({
        title: "Visualizer Demo Mode",
        description: "Sign in to connect your Google Sheet lifting data.",
        action: (
          <ToastAction altText="Google Login" onClick={() => signIn()}>
            Sign in
          </ToastAction>
        ),
      });
      return;
    }

    if (!ssid) {
      toast({
        title: "Visualizer Demo Mode",
        description: "Google Sheet not yet selected.",
        action: (
          <ToastAction
            altText="Google Login"
            onClick={() =>
              handleOpenPicker(openPicker, session.accessToken, setSsid)
            }
          >
            Choose file
          </ToastAction>
        ),
      });
      return;
    }

    if (session && ssid) {
      toast({
        title: "Data loaded from Google Sheets",
        description: "Bespoke lifting data",
      });
      return;
    }
  }, [session, ssid, isLoading]);

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

  // console.log(data);
  // console.log(ssid);
  if (!ssid) {
    return <div>Choose a file FIXME: button (FIXME: show sample data)</div>;
  }
  // console.log(isError);
  if (data?.error) {
    return <div>Error: {data.error}</div>;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // We imported chartDefaults from chart.js above
  // chartDefaults.font.family = "'Inter', 'Helvetica','Arial'";
  // chartDefaults.font.family = "'Inter'";
  // chartDefaults.font.size = 20;
  chartDefaults.normalized = true;

  let chartData = [];

  if (session && data) {
    chartData = processRawData(data.values);
  } else {
    chartData = processRawData(sampleData);
  }
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

  return (
    <>
      <Line options={options} data={{ datasets: chartData }} />
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

// Convert the GSheet data into what we need for visualizer
function processRawData(data) {
  // Function to calculate 1RM using Brzycki formula
  function calculateOneRepMax(weight, reps) {
    return Math.round(weight * (1 - (0.025 * reps) / 100));
  }

  // Process the data to create an array of arrays per lift
  const liftArrays = {};
  let lastUsedName = null;
  let lastUsedDate = null;

  console.log(data);
  data.forEach((entry) => {
    if (entry.length < 4) return;

    let date = entry[0];
    let name = entry[1];
    let reps = entry[2];
    let weight = entry[3];

    // Convert reps to a number
    reps = parseInt(reps, 10);

    const weightValue = weight ? parseFloat(weight.replace("kg", "")) : null;

    if (!Number.isInteger(reps) || isNaN(weightValue)) {
      // You may want to log a message or handle the skip in some way
      // console.log( `Skipping row: ${reps} ${weightValue} ${JSON.stringify(entry)}`,);
      return; // Skip to the next iteration
    }

    // If 'date' is empty, use the most recent date from the previous row
    if (!date && lastUsedDate !== null) {
      date = lastUsedDate;
    }

    // If 'name' is empty, use the most recent name from the previous row
    if (!name && lastUsedName !== null) {
      name = lastUsedName;
    }

    const oneRepMax = calculateOneRepMax(weightValue, reps);

    if (!liftArrays[name]) {
      liftArrays[name] = [];
    }

    const existingEntry = liftArrays[name].find((item) => item[0] === date);

    if (!existingEntry || existingEntry[1] < oneRepMax) {
      // If there's no existing entry for this date or the existing one is lower, update it
      liftArrays[name] = liftArrays[name].filter((item) => item[0] !== date);
      liftArrays[name].push([date, oneRepMax]);
    }

    // Update the lastUsedName and lastUsedDate for the next iteration
    lastUsedName = name;
    lastUsedDate = date;
  });

  // console.log(liftArrays);
  // Sort the arrays chronologically FIXME NEEDED?
  // Object.values(liftArrays).forEach((arr) => {
  // arr.sort((a, b) => new Date(a[0]) - new Date(b[0]));
  // });
  // Sort the arrays by the number of entries in descending order
  const sortedLiftArrays = Object.entries(liftArrays)
    .sort(([, dataA], [, dataB]) => dataB.length - dataA.length)
    .slice(0, 5); // Select the top 5 lift arrays

  // Convert liftArrays to Chart.js compatible format
  const chartData = sortedLiftArrays.map(([lift, data]) => ({
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

  return chartData;
}
