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

import { NewUserWelcome } from "./visualizer";
import { LoadingLinearProgress } from "./visualizer";
import { AnalyzerPieChart } from "../components/analyzerPieChart";
import { LiftDataPanel, getPRInfo } from "../components/analyzerLiftDataPanel";

const Analyzer = () => {
  const [parsedData, isLoading, isDataReady, visualizerData, setVisualizerData, analyzerData, setAnalyzerData] =
    useOutletContext();

  const [selectedLift, setSelectedLift] = useState(null);

  console.log(`<Analyzer />`);

  if (!visualizerData) return;
  if (!visualizerData.visualizerE1RMLineData) return;
  if (!analyzerData) return;
  if (!analyzerData.analyzerPieData) return;

  return (
    <div>
      <Box sx={{ m: 3, width: "90%" }} color="secondary">
        {!isDataReady && <NewUserWelcome />}

        {!isDataReady && isLoading && <LoadingLinearProgress />}

        <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 8 }}>
          <Grid xs={12} lg={6}>
            {isDataReady && !isLoading && (
              <AnalyzerPieChart
                selectedLift={selectedLift}
                setSelectedLift={setSelectedLift}
                analyzerData={analyzerData}
              />
            )}
          </Grid>

          <Grid xs={12} lg={6}>
            {isDataReady && !isLoading && selectedLift && (
              <LiftDataPanel
                selectedLift={selectedLift}
                parsedData={parsedData}
                analyzerData={analyzerData}
                visualizerData={visualizerData}
              />
            )}
          </Grid>
        </Grid>
      </Box>
    </div>
  );
};

export default Analyzer;
