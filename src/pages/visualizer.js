"use client";

import Head from "next/head";
import React, { useState, useEffect } from "react";

import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(
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
        </div>
      </div>
    </>
  );
};
export default Visualizer;

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
