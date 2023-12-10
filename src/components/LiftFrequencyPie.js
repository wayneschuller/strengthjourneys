"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContext, useState, useEffect } from "react";
import { devLog } from "@/lib/SJ-utils";
import { ParsedDataContext } from "@/pages/_app";

import { Chart, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import { getLiftColor } from "@/lib/getLiftColor";
import ChartDataLabels from "chartjs-plugin-datalabels";

Chart.register(ArcElement, Tooltip, Legend, ChartDataLabels);

function LiftTypeFrequencyPieCard() {
  const { parsedData, liftTypes, topLiftsByTypeAndReps } =
    useContext(ParsedDataContext);
  const [pieData, setPieData] = useState(null);

  // FIXME: could we add some time UI controls? Liftime, this year etc?

  useEffect(() => {
    // devLog(`PieCard...`);

    // FIXME: do some processing - top 4-5 lifts and make an arc called "Other"?
    // FIXME: and allow them to click other to see a second pie chart?
    const pieData = liftTypes
      .map((item) => ({
        label: item.liftType,
        frequency: item.frequency,
      }))
      .slice(0, 5);

    setPieData(pieData);
  }, [parsedData, liftTypes]);

  if (!pieData) return;
  const backgroundColors = pieData.map((item) => getLiftColor(item.label));

  // ---------------------------------------------------------------------------
  // Pie Chart Options for react-chartjs-2
  // ---------------------------------------------------------------------------

  const datalabelsOptions = {
    backgroundColor: function (context) {
      return context.dataset.backgroundColor; // Follow lift background color
      // return "#000000";   // Black background for datalabel
    },
    borderColor: "white",
    borderRadius: 25,
    borderWidth: 2,
    color: "white",
    // display: function (context) {
    // devLog(context);
    // let dataset = context.dataset;
    // let totalValue = dataset.data.reduce(
    // (acc, obj) => acc + obj.totalSessions,
    // 0,
    // ); // Total sum of the values in the pie chart
    // let currentValue = dataset.data[context.dataIndex].totalSessions;
    // Don't show data label if arc piece is less than 10% of chart
    // return currentValue > totalValue * 0.1;
    // return context.dataset.data[context.dataIndex].frequency;
    // return true; // Use this  to show data labels on every arc data item
    // },
    font: {
      // family: fontFamily,
      weight: "bold",
      size: "14",
    },
    padding: 10,
    // formatter: function (item) {
    // return [context.label, `${context.totalSessions} sessions`];
    // devLog(item);
    // return `${item.label} (${item.frequency} sets)`;
    // },
  };

  let pieChartOptions = {
    type: "pie",
    responsive: true,
    font: {
      family: "Catamaran",
      size: 20,
      weight: "bold",
    },
    // animation: animationOptions,
    // onClick: (context, element) => {
    //   let chart = context.chart;
    //   if (!element[0]) return; // Probably a click outside the Pie chart
    //   let datasetIndex = element[0].datasetIndex;
    //   let index = element[0].index;
    //   let liftType = chart._metasets[0]._dataset.data[index].label; // FIXME: find a better method
    //   if (!selectedLift || liftType !== selectedLift.liftType) {
    //     setSelectedLift({
    //       liftType: liftType,
    //       index: index,
    //     });
    //   }
    // },
    // onHover: (context, element) => {
    //   let chart = context.chart;
    //   if (!element[0]) return; // Probably a click outside the Pie chart
    //   let datasetIndex = element[0].datasetIndex;
    //   let index = element[0].index;
    //   let liftType = chart._metasets[0]._dataset.data[index].label; // FIXME: find a better method
    //   if (!selectedLift || liftType !== selectedLift.liftType) {
    //     setSelectedLift({
    //       liftType: liftType,
    //       index: index,
    //     });
    //   }
    // },
    elements: {
      // arc: arcOptions,
    },
    // parsing: parsingOptions,
    plugins: {
      // title: titleOptions,
      legend: {
        display: false,
      },
      datalabels: datalabelsOptions,
      // tooltip: tooltipOptions,
    },
  };

  const pieChartData = {
    labels: pieData.map((item) => item.label),

    datasets: [
      {
        label: "Frequency",
        data: pieData.map((item) => item.frequency),
        backgroundColor: backgroundColors,
        borderWidth: 3,
        hoverOffset: 5,
        hoverBorderColor: "#222222",
      },
    ],
  };

  // if (!pieData) return null;
  // if (!backgroundColors) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Lifts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="">
          <Pie data={pieChartData} options={pieChartOptions} />
        </div>
      </CardContent>
    </Card>
  );
}

export default LiftTypeFrequencyPieCard;
