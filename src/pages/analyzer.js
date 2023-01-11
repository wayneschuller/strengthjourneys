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
import { getLiftColor } from "../utils/getLiftColor";

// import Chart from "chart.js/auto"; // Pick everything. You can hand pick which chartjs features you want, see chartjs docs.
// import { Chart, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import ChartDataLabels from "chartjs-plugin-datalabels";
// import annotationPlugin from "chartjs-plugin-annotation";

import { Chart, ArcElement, Tooltip, Legend } from "chart.js";
Chart.register(ArcElement, Tooltip, Legend);

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

  const dummyAnalyzerData = [
    {
      label: "Back Squat",
      value: 340,
    },
    {
      label: "Bench Press",
      value: 280,
    },
    {
      label: "Deadlift",
      value: 170,
    },
  ];

  // Taken from https://mui.com/material-ui/react-grid2/
  const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
    ...theme.typography.body2,
    padding: theme.spacing(1),
    textAlign: "center",
    color: theme.palette.text.secondary,
  }));

  const fontFamily = "Catamaran, Arial";

  const titleOptions = {
    display: false,
    text: `PR Analyzer`,
    font: { font: "Catamaran", size: 20, backgroundColor: "#FFFFFF" },
  };

  const legendOptions = {
    display: true,
    position: "top",
    labels: {
      font: {
        family: fontFamily,
        size: 20,
      },
    },
    // onClick: newLegendClickHandler,
  };

  const arcOptions = {};

  const tooltipOptions = {
    enabled: false,
  };

  const datalabelsOptions = {
    backgroundColor: function (context) {
      return context.dataset.backgroundColor; // Follow lift background color
      // return "#000000";   // Black background for datalabel
    },
    borderColor: "white",
    borderRadius: 25,
    borderWidth: 2,
    color: "white",
    display: function (context) {
      let dataset = context.dataset;
      let totalValue = dataset.data.reduce((acc, obj) => acc + obj.value, 0); // Total sum of the values in the pie chart
      let currentValue = dataset.data[context.dataIndex].value;
      // Don't show if quantity is less than 10% of chart
      // return currentValue > totalValue * 0.1;
      return true;
    },
    font: {
      family: fontFamily,
      weight: "bold",
      size: "14",
    },
    padding: 10,
    formatter: function (context) {
      return [context.label, `${context.value} lifts`];
    },
  };

  // ---------------------------------------------------------------------------
  // Pie Chart Options for react-chartjs-2
  // ---------------------------------------------------------------------------
  let chartOptions = {
    type: "pie",
    responsive: true,
    font: {
      family: "Catamaran",
      size: 20,
      weight: "bold",
    },
    // animation: animationOptions,
    onClick: (context, element) => {
      let chart = context.chart;
      if (!element[0]) return; // Probably a click outside the Pie chart
      let datasetIndex = element[0].datasetIndex;
      let index = element[0].index;
      let liftType = chart._metasets[0]._dataset.data[index].label; // FIXME: find a better method
      // console.log(`Show info for ${liftType} (position ${index})`);
      setSelectedLift({
        liftType: liftType,
        index: index,
      });
    },
    elements: {
      arc: arcOptions,
    },
    // scales: scalesOptions,
    plugins: {
      title: titleOptions,
      legend: legendOptions,
      datalabels: datalabelsOptions,
      tooltip: tooltipOptions,
      // annotation: annotationOptions,
    },
  };

  // Pie chart wants a separate array of colors even though we have that key in each tuple
  const backgroundColor = analyzerData.map((lift) => lift.backgroundColor);

  // Pie chart wants a separate array of labels even though we have that key in each tuple
  // (if you don't do this then you do not get a legend)
  let labels = analyzerData.map((lift) => lift.label);

  // ------------------------------------------------------------------------------
  // Set chart.js Pie Chart data
  // For weird reasons some of the options need to go into the datasets section here
  // ------------------------------------------------------------------------------
  let chartData = {
    labels: labels,
    datasets: [
      {
        data: analyzerData,
        backgroundColor: backgroundColor,
        borderWidth: 4,
        hoverOffset: 20,
        hoverBorderColor: "#222222",
        datalabels: {
          // anchor: "end",
        },
      },
    ],
  };

  return (
    <div>
      <Box sx={{ m: 1 }} md={{ m: 3 }}>
        <Container
          maxWidth="xl"
          sx={{ borderRadius: "6px", border: "1px solid grey", backgroundColor: "palette.secondary.light" }}
        >
          {!visualizerData && <p>PRs and other interesting data points will appear here. </p>}

          {!visualizerData && isLoading && <LoadingLinearProgress />}

          <Box sx={{ width: "100%" }}>
            <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 8 }}>
              <Grid xs={12} lg={6}>
                {analyzerData && <Pie options={chartOptions} data={chartData} />}
              </Grid>

              <Grid xs={12} lg={6}>
                {selectedLift && (
                  <Item elevation={20}>
                    {" "}
                    <LiftDataCard selectedLift={selectedLift} visualizerData={visualizerData} />{" "}
                  </Item>
                )}
              </Grid>
            </Grid>
          </Box>

          {visualizerData && <PRDataTable visualizerData={visualizerData} />}
        </Container>
      </Box>
    </div>
  );
};

export default Analyzer;

const LiftDataCard = (props) => {
  const liftType = props.selectedLift.liftType;
  const index = props.selectedLift.index;
  const visualizerData = props.visualizerData;

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
