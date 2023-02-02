/** @format */

import { React } from "react";
import { useOutletContext } from "react-router-dom";

import Grid from "@mui/material/Unstable_Grid2";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Container from "@mui/material/Container";

import { VisualizerLineChart } from "../components/visualizerLineChart";
import { NewUserWelcome, ReturningUserWelcome, DemoModeWelcome, WelcomeModal } from "../components/welcome";

const Visualizer = (props) => {
  const [parsedData, isLoading, isDataReady, visualizerData, setVisualizerData, analyzerData, setAnalyzerData] =
    useOutletContext();

  console.log(`<Visualizer />...(visualizerData: ${visualizerData})`);
  if (visualizerData === null) return;

  const ssid = localStorage.getItem("ssid");

  return (
    <>
      {!isDataReady && !isLoading && !ssid && <NewUserWelcome />}

      {!isDataReady && !isLoading && ssid && <ReturningUserWelcome />}

      {/* FIXME: I like this Liner Progress UI but I would like it center middle of the page  */}
      {!isDataReady && isLoading && !ssid ? (
        <LoadingLinearProgress />
      ) : (
        <>
          <VisualizerLineChart
            parsedData={parsedData}
            visualizerData={visualizerData}
            setVisualizerData={setVisualizerData}
          />
        </>
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
