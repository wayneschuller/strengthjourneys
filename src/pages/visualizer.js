/** @format */

import { React } from "react";
import { useOutletContext } from "react-router-dom";

import Grid from "@mui/material/Unstable_Grid2";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Container from "@mui/material/Container";

import { VisualizerLineChart } from "../components/visualizerLineChart";
import { NewUserWelcome, ReturningUserWelcome, DemoModeWelcome, WelcomeModal } from "../components/welcome";
import { useAuth } from "../utils/auth";

const Visualizer = (props) => {
  const [appStatus, parsedData, setParsedData, visualizerData, setVisualizerData, analyzerData, setAnalyzerData] =
    useOutletContext();

  const auth = useAuth();

  console.log(`<Visualizer />...(visualizerData: ${visualizerData})`);

  const ssid = localStorage.getItem("ssid");

  // FIXME: rendering logic still not right here. It shows nothing on logout

  return (
    <>
      {/* FIXME: I like this Liner Progress UI but I would like it center middle of the page  */}
      {appStatus === "loading" && !ssid && <LoadingLinearProgress />}

      {(appStatus === "processed" || appStatus === "demo") && (
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
