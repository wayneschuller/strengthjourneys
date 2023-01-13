/** @format */

import { useState, useEffect } from "react";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import { styled } from "@mui/material/styles";

// Taken from https://mui.com/material-ui/react-grid2/
const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: theme.palette.text.secondary,
}));

export const LiftDataCard = (props) => {
  // console.log(`LiftDataCard... `);

  if (!props.selectedLift) return;

  const liftType = props.selectedLift.liftType;
  const index = props.selectedLift.index;
  const analyzerData = props.analyzerData;

  return (
    <>
      <Item elevation={20}>
        <h2>{liftType} PR Analysis</h2>
        <ShowPR liftType={liftType} index={index} reps={1} analyzerData={analyzerData} />
      </Item>
    </>
  );
};

function ShowPR({ liftType, index, reps, analyzerData }) {
  if (!analyzerData.analyzerPRCardData[liftType]) return;
  if (!analyzerData.analyzerPRCardData[liftType].repMaxPRs) return;
  if (!analyzerData.analyzerPRCardData[liftType].repMaxPRs[reps]) return;

  let prTuple = analyzerData.analyzerPRCardData[liftType].repMaxPRs[reps][0];
  // let prTuple = visualizerData.visualizerE1RMLineData[index][`${reps}RM`];
  // console.log(`prTuple: ${prTuple}`);

  let resultText = "";
  let isUrl = false;

  if (prTuple) {
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
    let dateString = `${day} ${month}, ${year}`;

    resultText = `${reps}@${prTuple.weight}${prTuple.unitType} (${dateString})`;
    if (prTuple.url && prTuple.url !== "") {
      isUrl = true;
    }
  } else {
    resultText = "Not found";
  }

  return (
    <>
      {isUrl ? (
        <p>
          <ButtonLink text={resultText} url={prTuple.url} />
        </p>
      ) : (
        <p>{resultText}</p>
      )}
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
