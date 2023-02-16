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

import { NewUserWelcome, ReturningUserWelcome } from "../components/welcome";
import { LoadingLinearProgress } from "./visualizer";
import { AnalyzerPieChart } from "../components/analyzerPieChart";
import { LiftDataPanel, getPRInfo } from "../components/analyzerLiftDataPanel";

const Analyzer = () => {
  const [appStatus, parsedData, setParsedData, visualizerData, setVisualizerData, analyzerData, setAnalyzerData] =
    useOutletContext();

  const [selectedLift, setSelectedLift] = useState(null);

  if (analyzerData === null) return;

  console.log(`<Analyzer />... (analyzerData: ${analyzerData})`);

  const ssid = localStorage.getItem("ssid");

  return (
    <>
      {appStatus === "loading" && !ssid && <LoadingLinearProgress />}

      {(appStatus === "processed" || appStatus === "demo") && (
        <Box sx={{ m: 3, width: "90%" }} color="secondary">
          {/* <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 8 }}> */}
          <Grid container>
            <Grid sm={12} lg={6}>
              <AnalyzerPieChart
                selectedLift={selectedLift}
                setSelectedLift={setSelectedLift}
                analyzerData={analyzerData}
              />
            </Grid>
            <Grid sm={12} lg={6}>
              <LiftDataPanel
                selectedLift={selectedLift}
                parsedData={parsedData}
                analyzerData={analyzerData}
                visualizerData={visualizerData}
              />
            </Grid>
          </Grid>
        </Box>
      )}
    </>
  );
};

export default Analyzer;
