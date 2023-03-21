/** @format */
import { forwardRef, useRef } from "react";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";

export const LiftingCalendarHeatmap = (props) => {
  console.log(`<LiftingCalendarHeatmap />... props:`);
  console.log(props);

  if (!props.heatmapData) return;
  const heatmapData = props.heatmapData;
  let startDate = heatmapData.startDate;
  let endDate = heatmapData.endDate;

  // if (!startDate) startDate = analyzerData.heatmapData.startDate;
  // if (!endDate) endDate = analyzerData.heatmapData.endDate;

  return (
    <>
      {/* <Container sx={{ m: 1, height: "200px", overflow: "auto" }} color="secondary"> */}
      <Grid container>
        <Grid lg="12">
          <CalendarHeatmap
            startDate={props.heatmapData.startDate}
            endDate={props.heatmapData.endDate}
            showOutOfRangeDays={false}
            showWeekdayLabels={false}
            showMonthLabels={false}
            values={heatmapData.values}
          />
        </Grid>
      </Grid>
      {/* </Container> */}
    </>
  );
};
