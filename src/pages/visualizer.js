import { React } from 'react';

import { 
  Chart as ChartJS, 
  Title,
  CategoryScale,
  LinearScale,
  LineElement, 
  PointElement, 
  Tooltip, 
  Legend 
} from 'chart.js';

import { Line } from 'react-chartjs-2';

ChartJS.register(
  Title,
  CategoryScale,
  LinearScale,
  LineElement, 
  PointElement, 
  Tooltip, 
  Legend 
);

const Visualizer = () => {
  return (
    <div>
      <h2>Strength Visualizer</h2>
      <Line data={data} options={options}/>
    </div>
  );

}

export default Visualizer;

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


// Line Chart Options
export const options = {
  responsive: true,

  font: {
    family: "Catamaran",
  },

  plugins: {

    title: {
      display: true,
      text: 'Chart.js Line Chart',
    },

    legend: {
      position: 'top',
      labels: {
        font: {
          size: 18,
        },
      },
    },

    scales: {
      xAxis: {
        type: "time",
        // suggestedMin: padDateMin,
        // suggestedMax: padDateMax,
        time: {
          minUnit: "day",
        },
      },
      yAxis: {
        suggestedMin: 0,
        ticks: {
          font: { size: 15 },
          callback: (value) => {
            // return `${value}${unitType}`;
          },
        },
      },
    },
  },
};