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

// import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
// ChartJS.register(ArcElement, Tooltip, Legend);

import { Pie } from "react-chartjs-2";

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
    display: true,
    text: `PR Analyzer`, // Weird title for testing purposes
    font: { font: "Catamaran", size: 20 },
  };

  // Line Chart Options for react-chartjs-2 Doughnut/Pie Chart PR Analyzer
  let chartOptions = {
    responsive: true,
    font: { family: "Catamaran", size: 20, weight: "bold" },
    // animation: animationOptions,
    onClick: (event, item) => {
      console.log(event);
      // Used to detect a click on a graph point and open URL in the data.
      if (item && item.length > 0) {
        const url = item[0].element.$context.raw.url;
        if (url) window.open(url);
      }
    },
    // scales: scalesOptions,
    plugins: {
      title: titleOptions,
      // datalabels: datalabelsOptions,
      // tooltip: tooltipOptions,
      // annotation: annotationOptions,
    },
  };

  let chartData = {
    datasets: [
      {
        data: analyzerData,
        color: "#000",
        font: { family: "Catamaran", size: 20, weight: "bold" },
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
            <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }}>
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
