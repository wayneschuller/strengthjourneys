import { React, useEffect } from 'react';
import { useOutletContext } from "react-router-dom";

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

import { 
  processedData,
  chartClickHandler, 
  chartTitle, 
  liftAnnotations, 
  padDateMin, padDateMax, 
  unitType, 
  processData
} from "../components/visualizerDataProcessing";

export let minChartLines = 3; // How many lifts to show by default
export let maxChartLines = 8; // Maximum number to graph - we will order by most popular lifts.

const basicColors = ["#ae2012", "#ee9b00", "#03045e", "#0a9396"];

ChartJS.register(
  Title,
  CategoryScale,
  LinearScale,
  LineElement, 
  PointElement, 
  Tooltip, 
  Legend 
);


const Visualizer = (props) => {

  const [isAuthenticated, setIsAuthenticated] = useOutletContext();

  var data;

  // When isAuthenticated state changes, load our data
  useEffect(() => {
    if (isAuthenticated) data = { datasets: createDataSets(minChartLines, maxChartLines), };
  }, [isAuthenticated])

  return (
    <div>
      <h2>Strength Visualizer</h2>
      { isAuthenticated ? 
        <>
        Logged in - dataprocessing time?
        <Line data={data} options={options}/> 
        </> : <>
        Please click the google-login button to configure data access.
        </>
        }
    </div>
  );
}

export default Visualizer;



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

// ----------------------------------------------------------------------
// createChart - visualize strength history chart
// Takes data array from either CSV file (papaparse) or Google Sheets API
// We expect array format of grid data[][]
// ----------------------------------------------------------------------
function createChart(data) {
  // parseData(data); // get our source data into rawLiftData

  // Process rawLiftData into our processedData structure
  // processRawLiftData();

  // If we already have a chart, just update it.
  // if (myChart !== null) {
    // myChart.update();
    // return;
  // }

  // Use the most popular lift to set some aesthetic x-axis padding at start and end
  // Right now only do this once on first csv load.
  // There is a chance loading another data set will require a new range, but unlikely.
  padDateMin = new Date(processedData[0].e1rmLineData[0].x);
  padDateMin = padDateMin.setDate(padDateMin.getDate() - 4);
  padDateMax = new Date(processedData[0].e1rmLineData[processedData[0].e1rmLineData.length - 1].x);
  padDateMax = padDateMax.setDate(padDateMax.getDate() + 14);

  // Create the chart.js chart
  // let canvas = document.getElementById("myChartCanvas");
  // myChart = new Chart(canvas, getChartConfig());

  // Set the zoom/pan to the last 6 months of data if we have that much
  let xAxisMin = new Date(padDateMax - 1000 * 60 * 60 * 24 * 30 * 6);
  if (xAxisMin < padDateMin) xAxisMin = padDateMin;
  let xAxisMax = new Date(padDateMax);
  // myChart.zoomScale("xAxis", { min: xAxisMin, max: xAxisMax }, "default");
}


