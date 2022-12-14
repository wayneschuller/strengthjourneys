import { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';

import Slider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Unstable_Grid2';
import MuiInput from '@mui/material/Input';
import Divider from '@mui/material/Divider';

import {
  EmailShareButton,
  FacebookShareButton,
  RedditShareButton,
  TwitterShareButton,
} from 'react-share';

import {
  EmailIcon,
  FacebookIcon,
  RedditIcon,
  TwitterIcon,
} from "react-share";

const Input = styled(MuiInput)`
  width: 5rem;  // Goal is to have 4 digits in weight input - 3 plus one decimal digit
`;

// Taken from https://mui.com/material-ui/react-grid2/
const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

const OneRepMaxCalculator = () => {

  const [cookies, setCookie] = useCookies(['reps', 'weight', 'isMetric']);

  // Get some initial values from any cookies.
  let initReps = (cookies.reps === undefined) ? 5 : parseInt(cookies.reps);
  let initWeight = (cookies.weight === undefined) ? 225 : parseFloat(cookies.weight);
  let initIsMetric = (cookies.isMetric === "true"); // boolean is true if string is "true" otherwise false

  const [reps, setReps] = useState(initReps);
  const [weight, setWeight] = useState(initWeight);
  const [isMetric, setMetric] = useState(initIsMetric); 

  // useEffect when state changes put key variables in cookies so we can default to them next time
  useEffect(() => {
    let d = new Date(); d.setTime(d.getTime() + (365*24*60*60*1000)); // 365 days from now
    setCookie('reps', reps, { path: '/', expires: d });
    setCookie('weight', weight, { path: '/', expires: d });
    setCookie('isMetric', isMetric, { path: '/', expires: d });
  }, [weight, reps, isMetric, setCookie])

  const handleRepsSliderChange = (event, newValue) => {
    setReps(newValue);
  };

  const handleWeightSliderChange = (event, newValue) => {
    let newWeight = newValue;

    if (isMetric) {
      newWeight = 2.5 * Math.ceil(newWeight/2.5);  // For kg only allow nice multiples of 2.5kg
    } else {
      newWeight = 5 * Math.ceil(newWeight/5);  // For lb only allow nice multiples of 5lb
    }

    setWeight(newWeight);
  };

  // User can use the input to set an exact figure, integer or decimal
  const handleWeightInputChange = (event) => {
    if (event.target.value) setWeight(event.target.value);
  }

  // Called when they click on one of the 'lb' or 'kg' chips to change units
  const onUnitClick = (event) => {
    if (isMetric) {
      // Going from kg to lb
      setWeight(Math.round(weight * 2.2046)); 
      setMetric(false);
    } else {
      // Going from lb to kg 
      setWeight(Math.round(weight / 2.2046)); 
      setMetric(true);
    }
  };

  // Used for share buttons
  const url = "https://www.onerepmaxcalculator.xyz"; 
  const title = "Helpful one rep max utility calculator with multiple equations"; 

  return (
    <div>
    <Grid container spacing={2} display="flex" justifyContent="center" alignItems="center">

      <Grid xs={12}>
        <h2>E1RM One Rep Max Calculator</h2>
        Estimate your max single based on reps and weight (see <a href="https://en.wikipedia.org/wiki/One-repetition_maximum" target="_blank" rel="noreferrer">Wikipedia article</a> for theory)
      </Grid>

      <Grid xs={2} md={1}>
        Reps:
      </Grid>
      <Grid xs={8} md={9}>
        <Reps value={reps} onChange={handleRepsSliderChange} />
      </Grid>
      <Grid xs={2} md={2}>
        {reps} 
      </Grid>

      <Grid xs={12} md={1}>
        Weight:
      </Grid>
      <Grid xs={9} md={9}>
        <Weight value={weight} isMetric={isMetric} onChange={handleWeightSliderChange}/>
      </Grid>
      <Grid xs={3} md={2}>
        <Input value={weight} size='small' type='number' onChange={handleWeightInputChange} endAdornment={isMetric ? 'kg' : 'lb'} />
      </Grid>

      <Grid xs={2} md={3}> </Grid>
      <Grid xs={8} md={6}>
        <Item elevation={4}><h2>Estimated One Rep Max: {estimateE1RM(reps, weight, "Brzycki")}{isMetric ? 'kg' : 'lb'}</h2> (Brzycki formula)</Item>
      </Grid>
      <Grid xs={2} md={3}>
        <Chip label="lb" color={isMetric ? "default" : "primary"} onClick={onUnitClick} />
        <Chip label="kg" color={isMetric ? "primary" : "default"} onClick={onUnitClick} />
      </Grid>

      <Grid xs={6} md={2}> 
        <Item elevation={2}>Epley: {estimateE1RM(reps, weight, "Epley")}{isMetric ? 'kg' : 'lb'}</Item>
      </Grid>
      <Grid xs={6} md={2}> 
        <Item elevation={2}>McGlothin: {estimateE1RM(reps, weight, "McGlothin")}{isMetric ? 'kg' : 'lb'}</Item>
      </Grid>
      <Grid xs={6} md={2}> 
        <Item elevation={2}>Lombardi: {estimateE1RM(reps, weight, "Lombardi")}{isMetric ? 'kg' : 'lb'}</Item>
      </Grid>
      <Grid xs={6} md={2}> 
        <Item elevation={2}>Mayhew et al.: {estimateE1RM(reps, weight, "Mayhew")}{isMetric ? 'kg' : 'lb'}</Item>
      </Grid>
      <Grid xs={6} md={2}> 
        <Item elevation={2}>O'Conner et al.: {estimateE1RM(reps, weight, "OConner")}{isMetric ? 'kg' : 'lb'}</Item>
      </Grid>
      <Grid xs={6} md={2}> 
        <Item elevation={2}>Wathen: {estimateE1RM(reps, weight, "Wathen")}{isMetric ? 'kg' : 'lb'}</Item>
      </Grid>

      <Grid xs={12} md={12}> </Grid>
      <Grid xs={12} md={12}> <Divider /> </Grid>
      <Grid xs={12} md={12}> </Grid>
      <Grid xs={12} md={12}> </Grid>

      <Grid xs={8} md={8}> 
        Please give us feedback! <a href="mailto:feedback@onerepmaxcalculator.xyz">feedback@onerepmaxcalculator.xyz</a> 
      </Grid>
      <Grid xs={4} md={4}> 
        {/* Sharing is caring. */}
      </Grid>
        
      <Grid xs={7} md={9}> 
        May you be harder to kill and more useful in general. 
      </Grid>
      <Grid xs={5} md={3}> 
        <EmailShareButton url={url} subject={title}> <EmailIcon size={32} round /> </EmailShareButton>
        <FacebookShareButton url={url}><FacebookIcon size={32} round /></FacebookShareButton>
        <RedditShareButton url={url} title={title}><RedditIcon size={32} round /></RedditShareButton>
        <TwitterShareButton url={url}><TwitterIcon size={32} round /></TwitterShareButton>
      </Grid>

      <Grid xs={12} md={12}> </Grid>

    </Grid>
    </div>
  );
}

// Reps input component
const Reps = (props) => {
  
  return (
    <div>
    <Slider 
      aria-label="Reps" 
      value={props.value} 
      min={1}
      max={20}
      onChange={props.onChange} 
      valueLabelDisplay="auto" 
    />
    </div>
  );
}

// Weight input component
const Weight = (props) => {
  let max = 600;

  if (props.isMetric) {
    max = 250;
  }

  return (
    <Slider 
      aria-label="Weight" 
      value={props.value} 
      min={1}
      max={max}
      onChange={props.onChange} 
      valueLabelDisplay="auto" 
    />
  );
}



// Return a rounded 1 rep max
// For theory see: https://en.wikipedia.org/wiki/One-repetition_maximum
function estimateE1RM(reps, weight, equation) {

  if (reps === 1) return weight; // Heavy single requires no estimate!

  switch (equation) {
    case "Epley":
      return Math.round(weight * (1 + reps / 30));
    case "McGlothin":
      return Math.round((100 * weight) / (101.3 - 2.67123 * reps));
    case "Lombardi":
      return Math.round(weight * Math.pow(reps, 0.1));
    case "Mayhew":
      return Math.round((100 * weight) / (52.2 + 41.9 * Math.pow(Math.E, -0.055 * reps)));
    case "OConner":
      return Math.round(weight * (1 + reps / 40));
    case "Wathen":
      return Math.round((100 * weight) / (48.8 + 53.8 * Math.pow(Math.E, -0.075 * reps)));
    case "Brzycki":
      return Math.round(weight / (1.0278 - 0.0278 * reps));
    default: // Repeat Brzycki formula as a default here
      return Math.round(weight / (1.0278 - 0.0278 * reps));
  }
}

export default OneRepMaxCalculator;