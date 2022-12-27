import * as React from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

// --------------------------------------------------------------------------------------------------------
// <ChartControls />
// --------------------------------------------------------------------------------------------------------
export default function ChartControls (props) {
  return (
    <div>
     <Box sx={{ m: 1 }} md={{ m: 3}} >
       <Container maxWidth="xl" sx={{ borderRadius: '6px', border: '1px solid grey', backgroundColor: 'palette.secondary.light' }}>
        <Typography  component="h2" gutterBottom><b>Chart Controls</b></Typography>

      <Divider />
      <VizConfigPRs />
      <Divider />
      <VizConfigZoom />
      <Divider />
      <VizConfigEquation />
      <Divider />
      <VizConfigLiftChooser />
      <Divider />

      </Container>
      </Box>
    </div>
  );
}



// --------------------------------------------------------------------------------------------------------
// <VizConfigLiftChooser />
// --------------------------------------------------------------------------------------------------------

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 50,
    },
  },
};

const names = [
  'Back Squat',
  'Deadlift',
  'Bench Press',
  'Strict Press',
];

function VizConfigLiftChooser() {
  const [personName, setPersonName] = React.useState([]);

  const handleChange = (event) => {
    const {
      target: { value },
    } = event;
    setPersonName(
      // On autofill we get a stringified value.
      typeof value === 'string' ? value.split(',') : value,
    );
  };

  return (
    <div>
      <FormControl sx={{ m: 1, width: 200 }}>
        <InputLabel id="demo-multiple-checkbox-label">Lift Types</InputLabel>
        <Select
          labelId="demo-multiple-checkbox-label"
          id="demo-multiple-checkbox"
          multiple
          value={personName}
          onChange={handleChange}
          input={<OutlinedInput label="Lift Types" />}
          renderValue={(selected) => selected.join(', ')}
          MenuProps={MenuProps}
        >
          {names.map((name) => (
            <MenuItem key={name} value={name}>
              <Checkbox checked={personName.indexOf(name) > -1} />
              <ListItemText primary={name} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
}

// --------------------------------------------------------------------------------------------------------
// <VizConfigPRs />
// --------------------------------------------------------------------------------------------------------

function VizConfigPRs() {
  const [checked, setChecked] = React.useState(true);

  const handleChange = (event) => {
    setChecked(event.target.checked);
    console.log(`show PRs or not`);
  };

  return (
    <FormGroup>
     <FormLabel id="VizConfigPRs">Achievements</FormLabel>
    <FormControlLabel control={<Switch checked={checked} onChange={handleChange} />} label="Show PRs" />
  </FormGroup>
  );
}

// --------------------------------------------------------------------------------------------------------
// <VizConfigZoom />
// --------------------------------------------------------------------------------------------------------
function VizConfigZoom() {
  const [value, setValue] = React.useState('Show Recent');

  const handleChange = (event) => {
    setValue(event.target.value);
  };

  return (
    <FormControl>
      <FormLabel id="VizConfigZoom">Zoom</FormLabel>
      <RadioGroup
        aria-labelledby="VizConfigZoom"
        name="VizConfigZoom"
        value={value}
        onChange={handleChange}
      >
        <FormControlLabel value="Show Recent" control={<Radio />} label="Show Recent" />
        <FormControlLabel value="Show All" control={<Radio />} label="Show All" />
      </RadioGroup>
    </FormControl>
  );
}

// --------------------------------------------------------------------------------------------------------
// <VizConfigEquation />
// --------------------------------------------------------------------------------------------------------
function VizConfigEquation() {
  const [value, setValue] = React.useState('Bryzcki');

  const handleChange = (event) => {
    setValue(event.target.value);
  };

  const equations = [
  "Epley",
  "McGlothin",
  "Lombardi",
  "Mayhew",
  "OConner",
  "Wathen",
  "Brzycki",
  ];


  return (
    <FormControl>
      <FormLabel id="demo-controlled-radio-buttons-group">Equation</FormLabel>
      <RadioGroup
        aria-labelledby="demo-controlled-radio-buttons-group"
        name="controlled-radio-buttons-group"
        value={value}
        onChange={handleChange}
      >
          {equations.map((equation) => ( <FormControlLabel value={equation} control={<Radio />} label={equation} />))}
      </RadioGroup>
    </FormControl>
  );
}