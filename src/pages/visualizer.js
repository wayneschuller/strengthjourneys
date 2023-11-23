"use client";

import Head from "next/head";
import React, { useState, useEffect } from "react";

import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sampleData } from "@/lib/sampleData";

import {
  Chart as ChartJS,
  Colors,
  TimeScale,
  TimeSeriesScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import "chartjs-adapter-date-fns";

import { Line } from "react-chartjs-2";

ChartJS.register(
  Colors,
  TimeScale,
  TimeSeriesScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

const Visualizer = () => {
  const [time, setTime] = useState(1);

  return (
    <>
      <Head>
        <title>Strength Visualizer (Strength Journeys)</title>
        <meta
          name="description"
          content="Strength Journeys Strength Analyzer"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div>
        <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight lg:text-5xl ">
          Strength Visualizer
        </h1>
        <div className="mt-6">
          <Chart />
          <Chart2 />
        </div>
      </div>
    </>
  );
};
export default Visualizer;

const Chart2 = ({}) => {
  // Group the data by name
  const groupedData = sampleData.reduce((acc, entry) => {
    if (!acc[entry.name]) {
      acc[entry.name] = [];
    }
    acc[entry.name].push({ x: entry.date, y: entry.weight });
    return acc;
  }, {});

  // Create an array of datasets
  const datasets = Object.entries(groupedData).map(([name, data]) => ({
    label: `${name} - Weight (lb)`,
    data,
    borderColor: getRandomColor(), // Add a function to generate random colors
    borderWidth: 2,
    pointBackgroundColor: getRandomColor(),
    pointRadius: 5,
    pointHoverRadius: 8,
  }));

  return (
    <Line
      data={{
        options: {
          scales: {
            x: {
              type: "time", // Use 'time' for a time-based x-axis
              time: {
                unit: "day", // Display units by day
              },
              title: {
                display: true,
                text: "Date",
              },
            },
            y: {
              title: {
                display: true,
                text: "Weight (lb)",
              },
            },
          },
        },
        datasets: datasets,
      }}
    />
  );
};

const Chart = () => {
  return (
    <Line
      datasetIdKey="id"
      data={{
        labels: ["Jun", "Jul", "Aug"],
        datasets: [
          {
            id: 1,
            label: "",
            data: [5, 6, 7],
          },
          {
            id: 2,
            label: "",
            data: [3, 2, 1],
          },
        ],
      }}
    />
  );
};

// Function to generate random colors
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
