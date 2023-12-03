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
import { parseGSheetData } from "@/lib/parseGSheetData";
import { sampleParsedData } from "@/lib/sampleParsedData";
import { estimateE1RM } from "@/lib/estimateE1RM";
import { devLog } from "@/lib/devLog";

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
  const { data, isError, isLoading } = useUserLiftData(session, ssid);
  const { toast } = useToast();
  const [openPicker, authResponse] = useDrivePicker();

  // const { data, isError, isLoading } = useUserLiftData(ssid);
  // const { data, isLoading } = useSWR(`/api/readGSheet?ssid=${ssid}`, fetcher, {
  // revalidateOnFocus: false,
  // });

  useEffect(() => {
    // console.log(`VisualizerChart useEffect isLoading: ${isLoading}`);
    devLog(`VisualizerChart useEffect session:`);
    devLog(session);

    if (!session) {
      toast({
        title: "Visualizer Demo Mode",
        description:
          "Sign in to visualize your personal Google Sheet lifting data.",
        action: (
          <ToastAction altText="Google Login" onClick={() => signIn("google")}>
            Sign in
          </ToastAction>
        ),
      });
      return;
    }

    if (session.user && !ssid && !parsedData) {
      toast({
        title: "Visualizer Demo Mode",
        description: "Google Sheet not yet selected.",
        action: (
          <ToastAction
            altText="Choose google sheet file"
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

    if (!isLoading && session.user && ssid) {
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  devLog(data);
  if (isError && !data?.values) {
    return (
      <div className="text-center">
        <div className="text-bold">Error reading GSheet data: {data.error}</div>
        <div>
          Sometimes logging out and in again will help Google be friendlier.
        </div>
      </div>
    );
  }

  // We imported chartDefaults from chart.js above
  // chartDefaults.font.family = "'Inter', 'Helvetica','Arial'";
  // chartDefaults.font.family = "'Inter'";
  // chartDefaults.font.size = 20;
  chartDefaults.normalized = true;

  let chartData = [];
  let localParsedData = null;
  if (session && data?.values) {
    devLog(data);
    if (parsedData === null) {
      localParsedData = parseGSheetData(data.values); // FIXME: Do this in the useEffect?
      // setParsedData(newParsedData); // This triggers an infinite loop of rerendering
      devLog(localParsedData);
    } else {
      localParsedData = parsedData;
    }
  } else {
    localParsedData = sampleParsedData;
  }
  const sortedDatasets = visualizerProcessParsedData(localParsedData);
  chartData = sortedDatasets.slice(0, 5); // Get top 5

  // console.log(`Visualizer chartData:`);
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

// This function uniquely processes the parsed Data for the Visualizer
// So it lives here in the <VisualizerChart /> component
function visualizerProcessParsedData(parsedData) {
  if (parsedData === null) {
    console.log(`Error: visualizerProcessParsedData passed null.`);
    return;
  }

  const datasets = {};

  parsedData.forEach((entry) => {
    // Create a unique identifier for each lift type
    const liftKey = entry.liftType;

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
        // console.log( `Visualizer processor: pushing: ${liftKey} ${entry.date} ${oneRepMax}`,);
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

  return sortedDatasets;
}
