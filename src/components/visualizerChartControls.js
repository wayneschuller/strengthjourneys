/** @format */

import { useState } from "react";

import { processData } from "../utils/processData";

// MUI Components
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import Grid from "@mui/material/Grid";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";

// MUI Icons
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";

// --------------------------------------------------------------------------------------------------------
// <ChartControls />
// --------------------------------------------------------------------------------------------------------
export function ChartControls(props) {
  // console.log(`<ChartConrols />...`)
  // console.log(props);

  return (
    <div>
      {/* <Box sx={{ m: 1 }} md={{ m: 3}} > */}
      {/* <Container maxWidth="xl" sx={{ borderRadius: '6px', border: '1px solid grey', backgroundColor: 'palette.secondary.light' }}> */}
      <Grid container spacing={2}>
        <Grid item xs={5}>
          {" "}
          <VizConfigZoom zoomShowAllTime={props.zoomShowAllTime} zoomShowRecent={props.zoomShowRecent} />
        </Grid>
        <Grid item xs={7}>
          <EquationChooser
            parsedData={props.parsedData}
            visualizerData={props.visualizerData}
            setVisualizerData={props.setVisualizerData}
            chartUpdate={props.chartUpdate}
          />
        </Grid>
      </Grid>
    </div>
  );
}

// --------------------------------------------------------------------------------------------------------
// <VizConfigZoom />
//
// FIXME: Could we consider hiding these controls until the data is bigger than the screen?
// --------------------------------------------------------------------------------------------------------
export function VizConfigZoom({ zoomShowAllTime, zoomShowRecent }) {
  return (
    <>
      <Stack direction="row" spacing={2}>
        <Button variant="outlined" startIcon={<ZoomInMapIcon />} onClick={zoomShowRecent}>
          Show Recent
        </Button>
        <Button variant="outlined" startIcon={<ZoomOutMapIcon />} onClick={zoomShowAllTime}>
          Show All Time
        </Button>
      </Stack>
    </>
  );
}

// --------------------------------------------------------------------------------------------------------
// <EquationChooser />
// --------------------------------------------------------------------------------------------------------
export function EquationChooser(props) {
  // console.log(`<EquationChooser />`);
  // console.log(props);

  let initEquation = localStorage.getItem("equation");
  if (!initEquation) initEquation = "Brzycki";

  const [value, setValue] = useState(initEquation);

  const equations = ["Epley", "McGlothin", "Lombardi", "Mayhew", "OConner", "Wathen", "Brzycki"];

  const handleChange = (event) => {
    console.log(`setEquation...${event.target.value}`);
    setValue(event.target.value);

    // We were setting equation state which was lifted high
    // But every change triggered a rerender of the chart
    // which in turn triggered a zoom reset which was BAD
    // Instead we mutate visualizerData without telling React
    // setEquation(event.target.value);

    localStorage.setItem("equation", event.target.value);

    // Process the data with the new equation (processer will detect it is a refresh)
    processData(props.parsedData, props.visualizerData, props.setVisualizerData);

    // Refresh the chart
    props.chartUpdate();
  };

  return (
    <FormControl>
      <FormLabel id="demo-row-radio-buttons-group-label">One Rep Max Estimate Formula</FormLabel>
      <RadioGroup value={value} onChange={handleChange} row>
        {equations.map((eqn) => (
          <FormControlLabel value={eqn} key={eqn} control={<Radio />} label={eqn} />
        ))}
      </RadioGroup>
    </FormControl>
  );
}
