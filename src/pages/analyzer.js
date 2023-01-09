import * as React from 'react';
import { useOutletContext } from "react-router-dom";

// MUI Components
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { Doughnut } from 'react-chartjs-2';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import { LoadingLinearProgress } from './visualizer';

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { processVisualizerData } from '../utils/processData';
ChartJS.register(ArcElement, Tooltip, Legend);


export const data = {
  labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
  datasets: [
    {
      label: '# of Votes',
      data: [12, 19, 3, 5, 2, 3],
      backgroundColor: [
        'rgba(255, 99, 132, 0.2)',
        'rgba(54, 162, 235, 0.2)',
        'rgba(255, 206, 86, 0.2)',
        'rgba(75, 192, 192, 0.2)',
        'rgba(153, 102, 255, 0.2)',
        'rgba(255, 159, 64, 0.2)',
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)',
      ],
      borderWidth: 1,
    },
  ],
};

const Analyzer = (props) => {

  const [ parsedData, 
          isLoading,
          visualizerData, setVisualizerData,
          visualizerConfig, setVisualizerConfig,
        ] = useOutletContext();

  return (
    <div>
     <Box sx={{ m: 1 }} md={{ m: 3}} >
       <Container maxWidth="xl" sx={{ borderRadius: '6px', border: '1px solid grey', backgroundColor: 'palette.secondary.light' }}>

      {/* <h2>Strength Analyzer</h2> */}

      { !visualizerData &&  <p>PRs and other interesting data points will appear here. </p> }

      { !visualizerData && <LoadingLinearProgress /> }

      { visualizerData && <PRDataGrid visualizerData={visualizerData} achievementAnnotations={visualizerConfig.achievementAnnotations} /> }

      {/* <Doughnut data={data} /> */}

        </Container>
      </Box>
    </div>
  );
}

export default Analyzer;

const PRDataGrid = (props) => {
  const visualizerData = props.visualizerData;
  const achievementAnnotations = props.achievementAnnotations;


  const getPRs = (index, reps) => {
    // console.log(`Find best ${visualizerData[index].label}, ${reps}`);

    let PR = "";
    if (visualizerData[index][`${reps}RM`]) {
      PR = visualizerData[index][`${reps}RM`].weight + visualizerData[index][`${reps}RM`].unitType;
    }

    // FIXME: make a hyperlink if we have the url
    // let url = false;
    // if (visualizerData[index][`${reps}RM`].url) {
      //  url = visualizerData[index][`${reps}RM`].url;
    // }
    // PR = "<a href=`${url}`>PR</a>";
    return(PR); 
  }

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
            <TableRow
              key={lift.label}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
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
}
