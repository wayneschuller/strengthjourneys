/** @format */

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
  const liftType = props.selectedLift.liftType;
  const index = props.selectedLift.index;
  const visualizerData = props.visualizerData;
  const analyzerData = props.analyzerData;

  let single = getPRInfo(visualizerData, index, 1);
  let triple = getPRInfo(visualizerData, index, 3);
  let five = getPRInfo(visualizerData, index, 5);
  let prTuple = visualizerData[index][`3RM`];
  let singleURL = false;
  if (prTuple && prTuple.url) singleURL = true;

  return (
    <>
      <Item elevation={20}>
        <h2>{liftType} PR Analysis</h2>
        <ShowPR liftType={liftType} index={index} reps={1} visualizerData={visualizerData} />
        <ShowPR liftType={liftType} index={index} reps={3} visualizerData={visualizerData} />
        <ShowPR liftType={liftType} index={index} reps={5} visualizerData={visualizerData} />
      </Item>
    </>
  );
};

// Returns a full PR info string (with possible hyperlink included)
export function getPRInfo(visualizerData, index, reps) {
  let prTuple = visualizerData[index][`${reps}RM`];

  let result = "";
  if (prTuple) {
    result = `${prTuple.weight}${prTuple.unitType} (${prTuple.date})`;
    // If we have a URL wrap it in a link
    if (prTuple.url && prTuple.url !== "") {
      let url = prTuple.url;
      // result = `<a href='${url}'>${result}</a>`;  // Figure out how to link in React/MUI
      result = `<ButtonLink />`;
      // console.log(result);
    }
  } else {
    result = "Not found.";
  }
  return result;
}

function ShowPR({ liftType, index, reps, visualizerData }) {
  let prTuple = visualizerData[index][`${reps}RM`];

  let resultText = "";
  let isUrl = false;

  if (prTuple) {
    let dateString = prTuple.date; // FIXME: Change "2021-03-01" to "1 March, 2021"
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
