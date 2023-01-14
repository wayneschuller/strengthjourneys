/** @format */

// import Chart from "chart.js/auto"; // Pick everything. You can hand pick which chartjs features you want, see chartjs docs.
// import { Chart, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import ChartDataLabels from "chartjs-plugin-datalabels";
// import annotationPlugin from "chartjs-plugin-annotation";

import { Chart, ArcElement, Tooltip, Legend } from "chart.js";
Chart.register(ArcElement, Tooltip, Legend);

export function AnalyzerPieChart(props) {
  // console.log(`<AnalyzerPieChart />...`);

  if (!props.analyzerData && !props.analyzerData.analyzerPieData) return;

  const analyzerData = props.analyzerData;
  const selectedLift = props.selectedLift;
  const setSelectedLift = props.setSelectedLift;

  const fontFamily = "Catamaran, Arial";

  const titleOptions = {
    display: false,
    text: `PR Analyzer`,
    font: { font: "Catamaran", size: 20, backgroundColor: "#FFFFFF" },
  };

  const newLegendClickHandler = function (e, legendItem, legend) {
    const index = legendItem.datasetIndex;
    const chart = legend.chart;

    let selectedLifts = JSON.parse(localStorage.getItem("selectedLifts"));
    if (!selectedLifts) selectedLifts = [];

    let liftType = legendItem.text;

    if (chart.isDatasetVisible(index)) {
      legendItem.hidden = true;
      selectedLifts = selectedLifts.filter((lift) => lift !== liftType); // Exclude unclicked lift
      chart.hide(index);
    } else {
      legendItem.hidden = false;
      selectedLifts = [...selectedLifts, liftType]; // Include clicked lift
      chart.show(index);
    }

    // Update our localstorage with the array of which lifts are selected
    localStorage.setItem("selectedLifts", JSON.stringify(selectedLifts));
  };

  const legendOptions = {
    display: false,
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
      let totalValue = dataset.data.reduce((acc, obj) => acc + obj.totalSessions, 0); // Total sum of the values in the pie chart
      let currentValue = dataset.data[context.dataIndex].totalSessions;
      // Don't show data label if arc piece is less than 10% of chart
      return currentValue > totalValue * 0.1;
      // return true; // Use this  to show data labels on every arc data item
    },
    font: {
      family: fontFamily,
      weight: "bold",
      size: "14",
    },
    padding: 10,
    formatter: function (context) {
      return [context.label, `${context.totalSessions} sessions`];
      // return [context.label];
    },
  };

  const parsingOptions = {
    key: "totalSessions",
    // key: "totalSets",  // We could group the pieChart by total sets performed...
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
      if (!selectedLift || liftType !== selectedLift.liftType) {
        setSelectedLift({
          liftType: liftType,
          index: index,
        });
      }
    },
    onHover: (context, element) => {
      let chart = context.chart;
      if (!element[0]) return; // Probably a click outside the Pie chart
      let datasetIndex = element[0].datasetIndex;
      let index = element[0].index;
      let liftType = chart._metasets[0]._dataset.data[index].label; // FIXME: find a better method
      if (!selectedLift || liftType !== selectedLift.liftType) {
        setSelectedLift({
          liftType: liftType,
          index: index,
        });
      }
    },
    elements: {
      arc: arcOptions,
    },
    parsing: parsingOptions,
    plugins: {
      title: titleOptions,
      legend: legendOptions,
      datalabels: datalabelsOptions,
      tooltip: tooltipOptions,
      // annotation: annotationOptions,
    },
  };

  // Pie chart wants a separate array of colors even though we have that key in each tuple
  const backgroundColor = analyzerData.analyzerPieData.map((lift) => lift.backgroundColor);

  // Pie chart wants a separate array of labels even though we have that key in each tuple
  // (if you don't do this then you do not get a legend)
  let labels = analyzerData.analyzerPieData.map((lift) => lift.label);

  // ------------------------------------------------------------------------------
  // Set chart.js Pie Chart data
  // For weird reasons some of the options need to go into the datasets section here
  // ------------------------------------------------------------------------------
  let chartData = {
    labels: labels,
    datasets: [
      {
        data: analyzerData.analyzerPieData,
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
    <>
      <Pie data={chartData} options={chartOptions} />
    </>
  );
}
