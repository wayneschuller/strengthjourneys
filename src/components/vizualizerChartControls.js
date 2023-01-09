import { useState } from 'react';

// MUI Components
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';


// MUI Icons
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';


// --------------------------------------------------------------------------------------------------------
// <ChartControls />
// --------------------------------------------------------------------------------------------------------
export function ChartControls (props) {

  return (
    <div>
     {/* <Box sx={{ m: 1 }} md={{ m: 3}} > */}
       {/* <Container maxWidth="xl" sx={{ borderRadius: '6px', border: '1px solid grey', backgroundColor: 'palette.secondary.light' }}> */}
  <Grid container spacing={2}>
  <Grid item xs={5}> <VizConfigZoom zoomShowAllTime={props.zoomShowAllTime} zoomShowRecent={props.zoomShowRecent}/> 
  </Grid>
  <Grid item xs={7}> 
  <EquationChooser setEquation={props.setEquation} /> 
  </Grid>
</Grid>
    </div>
  );
}

// --------------------------------------------------------------------------------------------------------
// <VizConfigZoom />
// --------------------------------------------------------------------------------------------------------
export function VizConfigZoom({zoomShowAllTime, zoomShowRecent}) {

  return (
    <>
    <Stack direction="row" spacing={2}>
      <Button variant="outlined" startIcon={<ZoomInMapIcon />} onClick={zoomShowRecent}>Show Recent</Button>
      <Button variant="outlined" startIcon={<ZoomOutMapIcon />} onClick={zoomShowAllTime}>Show All Time</Button>
    </Stack>
    </>
  );
}


// --------------------------------------------------------------------------------------------------------
// <EquationChooser />
// --------------------------------------------------------------------------------------------------------
export function EquationChooser({setEquation}) {
  const [value, setValue] = useState('Brzycki');

  console.log(`<EquationChooser />`);
  const equations = [
  "Epley",
  "McGlothin",
  "Lombardi",
  "Mayhew",
  "OConner",
  "Wathen",
  "Brzycki",
  ];

  const handleChange = (event) => {
    console.log(`setEquation...${event.target.value}`);
    setValue(event.target.value);
    setEquation(event.target.value);

    localStorage.setItem('equation', event.target.value);
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