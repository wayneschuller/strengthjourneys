/** @format */

export function processHeatmapData(parsedData, processedData) {
  const heatmapData = [];

  // Loop through parsedData and record activity for the heatmap
  let prevDate = null;
  parsedData.forEach((lift) => {
    if (lift.date !== prevDate) {
      heatmapData.push({ date: lift.date, count: 1 });
      prevDate = lift.date; // Skip the next lift if it's on the same day
    }
  });

  return heatmapData;
}
