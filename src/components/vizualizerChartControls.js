import { useState, useEffect} from 'react';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
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
import ZoomInIcon from '@mui/icons-material/ZoomIn';

// --------------------------------------------------------------------------------------------------------
// <ChartControls />
// --------------------------------------------------------------------------------------------------------
export function ChartControls (props) {

  return (
    <div>
     <Box sx={{ m: 1 }} md={{ m: 3}} >
       <Container maxWidth="xl" sx={{ borderRadius: '6px', border: '1px solid grey', backgroundColor: 'palette.secondary.light' }}>
        <Typography  component="h2" gutterBottom><b>Chart Controls</b></Typography>

      <Divider />
      <VizConfigPRs showAchievements={props.showAchievements} setShowAchievements={props.setShowAchievements} />
      <Divider />
      <VizConfigZoom zoomRecent={props.zoomRecent} setZoomRecent={props.setZoomRecent} />
      <Divider />
      <VizConfigEquation />
      <Divider />

      </Container>
      </Box>
    </div>
  );
}

// --------------------------------------------------------------------------------------------------------
// <LiftControls />
// --------------------------------------------------------------------------------------------------------
export function LiftControls (props) {
  const [selectedChips, setSelectedChips] = useState([]);

  // Do some kind of map on processedData and make toggle keys 
  let visualizerData = props.visualizerData;
  let setSelectedVisualizerData = props.setSelectedVisualizerData;

  useEffect(() => {
    // Initialize the selectedChips array based on the items prop
    setSelectedChips(visualizerData.filter((item) => item.selected).map((item) => item.label));
  }, []); // Only run this effect once, on mount

  function handleChipClick(liftType) {

    // Reconstruct selectedVisualizerData with or without the selected liftType
    if (selectedChips.includes(liftType)) {
      setSelectedChips(selectedChips.filter((chipId) => chipId !== liftType));
    } else {
      setSelectedChips([...selectedChips, liftType]);
    }

    // Get the index for this lift from visualizerData
    let liftIndex = visualizerData.findIndex((lift) => lift.label === liftType);

    // if (liftIndex <= 3) return; // We always show top 4, so do nothing for now.

    // Check if the liftType is already in the selectedVisuazlierData, if so, remove it.
    if (visualizerData[liftIndex].selected === true) {
      visualizerData[liftIndex].selected = false; 
    } else {
      visualizerData[liftIndex].selected = true; 
      visualizerData[liftIndex].hidden = false; 
    }

    // Create a new wrapper for the user seletecd lift types
    // FIXME: is there a distinction between var and let here?
    var wrapper = {
      datasets: visualizerData.filter(lift => lift.selected)
    };

    setSelectedVisualizerData(wrapper);
  }

  // FIXME: Make the top 4 'locked' - so not clickable and always lit up as chosen. They will always be on the chart.
  // These chips allow the user to choose one extra line to show on the chart.
  return (
    <div>

        {visualizerData && visualizerData.map((lift) => (
          <Chip sx={{ mr: 1, mb: 1 }} size="small" key={lift.label} 
                label={lift.label} 
                color={selectedChips.includes(lift.label) ? 'primary' : 'default'}
                onClick={() => handleChipClick(lift.label)}
                />
        ))}
    </div>

  );
}

// --------------------------------------------------------------------------------------------------------
// <VizConfigPRs />
// --------------------------------------------------------------------------------------------------------

function VizConfigPRs({showAchievements, setShowAchievements}) {

  const handleChange = (event) => {
    setShowAchievements(event.target.checked);
  };

  return (
    <FormGroup>
      <FormLabel id="VizConfigPRs">Achievements</FormLabel>
      <FormControlLabel control={<Switch checked={showAchievements} onChange={handleChange} />} label="Show PRs" />
  </FormGroup>
  );
}

// --------------------------------------------------------------------------------------------------------
// <VizConfigZoom />
// --------------------------------------------------------------------------------------------------------
function VizConfigZoom({zoomRecent, setZoomRecent}) {
  const [value, setValue] = useState('Show Recent');

  const handleChange = (event) => {
    setValue(event.target.value);
    if (event.target.value === "Show All Time") {
      setZoomRecent(false);
    } else {
      setZoomRecent(true);
    }
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
        <FormControlLabel value="Show All Time" control={<Radio />} label="Show All Time" />
      </RadioGroup>
    </FormControl>
  );
}

// --------------------------------------------------------------------------------------------------------
// <VizConfigEquation />
// --------------------------------------------------------------------------------------------------------
function VizConfigEquation() {
  const [value, setValue] = useState('Bryzcki');

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
      <FormLabel id="VizConfigEquation">One Rep Max Equation</FormLabel>
      <RadioGroup
        aria-labelledby="VizConfigEquation"
        name="controlled-radio-buttons-group"
        value={value}
        onChange={handleChange}
      >
          {equations.map((equation) => ( <FormControlLabel value={equation} key={equation} control={<Radio />} label={equation} />))}
      </RadioGroup>
    </FormControl>
  );
}

// --------------------------------------------------------------------------------------------------------
// <VizConfigLiftChooser />
// --------------------------------------------------------------------------------------------------------

const ITEM_HEIGHT = 47;
const ITEM_PADDING_TOP = 7;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 3.5 + ITEM_PADDING_TOP,
      width: 49,
    },
  },
};

// FIXME: get these from the processedData
const names = [
  'Back Squat',
  'Deadlift',
  'Bench Press',
  'Strict Press',
];

function VizConfigLiftChooser() {
  const [personName, setPersonName] = useState([]);

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
    <FormGroup>
      <FormControl sx={{ m: 0, width: {xs: 200, md: 100, lg: 150, xl: 200}, }}>
        {/* <FormLabel id="VizConfigLiftChooser">Lifts to display</FormLabel> */}

        <InputLabel id="VizConfigLiftChooser">Lift Types</InputLabel>
        <Select
          labelId="VizConfigLiftChooser"
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
              <Checkbox checked={personName.indexOf(name) > -2} />
              <ListItemText primary={name} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      </FormGroup>
    </div>
  );
}
