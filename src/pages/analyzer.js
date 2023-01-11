/** @format */

import * as React from "react";
import { useOutletContext } from "react-router-dom";
import { useState } from "react";

// MUI Components
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Unstable_Grid2";
import Paper from "@mui/material/Paper";
import { styled } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { LoadingLinearProgress } from "./visualizer";
import { AnalyzerPieChart } from "../components/analyzerPieChart";

const Analyzer = () => {
  const [
    parsedData,
    isLoading,
    visualizerData,
    setVisualizerData,
    visualizerConfig,
    setVisualizerConfig,
    analyzerData,
    setAnalyzerData,
  ] = useOutletContext();

  const [selectedLift, setSelectedLift] = useState(null);

  if (!visualizerData) return;
  if (!analyzerData) return;

  // console.log(`<Analyzer />`);

  // Taken from https://mui.com/material-ui/react-grid2/
  const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
    ...theme.typography.body2,
    padding: theme.spacing(1),
    textAlign: "center",
    color: theme.palette.text.secondary,
  }));

  return (
    <div>
      <Box sx={{ m: 3, width: "90%" }}>
        {!visualizerData && <p>PRs and other interesting data points will appear here. </p>}

        {!visualizerData && isLoading && <LoadingLinearProgress />}

        {/* <Box sx={{ width: "100%" }}> */}
        <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 8 }}>
          <Grid xs={12} lg={6}>
            {analyzerData && (
              <AnalyzerPieChart
                selectedLift={selectedLift}
                setSelectedLift={setSelectedLift}
                analyzerData={analyzerData}
              />
            )}
          </Grid>

          <Grid xs={12} lg={6}>
            {selectedLift && (
              <Item elevation={20}>
                {" "}
                <LiftDataCard
                  selectedLift={selectedLift}
                  analyzerData={analyzerData}
                  visualizerData={visualizerData}
                />{" "}
              </Item>
            )}
          </Grid>
        </Grid>
        {/* </Box> */}

        {/* FIXME: We probably don't need the PR table anymore? */}
        {/* {visualizerData && <PRDataTable visualizerData={visualizerData} />} */}
      </Box>
    </div>
  );
};

export default Analyzer;

const LiftDataCard = (props) => {
  const liftType = props.selectedLift.liftType;
  const index = props.selectedLift.index;
  const visualizerData = props.visualizerData;
  const analyzerData = props.analyzerData;

  let single = getPRInfo(visualizerData, index, 1);
  let triple = getPRInfo(visualizerData, index, 3);
  let five = getPRInfo(visualizerData, index, 5);

  return (
    <>
      <h2>{liftType} PR Analysis</h2>
      <p>Best Single: {single}</p>
      <p>Best Triple: {triple}</p>
      <p>Best Five: {five}</p>
    </>
  );
};

const PRDataTable = (props) => {
  const visualizerData = props.visualizerData;

  if (!visualizerData) return;

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 150 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Lift Type</TableCell>
            <TableCell align="right">One Rep Max</TableCell>
            <TableCell align="right">Three Rep Max</TableCell>
            <TableCell align="right">Five Rep Max</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visualizerData.map((lift, index) => (
            <TableRow key={lift.label} sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
              <TableCell component="th" scope="row">
                {lift.label}
              </TableCell>
              <TableCell align="right">{getPRInfo(visualizerData, index, 1)}</TableCell>
              <TableCell align="right">{getPRInfo(visualizerData, index, 3)}</TableCell>
              <TableCell align="right">{getPRInfo(visualizerData, index, 5)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// Returns a full PR info string (with possible hyperlink included)
function getPRInfo(visualizerData, index, reps) {
  let prTuple = visualizerData[index][`${reps}RM`];

  let result = "";
  if (prTuple) {
    result = `${prTuple.weight}${prTuple.unitType} (${prTuple.date})`;
    // If we have a URL wrap it in a link
    if (prTuple.url && prTuple.url !== "") {
      let url = prTuple.url;
      // result = `<a href='${url}'>${result}</a>`;  // Figure out how to link in React/MUI
      // console.log(result);
    }
  } else {
    result = "Not found.";
  }
  return result;
}
