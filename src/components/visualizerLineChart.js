/** @format */

import { useRef } from "react";
import { ChartControls } from "./visualizerChartControls";

import Chart from "chart.js/auto"; // Pick everything. You can hand pick which chartjs features you want, see chartjs docs.
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import zoomPlugin from "chartjs-plugin-zoom";
import ChartDataLabels from "chartjs-plugin-datalabels";
import annotationPlugin from "chartjs-plugin-annotation";
Chart.register(zoomPlugin, ChartDataLabels, annotationPlugin);

export function VisualizerLineChart(props) {
  const chartRef = useRef(null);

  console.log(`<VisualiserLineChart />...`);

  if (!props.visualizerConfig && !props.visualizerConfig.visualizerData) return;

  let parsedData = props.parsedData;
  let visualizerConfig = props.visualizerConfig;
  let setVisualizerConfig = props.setVisualizerConfig;
  let visualizerData = props.visualizerConfig.visualizerData;

  function zoomShowAllTime() {
    const chart = chartRef.current;
    if (chart) chart.zoomScale("x", { min: visualizerConfig.padDateMin, max: visualizerConfig.padDateMax }, "default");
  }

  function zoomShowRecent() {
    const chart = chartRef.current;
    // if (chart) chart.resetZoom();
    let sixMonthsAgo = visualizerConfig.padDateMax - 1000 * 60 * 60 * 24 * 30 * 6;
    if (sixMonthsAgo < visualizerConfig.padDateMin) sixMonthsAgo = visualizerConfig.padDateMin;
    if (chart) chart.zoomScale("x", { min: sixMonthsAgo, max: visualizerConfig.padDateMax }, "default");
  }

  function chartUpdate() {
    const chart = chartRef.current;
    if (chart) chart.update();
  }

  // When someone clicks an item in the legend we will:
  // 1) Show/Hide the line (default behaviour)
  // 2) Show/Hide PR annotations for that line
  // 3) Remember the choice in localStorage for next time
  const newLegendClickHandler = function (e, legendItem, legend) {
    const index = legendItem.datasetIndex;
    const chart = legend.chart;

    let selectedLifts = JSON.parse(localStorage.getItem("selectedLifts"));
    if (!selectedLifts) selectedLifts = [];

    let liftType = legendItem.text;
    let singleRM = visualizerConfig.achievementAnnotations[`${liftType}_best_1RM`];
    let tripleRM = visualizerConfig.achievementAnnotations[`${liftType}_best_3RM`];
    let fiveRM = visualizerConfig.achievementAnnotations[`${liftType}_best_5RM`];

    if (chart.isDatasetVisible(index)) {
      legendItem.hidden = true;
      if (singleRM) singleRM.display = false;
      if (tripleRM) tripleRM.display = false;
      if (fiveRM) fiveRM.display = false;
      selectedLifts = selectedLifts.filter((lift) => lift !== liftType); // Exclude unclicked lift
      chart.hide(index);
    } else {
      legendItem.hidden = false;
      if (singleRM) singleRM.display = true;
      if (tripleRM) tripleRM.display = true;
      if (fiveRM) fiveRM.display = true;
      selectedLifts = [...selectedLifts, liftType]; // Include clicked lift
      chart.show(index);
    }

    // Update our localstorage with the array of which lifts are selected
    localStorage.setItem("selectedLifts", JSON.stringify(selectedLifts));
  };

  const animationOptions = {
    duration: 1000,
    easing: "easeInExpo",
  };

  let sixMonthsAgo = 0;
  if (visualizerConfig) {
    sixMonthsAgo = visualizerConfig.padDateMax - 1000 * 60 * 60 * 24 * 30 * 6;
    if (sixMonthsAgo < visualizerConfig.padDateMin) sixMonthsAgo = visualizerConfig.padDateMin;
  }

  const scalesOptions = {
    x: {
      type: "time",
      min: sixMonthsAgo,
      suggestedMax: visualizerConfig.padDateMax,
      time: {
        minUnit: "day",
      },
    },
    y: {
      display: false, // Google Material UI guidelines suggest you don't always have to show axes if you have datalabels
      suggestedMin: 0,
      suggestedMax: visualizerConfig.highestWeight,

      ticks: {
        font: { family: "Catamaran", size: 15 },
        callback: (value) => {
          return `${value}`; // FIXME: insert unitType from data
        },
      },
    },
  };

  const titleOptions = {
    display: false,
    text: `Title`, // Weird title for testing purposes
    font: { size: 20 },
  };

  const legendOptions = {
    display: true,
    position: "top",
    labels: {
      font: {
        family: "Catamaran",
        size: 20,
      },
    },
    onClick: newLegendClickHandler,
  };

  const datalabelsOptions = {
    formatter: (context) => {
      return context.y + context.unitType;
    },
    font: (context) => {
      // Mark heavy singles in bold data labels, and the e1rm estimate data labels as italic
      const liftSingle = context.dataset.data[context.dataIndex].label.indexOf("Potential");
      if (liftSingle === -1) return { family: "Catamaran", weight: "bold", size: 13 };
      else return { family: "Catamaran", style: "italic", size: 12 };
    },
    align: "end",
    anchor: "end",
  };

  const tooltipOptions = {
    enabled: true,
    position: "nearest",
    titleFont: { family: "Catamaran", size: 14 },
    bodyFont: { family: "Catamaran", size: 14 },
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
        if (url) return `Click to open ${url}`; // Tooltip reminder they can click to open video
      },
    },
  };

  // Work out some bounds of our data and six months figure
  const sixtyDaysInMilliseconds = 60 * 24 * 60 * 60 * 1000; // Used for zoom config limits
  const zoomOptions = {
    zoom: {
      wheel: { enabled: true },
      mode: "x",
    },
    pan: {
      enabled: true,
      mode: "x",
    },
    limits: {
      x: {
        min: visualizerConfig.padDateMin,
        max: visualizerConfig.padDateMax,
        minRange: sixtyDaysInMilliseconds,
      },
    },
  };

  const annotationOptions = {
    annotations: visualizerConfig.achievementAnnotations,
  };

  // Line Chart Options for react-chartjs-2 Visualizer
  let chartOptions = {
    responsive: true,
    // parsing: false,     // if you can match data to chartjs internal formats - this will improve speed
    font: { family: "Catamaran" },
    animation: animationOptions,
    onClick: (event, item) => {
      // Used to detect a click on a graph point and open URL in the data.
      if (item && item.length > 0) {
        const url = item[0].element.$context.raw.url;
        if (url) window.open(url);
      }
    },
    scales: scalesOptions,
    plugins: {
      title: titleOptions,
      legend: legendOptions,
      datalabels: datalabelsOptions,
      tooltip: tooltipOptions,
      zoom: zoomOptions,
      annotation: annotationOptions,
    },
  };

  return (
    <>
      {visualizerData && <Line ref={chartRef} options={chartOptions} data={{ datasets: visualizerData }} />}
      {visualizerData && parsedData && (
        <ChartControls
          zoomShowAllTime={zoomShowAllTime}
          zoomShowRecent={zoomShowRecent}
          parsedData={parsedData}
          visualizerData={visualizerData}
          visualizerConfig={visualizerConfig}
          setVisualizerConfig={setVisualizerConfig}
          chartUpdate={chartUpdate}
        />
      )}
    </>
  );
}
