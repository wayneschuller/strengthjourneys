/** @format */

import * as React from "react";
import { useOutletContext } from "react-router-dom";

// MUI Components
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Unstable_Grid2";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { LoadingLinearProgress } from "./visualizer";
import { getLiftColor } from "../utils/getLiftColor";

import Chart from "chart.js/auto"; // Pick everything. You can hand pick which chartjs features you want, see chartjs docs.
// import { Chart, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import ChartDataLabels from "chartjs-plugin-datalabels";
// import annotationPlugin from "chartjs-plugin-annotation";

// import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
// ChartJS.register(ArcElement, Tooltip, Legend);

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
        font: "Catamaran",
        size: 18,
        backgroundColor: "#FFFFFF",
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
    // display: true,
    display: function (context) {
      let dataset = context.dataset;
      let totalValue = dataset.data.reduce((acc, obj) => acc + obj.value, 0); // Total sum of the values in the pie chart
      let currentValue = dataset.data[context.dataIndex].value;
      // Don't show if quantity is less than 10% of chart
      return currentValue > totalValue * 0.1;
    },
    font: {
      family: "Catamaran",
      weight: "bold",
      size: "14",
    },
    padding: 10,
    formatter: function (context) {
      return [context.label, `${context.value} lifts`];
    },
  };

  // ---------------------------------------------------------------------------
  // Line Chart Options for react-chartjs-2 Doughnut/Pie Chart PR Analyzer
  // ---------------------------------------------------------------------------
  let chartOptions = {
    responsive: true,
    font: {
      family: "Catamaran",
      size: 20,
      weight: "bold",
    },
    // animation: animationOptions,
    onClick: (event, item) => {
      console.log(event);
      // Used to detect a click on a graph point and open URL in the data.
      if (item && item.length > 0) {
        const url = item[0].element.$context.raw.url;
        if (url) window.open(url);
      }
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

  // Create an array of colors for the pie chart that matches lifts
  // correctly - whatever order they are in.
  let backgroundColor = [];
  if (analyzerData) {
    backgroundColor = analyzerData.map((lift) => {
      return getLiftColor(lift.label);
    });
  }

  // ------------------------------------------------------------------------------
  // Set chart.js Pie Chart data
  // For weird reasons some of the options need to go into the datasets section here
  // ------------------------------------------------------------------------------
  let chartData = {
    datasets: [
      {
        data: analyzerData,
        backgroundColor: backgroundColor,
        borderWidth: 4,
        hoverOffset: 20,
        hoverBorderColor: "#222222",
        datalabels: {
          anchor: "end",
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
              <Grid xs={6}>{analyzerData && <Pie options={chartOptions} data={chartData} />}</Grid>
              <Grid xs={6}>{/* <></> */}</Grid>
            </Grid>
          </Box>

          {visualizerData && <PRDataTable visualizerData={visualizerData} />}
        </Container>
      </Box>
    </div>
  );
};

export default Analyzer;

const PRDataTable = (props) => {
  const visualizerData = props.visualizerData;

  if (!visualizerData) return;

  const getPRs = (index, reps) => {
    // console.log(`Find best ${visualizerData[index].label}, ${reps}`);

    let PR = "";
    if (visualizerData[index][`${reps}RM`]) {
      PR = visualizerData[index][`${reps}RM`].weight + visualizerData[index][`${reps}RM`].unitType;

      // Make a hyperlink if we have the url
      if (visualizerData[index][`${reps}RM`].url) {
        let url = visualizerData[index][`${reps}RM`].url;

        // FIXME: this is not how we link inside MUI
        // PR = `<a href='${url}'>${PR}</a>`;
      }
    }
    return PR;
  };

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
              <TableCell align="right">{getPRs(index, 1)}</TableCell>
              <TableCell align="right">{getPRs(index, 3)}</TableCell>
              <TableCell align="right">{getPRs(index, 5)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
