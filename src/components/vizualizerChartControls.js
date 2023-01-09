import { useState, useEffect} from 'react';

// MUI Components
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import SvgIcon from '@mui/material/SvgIcon';


// MUI Icons
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import UnfoldLess from '@mui/icons-material/UnfoldLess';


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