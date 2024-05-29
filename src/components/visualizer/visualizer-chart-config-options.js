import { estimateE1RM } from "@/lib/estimate-e1rm";

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
