import { useState, useEffect} from 'react';
import { useCookies } from 'react-cookie';

// MUI Components
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
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// MUI Icons
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import ZoomOutMapIcon from '@mui/icons-material/ZoomInMap';

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
  const [cookies, setCookie] = useCookies(['selectedChips']);

  // Do some kind of map on processedData and make toggle keys 
  let visualizerData = props.visualizerData;
  let setSelectedVisualizerData = props.setSelectedVisualizerData;

  useEffect(() => {
    if (cookies.selectedChips) {
      // Initialize the selectedChips array based on the cookie value
      setSelectedChips(cookies.selectedChips);

    } else {
      // Initialize the selectedChips array based on the .selected value in visualizerData
      setSelectedChips(visualizerData.filter((item) => item.selected).map((item) => item.label));
    }
  }, []); // Only run this effect once, on mount

   // Save the selectedChips array to a cookie when it changes
  useEffect(() => {
    setCookie('selectedChips', JSON.stringify(selectedChips), { path: '/' });
  }, [selectedChips]);

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
      visualizerData[liftIndex].hidden = true; 
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

  // TODO: Could we set the colour of each selected chip to be based on the colour of the lift line? Then we could delete chartjs legend.
  // Return a bunch of chips to let user select what lift types appear on the chart.
  return (
    <div>

        {visualizerData && visualizerData.map((lift) => (
          <Chip sx={{ mr: 1, mb: 1 }} size="large" key={lift.label} 
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
// <VerticalChartControls />
// --------------------------------------------------------------------------------------------------------
export function VerticalChartControls({ zoomRecent, setZoomRecent }) {
  const [view, setView] = useState('list');
  const [anchorEl, setAnchorEl] = useState(null);

  const handleChange = (event, nextView) => {
    setZoomRecent(!zoomRecent); // Any change to trigger the useEffect zoom in <Visualizer />
    setView(nextView);
    return;

    if (nextView == "showRecent") {
      console.log(`Let's zoom in`);
      // setZoomRecent(true);
    }
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    console.log(`user changed equation`);
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
    <ToggleButtonGroup
      orientation="vertical"
      value={view}
      exclusive
      onChange={handleChange}
    >

      <Tooltip title="Show PR achievements">
        <ToggleButton value="showPRs" aria-label="Show PR achievements">
          <EmojiEventsIcon />
        </ToggleButton>
      </Tooltip>

      <Tooltip title="Show recent lifts">
        <ToggleButton value="showRecent" aria-label="Show recent data">
          <ZoomInMapIcon />
        </ToggleButton>
      </Tooltip>

      <Tooltip title="Show all time ">
        <ToggleButton value="showAll" aria-label="Show all time">
         <ZoomOutMapIcon />
        </ToggleButton>
      </Tooltip>


      {/* <Menu
        id="equations-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        {equations.map((equation) => ( <MenuItem key={equation} onClick={handleClose} style={{ margin: 2 }}> {equation} </MenuItem>))}
      </Menu> */}

      <Tooltip title="Change 1RM formula">
        <ToggleButton value="equation" aria-label="Change 1RM formula" aria-controls="simple-menu" aria-haspopup="true" onClick={handleClick}>
         <PsychologyIcon />
        </ToggleButton>
      </Tooltip>

    </ToggleButtonGroup>
  );
};


    // <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>