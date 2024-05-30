import { estimateE1RM } from "@/lib/estimate-e1rm";
import { devLog } from "@/lib/processing-utils";

export const getScalesOptions = (
  theme,
  xScaleMax,
  xScaleMin,
  gridColor,
  roundedMaxWeightValue,
) => {
  return {
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
};

export const getLegendOptions = (theme, isMobile, authStatus) => {
  return {
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
};

export const getDataLabelsOptions = () => {
  return {
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
};

export const getZoomOptions = (firstDate, lastDate, xScaleMax) => {
  // Zoom and pan are  enabled by default.
  // However we will turn it off if the data is 60 days or less
  let zoomPanEnabled = true;
  const sixtyDaysInMilliseconds = 60 * 24 * 60 * 60 * 1000; // Used for zoom config limits
  let minRange = sixtyDaysInMilliseconds;
  if (sixtyDaysInMilliseconds > lastDate - firstDate) {
    minRange = lastDate - firstDate;
    zoomPanEnabled = false;
  }

  return {
    zoom: {
      wheel: { enabled: zoomPanEnabled },
      mode: "x",
      pinch: { enabled: zoomPanEnabled },
      onZoomComplete: (chart) => {
        // devLog(`onZoomComplete:`);
        // devLog(chart);
        if (!chart.chart?.scales?.x) {
          return;
        }
        const { x } = chart.chart.scales;
        const settings = {
          xMin: x.min,
          xMax: x.max,
        };
        // devLog(settings);
        localStorage.setItem("SJ_chartZoomPanRange", JSON.stringify(settings));
      },
    },
    pan: {
      enabled: zoomPanEnabled,
      mode: "x",
      onPanComplete: (chart) => {
        // devLog(`onZoomComplete:`);
        // devLog(chart);
        if (!chart.chart?.scales?.x) {
          return;
        }
        const { x } = chart.chart.scales;
        const settings = {
          xMin: x.min,
          xMax: x.max,
        };
        // devLog(settings);
        localStorage.setItem("SJ_chartZoomPanRange", JSON.stringify(settings));
      },
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
        max: xScaleMax, // xScaleMax is lastDate with padding. FIXME: Could we just compute it here locally?
        minRange: minRange,
      },
    },
  };
};

export const getTooltipOptions = (
  topLiftsByTypeAndReps,
  isMobile,
  e1rmFormula,
) => {
  return {
    enabled: true,
    usePointStyle: true,
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
      beforeLabel: (context) =>
        context.raw.isHistoricalPR ? "Historical PR" : null,
      label: (context) => {
        if (!context) return;
        const entry = context.raw;

        let label = [];

        if (entry.reps === 1) {
          label.push(
            `${entry.isGoal ? "Dreaming of" : "Lifted"} ${entry.reps}@${
              entry.weight
            }${entry.unitType}.`,
          );
        } else {
          const oneRepMax = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
          label.push(
            `Potential 1@${oneRepMax}${entry.unitType} from lifting ${entry.reps}@${entry.weight}${entry.unitType} (${e1rmFormula} formula)`,
          );
        }
        if (entry.notes) {
          let noteChunks = splitIntoChunks(entry.notes, 60);
          label.push(...noteChunks);
        }

        return label;
      },
      afterLabel: (context) => {
        if (!context) return;
        // Show any top 20 lifts they did today topLiftsByTypeAndReps
        const entry = context.raw;
        let label = generateTopLiftLabelsForDateAndType(
          entry.date,
          entry.liftType,
          topLiftsByTypeAndReps,
        );
        return label;
      },
      footer: (context) => {
        if (!context) return;
        const entry = context[0].raw; // Because the footer context is a different format to label
        const url = entry.URL;
        if (url && !isMobile) return `Click to open ${url.substring(0, 15)}...`; // Tooltip reminder they can click to open video
      },
    },
  };
};

// Helper function to split lines for tooltip labels
function splitIntoChunks(text, maxChunkSize) {
  let chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + maxChunkSize, text.length);
    let chunk = text.substring(startIndex, endIndex);
    chunks.push(chunk);
    startIndex += maxChunkSize;
  }

  return chunks;
}

// Helper function to list any top lifts in the tooltip label
function generateTopLiftLabelsForDateAndType(
  date,
  liftType,
  topLiftsByTypeAndReps,
) {
  let labels = []; // Initialize labels array

  // Check if the lift type exists in the data structure
  if (topLiftsByTypeAndReps[liftType]) {
    // Iterate through all rep schemes for the given lift type
    for (let repScheme of topLiftsByTypeAndReps[liftType]) {
      // Iterate through lifts in each rep scheme
      for (let i = 0; i < repScheme.length; i++) {
        let lift = repScheme[i];
        if (lift.date === date) {
          // Create and add label for the lift
          let label = `#${i + 1} best ${liftType} ${lift.reps}RM of all time (${
            lift.reps
          }@${lift.weight}${lift.unitType})`;
          labels.push(label);
        }
      }
    }
  }

  return labels; // Return the array of labels
}
