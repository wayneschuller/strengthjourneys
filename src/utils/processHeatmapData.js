/** @format */

export function processHeatmapData(parsedData) {
  let heatmapData = {};
  const values = [];

  // Loop through parsedData and record activity for the heatmap
  let prevDate = null;
  parsedData.forEach((lift) => {
    if (lift.date !== prevDate) {
      values.push({ date: lift.date, count: 1 });
      prevDate = lift.date; // Skip the next lift if it's on the same day
    }
  });

  heatmapData.values = values;
  heatmapData.startDate = parsedData[parsedData.length - 1].date;
  heatmapData.endDate = parsedData[0].date;

  return heatmapData;
}
