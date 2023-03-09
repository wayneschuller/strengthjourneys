/** @format */

import Box from "@mui/material/Box";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";

export function LiftingCalendarHeatmap(props) {
  if (!props.analyzerData) return;
  const analyzerData = props.analyzerData;
  const startDate = props.startDate;
  const endDate = props.endDate;

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
