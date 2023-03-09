/** @format */

import Box from "@mui/material/Box";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";

export function LiftingCalendarHeatmap(props) {
  if (!props.analyzerData) return;
  const analyzerData = props.analyzerData;
  let startDate = props.startDate;
  let endDate = props.endDate;

  if (!startDate) startDate = analyzerData.heatmapData.startDate;
  if (!endDate) endDate = analyzerData.heatmapData.endDate;

  // console.log(`<LiftingCalendarHeatmap />... analyzerData.heatmapData:`);
  // console.log(analyzerData.heatmapData);

  return (
    <>
      <Box sx={{ m: 1 }} color="secondary">
        <CalendarHeatmap
          // startDate={analyzerData.heatmapData.startDate}
          // endDate={analyzerData.heatmapData.endDate}
          startDate={startDate}
          endDate={endDate}
          showOutOfRangeDays={false}
          showWeekdayLabels={false}
          showMonthLabels={false}
          values={analyzerData.heatmapData.values}
        />
      </Box>
    </>
  );
}
