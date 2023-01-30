/** @format */

import { React } from "react";
import { useOutletContext } from "react-router-dom";

import Grid from "@mui/material/Unstable_Grid2";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Container from "@mui/material/Container";

import { VisualizerLineChart } from "../components/visualizerLineChart";
import { NewUserWelcome, ReturningUserWelcome } from "../components/welcome";

const Visualizer = (props) => {
  // console.log(`<Visualizer />...`);

  const [parsedData, isLoading, isDataReady, visualizerData, setVisualizerData, analyzerData, setAnalyzerData] =
    useOutletContext();

  const ssid = localStorage.getItem("ssid");
  const tokenResponse = JSON.parse(localStorage.getItem("tokenResponse"));

  return (
    <>
      {!isDataReady && !ssid && <NewUserWelcome />}

      {!isDataReady && ssid && !isLoading && <ReturningUserWelcome tokenResponse={tokenResponse} />}

      {/* FIXME: I like this Liner Progress UI but I would like it center middle of the page  */}
      {!isDataReady && isLoading ? (
        <LoadingLinearProgress />
      ) : (
        <VisualizerLineChart
          parsedData={parsedData}
          visualizerData={visualizerData}
          setVisualizerData={setVisualizerData}
        />
      )}
    </>
  );
};

export default Visualizer;

export function LoadingLinearProgress() {
  return (
    <Stack sx={{ width: "100%", color: "grey.500" }} spacing={2}>
      <LinearProgress color="inherit" />
    </Stack>
  );
}