// Setup a charts.js chart.
export function getChartConfig() {
  // const data = {
    // datasets: createDataSets(minChartLines, maxChartLines),
  // };

  const zoomMinTimeRange = 1000 * 60 * 60 * 24 * 60; // 60 days limit to zoom in
  const zoomOptions = {
    limits: {
      x: { min: "original", max: "original", minRange: zoomMinTimeRange },
    },
    pan: {
      enabled: true,
      mode: "x",
    },
    zoom: {
      wheel: {
        enabled: true,
      },
      pinch: {
        enabled: true,
      },
      mode: "x",
    },
  };

  // Chart.defaults.font.family = "Catamaran";

  const config = {
    type: "line",
    // plugins: [ChartDataLabels],
    // data: data,
    options: {
      onClick: chartClickHandler,
      plugins: {
        title: {
          text: chartTitle,
          display: true,
          font: { size: 18 },
        },
        zoom: zoomOptions,
        annotation: {
          annotations: liftAnnotations,
        },
        datalabels: {
          formatter: (context) => context.y,
          font: (context) => {
            // Mark heavy singles in bold data labels, and the e1rm estimate data labels as italic
            const liftSingle = context.dataset.data[context.dataIndex].label.indexOf("Potential");
            if (liftSingle === -1)
              return { weight: "bold", size: 13 };
            else
              return { style: "italic", size: 12 };
          },
          align: "end",
          anchor: "end",
        },
        tooltip: {
          enabled: true,
          position: "nearest",
          titleFont: { size: 14 },
          bodyFont: { size: 14 },
          callbacks: {
            title: (context) => {
              const d = new Date(context[0].parsed.x);
              const formattedDate = d.toLocaleString([], {
                year: "numeric",
                month: "long",
                day: "numeric",
              });
              return formattedDate;
            },
            label: (context) => context.raw.label,
            afterLabel: (context) => context.raw.afterLabel,
            footer: (context) => {
              const url = context[0].raw.url;
              if (url)
                return `Click to open ${url}`; // Tooltip reminder they can click to open video
            },
          },
        },
        legend: {
          labels: {
            font: {
              size: 18,
            },
          },
        },
      },
      scales: {
        xAxis: {
          type: "time",
          suggestedMin: padDateMin,
          suggestedMax: padDateMax,
          time: {
            minUnit: "day",
          },
        },
        yAxis: {
          suggestedMin: 0,
          ticks: {
            font: { size: 15 },
            callback: (value) => {
              return `${value}${unitType}`;
            },
          },
        },
      },
    },
  };
  return config;
}


// createDataSets
// Push our first num processedData into chart.js datasets
// max = number of data sets to create
// min = the default number that display (the rest will begin hidden)
function createDataSets(min, max) {
  const dataSets = [];

  console.log("createDataSets()...");

  // FIXME: check if we have parsed data?
  // processData();   // This is our first chance to process our parsed Data

  let hidden = false;

  for (let i = 0; i < max; i++) {
    // Choose a beautiful color
    let color;
    const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;

    color = i >= min ? randomColor : basicColors[i];

    if (i >= min) hidden = true; // Initially hide the lines above the minimum

    // Check if we have this data to chart, then push it on
    if (processedData[i] && processedData[i].name && processedData[i].e1rmLineData)
      dataSets.push({
        label: processedData[i].name,
        backgroundColor: color,
        borderColor: "rgb(50, 50, 50)",
        borderWidth: 2,
        pointStyle: "circle",
        radius: 4,
        hitRadius: 20,
        hoverRadius: 10,
        cubicInterpolationMode: "monotone",
        hidden: hidden,
        data: processedData[i].e1rmLineData,
      });
  }
  return dataSets;
}

// Generate chart.js annotation plugin config data for an achievement
function createAchievementAnnotation(date, weight, text, background, datasetIndex) {
  return {
    type: "label",
    borderColor: (context) => context.chart.data.datasets[datasetIndex].backgroundColor,
    borderRadius: 3,
    borderWidth: 2,
    yAdjust: 20,
    content: [text],
    xValue: date,
    yValue: weight,
    backgroundColor: background,
    padding: {
      top: 2,
      left: 2,
      right: 2,
      bottom: 1,
    },
    display: (chart, options) => {
      // Only show if dataset line is visible on chart
      let meta = chart.chart.getDatasetMeta(datasetIndex);
      if (meta === undefined) return false;
      return meta.visible;
    },
    // scaleID: 'y',
  };
}

// Show/hide the chart.js achievement annotations on the chart
function toggleAchievements() {
  const toggleInput = document.getElementById("toggleAchievements");
  if (toggleInput.value === "Hide") {
    // The user wants to hide achievements overlay
    // myChart.config.options.plugins.annotation.annotations = null;

    // Change the toggle button
    toggleInput.value = "Show";
    toggleInput.innerHTML = "Show Achievements";
  } else {
    // The user wants to show achievements overlay
    // myChart.config.options.plugins.annotation.annotations = liftAnnotations;

    // Change the toggle button
    toggleInput.value = "Hide";
    toggleInput.innerHTML = "Hide Achievements";
  }
  // myChart.update();
}
