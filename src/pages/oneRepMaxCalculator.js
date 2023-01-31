/** @format */

import { useState, useEffect } from "react";

import Slider from "@mui/material/Slider";
import { styled } from "@mui/material/styles";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Unstable_Grid2";
import MuiInput from "@mui/material/Input";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Zoom from "@mui/material/Zoom";

import { EmailShareButton, FacebookShareButton, RedditShareButton, TwitterShareButton } from "react-share";

import { EmailIcon, FacebookIcon, RedditIcon, TwitterIcon } from "react-share";

import { estimateE1RM } from "../utils/estimateE1RM";

const Input = styled(MuiInput)`
  width: 5rem; // Goal is to have 4 digits in weight input - 3 plus one decimal digit
`;

// Taken from https://mui.com/material-ui/react-grid2/
const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: theme.palette.text.secondary,
}));

export default function OneRepMaxCalculator() {
  // Get some initial values from any browser localstorage
  let initReps = localStorage.getItem("calcReps");
  initReps = initReps ? parseInt(initReps) : 5;

  let initWeight = localStorage.getItem("calcWeight");
  initWeight = initWeight ? parseFloat(initWeight) : 225;

  let initIsMetric = localStorage.getItem("calcIsMetric");
  initIsMetric = initIsMetric === "true"; // boolean is true if string is "true" otherwise false

  const [reps, setReps] = useState(initReps);
  const [weight, setWeight] = useState(initWeight);
  const [isMetric, setMetric] = useState(initIsMetric);

  // useEffect when state changes put key variables in localStorage so we can default to them next time
  useEffect(() => {
    localStorage.setItem("calcReps", reps);
    localStorage.setItem("calcWeight", weight);
    localStorage.setItem("calcIsMetric", isMetric);
  }, [weight, reps, isMetric]);

  const handleRepsSliderChange = (event, newValue) => {
    setReps(newValue);
  };

  const handleWeightSliderChange = (event, newValue) => {
    let newWeight = newValue;

    if (isMetric) {
      newWeight = 2.5 * Math.ceil(newWeight / 2.5); // For kg only allow nice multiples of 2.5kg
    } else {
      newWeight = 5 * Math.ceil(newWeight / 5); // For lb only allow nice multiples of 5lb
    }

    setWeight(newWeight);
  };

  // User can use the input to set an exact figure, integer or decimal
  const handleWeightInputChange = (event) => {
    if (event.target.value) setWeight(event.target.value);
  };

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
  const url = "https://www.strengthjourneys.xyz/calculator";
  const title = "Helpful one rep max utility calculator with multiple equations";

  return (
    <div>
      <Box sx={{ m: 1 }} md={{ m: 3 }}>
        <Zoom in={true}>
          <Container
            maxWidth="xl"
            sx={{ borderRadius: "6px", border: "1px solid grey", backgroundColor: "palette.secondary.light" }}
          >
            <Grid container spacing={2} display="flex" justifyContent="center" alignItems="center">
              <Grid xs={12}>
                <h2>E1RM One Rep Max Calculator</h2>
                Estimate your max single based on reps and weight (see{" "}
                <a href="https://en.wikipedia.org/wiki/One-repetition_maximum" target="_blank" rel="noreferrer">
                  Wikipedia article
                </a>{" "}
                for theory)
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
                <Weight value={weight} isMetric={isMetric} onChange={handleWeightSliderChange} />
              </Grid>
              <Grid xs={3} md={2}>
                <Input
                  value={weight}
                  size="small"
                  type="number"
                  onChange={handleWeightInputChange}
                  endAdornment={isMetric ? "kg" : "lb"}
                />
              </Grid>

              <Grid xs={2} md={3}>
                {" "}
              </Grid>
              <Grid xs={8} md={6}>
                <Item elevation={4}>
                  <h2>
                    Estimated One Rep Max: {estimateE1RM(reps, weight, "Brzycki")}
                    {isMetric ? "kg" : "lb"}
                  </h2>{" "}
                  (Brzycki formula)
                </Item>
              </Grid>
              <Grid xs={2} md={3}>
                <Chip label="lb" color={isMetric ? "default" : "primary"} onClick={onUnitClick} />
                <Chip label="kg" color={isMetric ? "primary" : "default"} onClick={onUnitClick} />
              </Grid>

              <Grid xs={6} md={2}>
                <Item elevation={2}>
                  Epley: {estimateE1RM(reps, weight, "Epley")}
                  {isMetric ? "kg" : "lb"}
                </Item>
              </Grid>
              <Grid xs={6} md={2}>
                <Item elevation={2}>
                  McGlothin: {estimateE1RM(reps, weight, "McGlothin")}
                  {isMetric ? "kg" : "lb"}
                </Item>
              </Grid>
              <Grid xs={6} md={2}>
                <Item elevation={2}>
                  Lombardi: {estimateE1RM(reps, weight, "Lombardi")}
                  {isMetric ? "kg" : "lb"}
                </Item>
              </Grid>
              <Grid xs={6} md={2}>
                <Item elevation={2}>
                  Mayhew et al.: {estimateE1RM(reps, weight, "Mayhew")}
                  {isMetric ? "kg" : "lb"}
                </Item>
              </Grid>
              <Grid xs={6} md={2}>
                <Item elevation={2}>
                  O'Conner et al.: {estimateE1RM(reps, weight, "OConner")}
                  {isMetric ? "kg" : "lb"}
                </Item>
              </Grid>
              <Grid xs={6} md={2}>
                <Item elevation={2}>
                  Wathen: {estimateE1RM(reps, weight, "Wathen")}
                  {isMetric ? "kg" : "lb"}
                </Item>
              </Grid>

              <Grid xs={12} md={12}>
                {" "}
              </Grid>
              <Grid xs={12} md={12}>
                {" "}
                <Divider />{" "}
              </Grid>
              <Grid xs={12} md={12}>
                {" "}
              </Grid>
              <Grid xs={12} md={12}>
                {" "}
              </Grid>

              <Grid xs={8} md={8}>
                Please give us feedback!{" "}
                <a href="mailto:feedback@onerepmaxcalculator.xyz">feedback@onerepmaxcalculator.xyz</a>
                <a href="mailto:info@strengthjourneys.xyz">info@strengthjourneys.xyz</a>
              </Grid>
              <Grid xs={4} md={4}>
                {/* Sharing is caring. */}
              </Grid>

              <Grid xs={7} md={9}>
                May you be harder to kill and more useful in general.
              </Grid>
              <Grid xs={5} md={3}>
                <EmailShareButton url={url} subject={title}>
                  {" "}
                  <EmailIcon size={32} round />{" "}
                </EmailShareButton>
                <FacebookShareButton url={url}>
                  <FacebookIcon size={32} round />
                </FacebookShareButton>
                <RedditShareButton url={url} title={title}>
                  <RedditIcon size={32} round />
                </RedditShareButton>
                <TwitterShareButton url={url}>
                  <TwitterIcon size={32} round />
                </TwitterShareButton>
              </Grid>

              <Grid xs={12} md={12}>
                {" "}
              </Grid>
            </Grid>
          </Container>
        </Zoom>
      </Box>
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
};

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
};
