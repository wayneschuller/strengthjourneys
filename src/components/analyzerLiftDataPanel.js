/** @format */

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Masonry from "@mui/lab/Masonry";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";

// Taken from https://mui.com/material-ui/react-grid2/
const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: theme.palette.text.secondary,
}));

export const LiftDataPanel = (props) => {
  // console.log(`LiftDataPanel... `);

  if (!props.selectedLift) return;

  const liftType = props.selectedLift.liftType;
  const index = props.selectedLift.index;
  const parsedData = props.parsedData;
  const visualizerData = props.visualizerData;
  const analyzerData = props.analyzerData;
  const checked = props.checked;

  return (
    <>
      {/* <Item elevation={0} sx={{ backgroundColor: "#dddd99" }}> */}
      {/* <Box sx={{ width: 500, minHeight: 377 }}> */}
      <Box>
        <Stack spacing={1}>
          <LiftOverviewCard liftType={liftType} analyzerData={analyzerData} />
          <Masonry columns={3} spacing={1}>
            <PRCard liftType={liftType} reps={1} analyzerData={analyzerData} />
            <PRCard liftType={liftType} reps={2} analyzerData={analyzerData} />
            <PRCard liftType={liftType} reps={3} analyzerData={analyzerData} />
            <PRCard liftType={liftType} reps={4} analyzerData={analyzerData} />
            <PRCard liftType={liftType} reps={5} analyzerData={analyzerData} />
            <PRCard liftType={liftType} reps={6} analyzerData={analyzerData} />
            <PRCard liftType={liftType} reps={7} analyzerData={analyzerData} />
            <PRCard liftType={liftType} reps={8} analyzerData={analyzerData} />
            <PRCard liftType={liftType} reps={9} analyzerData={analyzerData} />
            <PRCard liftType={liftType} reps={10} analyzerData={analyzerData} />
          </Masonry>
        </Stack>
      </Box>
      {/* </Item> */}
    </>
  );
};

function LiftOverviewCard({ liftType, analyzerData }) {
  if (!analyzerData) return;
  if (!analyzerData.analyzerPRCardData[liftType]) return;

  const sessions = analyzerData.analyzerPRCardData[liftType].sessions;
  const firstLift = analyzerData.analyzerPRCardData[liftType].firstLift;

  return (
    <>
      <Card variant="filled" sx={{ backgroundColor: "Brown", color: "white", m: 2 }}>
        <CardHeader title={liftType} subheader="Overview" />
        <CardContent>
          <p>
            <b>{sessions}</b> sessions
          </p>
          <p>
            First {liftType}: {firstLift}
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function ButtonLink({ text, url }) {
  return (
    <Link
      component="button"
      variant="body2"
      onClick={() => {
        window.open(url);
      }}
    >
      {text}
    </Link>
  );
}

function PRCard({ liftType, reps, analyzerData }) {
  if (!analyzerData.analyzerPRCardData[liftType]) return;
  if (!analyzerData.analyzerPRCardData[liftType].repMaxPRs) return;
  if (!analyzerData.analyzerPRCardData[liftType].repMaxPRs[reps]) return;
  let prTuple = analyzerData.analyzerPRCardData[liftType].repMaxPRs[reps][0];
  let resultText = "";
  let isFound = false;
  let isUrl = false;
  let dateString = "";

  if (!prTuple) return <></>;

  if (prTuple) {
    isFound = true;
    let date = new Date(prTuple.date);
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    dateString = `${day} ${month}, ${year}`;

    resultText = `${reps}@${prTuple.weight}${prTuple.unitType} (${dateString})`;
    if (prTuple.url && prTuple.url !== "") {
      isUrl = true;
    }
  }

  return (
    <Card variant="filled" sx={{ backgroundColor: "grey", color: "white", mx: 1 }}>
      <CardContent>
        <Typography variant="h4" color="text.primary" gutterBottom>
          {reps} Rep Max
        </Typography>
        <Typography variant="h5" component="div">
          {prTuple.weight}
          {prTuple.unitType}
        </Typography>
        <Typography sx={{ mb: 1.5 }} color="text.secondary">
          {dateString}
        </Typography>
      </CardContent>
      {isUrl && (
        <CardActions sx={{ backgroundColor: "black" }}>
          <Button
            size="small"
            sx={{ color: "white" }}
            onClick={() => {
              window.open(prTuple.url);
            }}
          >
            Watch Video
          </Button>
        </CardActions>
      )}
    </Card>
  );
}
