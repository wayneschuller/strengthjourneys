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
          startDate={new Date("2016-01-01")}
          endDate={new Date("2016-04-01")}
          values={[
            { date: "2016-01-01", count: 12 },
            { date: "2016-01-22", count: 12 },
            { date: "2016-02-30", count: 38 },
            { date: "2016-03-30", count: 38 },
            // ...and so on
          ]}
        />
      </Box>
    </>
  );
}
