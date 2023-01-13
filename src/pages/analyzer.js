/** @format */

import * as React from "react";
import { useOutletContext } from "react-router-dom";
import { useState, useEffect } from "react";

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
import { LiftDataCard, getPRInfo } from "../components/analyzerLiftDataCard";

const Analyzer = () => {
  const [parsedData, isLoading, isDataReady, visualizerConfig, setVisualizerConfig, analyzerData, setAnalyzerData] =
    useOutletContext();

  const [selectedLift, setSelectedLift] = useState(null);
  const [checked, setChecked] = React.useState(true); // used for fade in of PR Card

  // console.log(`<Analyzer />`);

  if (!visualizerConfig && !visualizerConfig.visualizerData) return;
  if (!analyzerData) return;

  return (
    <div>
      <Box sx={{ m: 3, width: "90%" }}>
        {!isDataReady && <p>PRs and other interesting data points will appear here. </p>}

        {!isDataReady && isLoading && <LoadingLinearProgress />}

        <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 8 }}>
          <Grid xs={12} lg={6}>
            {isDataReady && (
              <AnalyzerPieChart
                selectedLift={selectedLift}
                setSelectedLift={setSelectedLift}
                analyzerData={analyzerData}
              />
            )}
          </Grid>

          <Grid xs={12} lg={6}>
            {selectedLift && (
              <LiftDataCard
                checked={checked}
                selectedLift={selectedLift}
                analyzerData={analyzerData}
                visualizerData={visualizerConfig.visualizerData}
              />
            )}
          </Grid>
        </Grid>
      </Box>
    </div>
  );
};

export default Analyzer;

// An old component - not used anymore
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
