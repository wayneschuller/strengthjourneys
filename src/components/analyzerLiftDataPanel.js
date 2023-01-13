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
          <LiftOverviewCard liftType={liftType} index={index} analyzerData={analyzerData} />
          <Masonry columns={2} spacing={2} sx={{}}>
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

function LiftOverviewCard({ liftType, index, analyzerData }) {
  if (!analyzerData) return;
  if (!analyzerData.analyzerPRCardData[liftType]) return;

  // console.log(analyzerData);

  const sessions = analyzerData.analyzerPRCardData[liftType].sessions;
  const firstLift = analyzerData.analyzerPRCardData[liftType].firstLift;
  const liftColor = analyzerData.analyzerPieData[index].backgroundColor;

  let firstDateString = getReadableDataString(firstLift.x);

  return (
    <>
      <Card
        variant="filled"
        sx={{ backgroundColor: liftColor, color: "white", border: "2px solid grey", borderRadius: "10px" }}
      >
        {/* <CardHeader title={liftType} /> */}
        <CardContent>
          <Typography variant="h4">{liftType}</Typography>
          <Typography variant="h5">Overview</Typography>
          <Typography variant="body1">
            <b>{sessions}</b> of your lifting sessions included a {liftType}.
          </Typography>
          <Typography variant="body1">
            Your first recorded {liftType} was on {firstDateString}.
          </Typography>
          {analyzerData.analyzerPRCardData[liftType].recentHighlights && (
            <RecentHighlights liftType={liftType} analyzerData={analyzerData} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function RecentHighlights({ liftType, analyzerData }) {
  // If there are no recent highlights, tell them the last time they lifted this lift type

  if (analyzerData.analyzerPRCardData[liftType].recentHighlights.length === 0) {
    let lastLift = analyzerData.analyzerPRCardData[liftType].lastLift;
    let dateString = getReadableDataString(lastLift.x);
    let elapsedString = getReadableTimeElapsed(lastLift.x);

    if (!lastLift) return <></>;
    else
      return (
        <>
          <Typography variant="body1">
            It has been {elapsedString} since your last {liftType}, which was{" "}
            <b>
              {lastLift.reps}@{lastLift.weight}
              {lastLift.unitType}
            </b>{" "}
            on {dateString}.
          </Typography>
        </>
      );
  }

  // Give them encouraging highlights from the last month
  return (
    <>
      <Typography variant="h6">Recent {liftType} highlights in the last month:</Typography>

      {analyzerData.analyzerPRCardData[liftType].recentHighlights.map((highlight, index) => (
        <Typography variant="body2" key={highlight}>
          {highlight}
        </Typography>
      ))}
    </>
  );
}
function PRCard({ liftType, reps, analyzerData }) {
  if (!analyzerData.analyzerPRCardData[liftType]) return;
  if (!analyzerData.analyzerPRCardData[liftType].repPRLifts) return;
  if (!analyzerData.analyzerPRCardData[liftType].repPRLifts[reps]) return;
  let prTuple = analyzerData.analyzerPRCardData[liftType].repPRLifts[reps][0];
  let resultText = "";
  let isFound = false;
  let isUrl = false;
  let dateString = "";

  if (!prTuple) return <></>;

  if (prTuple) {
    isFound = true;
    dateString = getReadableDataString(prTuple.date);

    resultText = `${reps}@${prTuple.weight}${prTuple.unitType} (${dateString})`;
    if (prTuple.url && prTuple.url !== "") {
      isUrl = true;
    }
  }

  return (
    <Card variant="filled" sx={{ backgroundColor: "grey", color: "white", border: "1px solid black" }}>
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

// Convert ISO "YYYY-MM-DD" to readable date string
function getReadableDataString(ISOdate) {
  let date = new Date(ISOdate);
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

  let dateString = `${day} ${month}, ${year}`;
  return dateString;
}

function getReadableTimeElapsed(ISODate) {
  let currentDate = new Date();
  let previousDate = new Date(ISODate);
  let timeDiff = Math.abs(currentDate.getTime() - previousDate.getTime());

  let diffDays = Math.floor(timeDiff / (1000 * 3600 * 24));
  let diffMonths = Math.floor(diffDays / 30);
  let diffYears = (diffMonths / 12).toFixed(1);

  if (diffYears > 1) {
    return diffYears + " years";
  } else if (diffMonths > 1) {
    return diffMonths + " months";
  } else {
    return diffDays + " days";
  }
}
