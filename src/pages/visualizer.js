/** @format */

import { React } from "react";
import { useOutletContext } from "react-router-dom";

import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { LiftingCalendarHeatmap } from "../components/heatmap";
import { VisualizerLineChart } from "../components/visualizerLineChart";
import { useAuth } from "../utils/auth";

const Visualizer = (props) => {
  const [
    appStatus,
    parsedData,
    setParsedData,
    visualizerData,
    setVisualizerData,
    analyzerData,
    setAnalyzerData,
    heatmapData,
    setHeatmapData,
  ] = useOutletContext();

  const auth = useAuth();

  // console.log(`<Visualizer />...(visualizerData: ${visualizerData})`);

  const handleZoomPan = ({ chart }) => {
    console.log(`handleZoomPan()...`);
    console.log(chart);
    // Update start and end dates of the heatmap
    setHeatmapData({ ...heatmapData, startDate: chart.scales.x.min, endDate: chart.scales.x.max });
  };

  const ssid = localStorage.getItem("ssid");

  return (
    <>
      {appStatus === "loading" && !ssid && <LoadingLinearProgress />}

      {(appStatus === "processed" || appStatus === "demo") && (
        <VisualizerLineChart
          parsedData={parsedData}
          visualizerData={visualizerData}
          setVisualizerData={setVisualizerData}
          appStatus={appStatus}
          analyzerData={analyzerData}
          handleZoomPan={handleZoomPan}
        />
      )}

      {/* {(appStatus === "processed" || appStatus === "demo") && <LiftingCalendarHeatmap heatmapData={heatmapData} />} */}

      <LiftingCalendarHeatmap heatmapData={heatmapData} />
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
