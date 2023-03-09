/** @format */

import Box from "@mui/material/Box";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";

export function LiftingCalendarHeatmap(props) {
  if (!props.analyzerData) return;
  const analyzerData = props.analyzerData;

  console.log(`<LiftingCalendarHeatmap />... analyzerData.heatmapData:`);
  console.log(analyzerData.heatmapData);

  // FIXME: can we use MUI transitions to slide in/out?
  return (
    <>
      <Box sx={{ m: 3, width: "90%" }} color="secondary">
        <CalendarHeatmap
          startDate={analyzerData.heatmapData.startDate}
          endDate={analyzerData.heatmapData.endDate}
          showOutOfRangeDays={true}
          showWeekdayLabels={false}
          showMonthLabels={false}
          values={analyzerData.heatmapData.values}
        />
      </Box>
    </>
  );
}
