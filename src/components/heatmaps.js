"use client";

import { useState, useEffect, useContext } from "react";
import { useTheme } from "next-themes";
import CalendarHeatmap from "react-calendar-heatmap";
import { devLog } from "@/lib/SJ-utils";
// We don't need this because we put our own styles in our globals.css
// import "react-calendar-heatmap/dist/styles.css";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ActivityHeatmapsCard = ({ parsedData }) => {
  if (!parsedData) return;

  // let array = getBestEverLastMonth(liftTypesSelected, parsedData);
  // devLog(`MonthsHighlightsCard`);
  // devLog(array);

  // FIXME: put the isLoading skelenton in here internally

  // FIXME: for desktop: break up the data into 2 year chunks.
  // The final row can be an unfinished chunk, just pad it out.
  // Then show heatmaps for each of those chunks!

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
        {/* <CardDescription>Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        <Heatmap parsedData={parsedData} months={24} />
      </CardContent>
    </Card>
  );
};

export default ActivityHeatmapsCard;

function generateRandomHeatmapData() {
  const currentDate = new Date();
  const windowMonths = 24; // Two years ago
  const startDate = new Date(currentDate);
  startDate.setMonth(currentDate.getMonth() - windowMonths);

  const endDate = new Date();

  const randomHeatmapData = [];

  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    randomHeatmapData.push({
      date: new Date(date),
      count: Math.floor(Math.random() * 5),
    });
  }

  return {
    startDate,
    endDate,
    heatmapData: randomHeatmapData,
  };
}

const Heatmap = ({ parsedData, months }) => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  // As advised by: https://github.com/pacocoursey/next-themes#avoid-hydration-mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // FIXME: make this do the entire card, not just the internals.

  // FIXME: if we are checking for mounted we could do clever stuff to get window width and adjust the heatmap data size accordingly?
  // We could set months based on window size here

  // FIXME: instead of limiting to 2 years on desktop, just show multiple heatmaps in rows for all the data?!
  // sm: show lots of rows of 6 months heatmaps
  // md: show lots of rows of 1 year heatmaps
  // xl: shows lots of rows of 2 year heatmaps
  // This would look epic - an overview of your data

  if (!parsedData) return;

  // Generate random data
  // const heatmap = generateRandomHeatmapData();

  const heatmap = generateHeatmapData(parsedData, months);

  // devLog(`Heatmap (theme: ${theme}):`);
  // devLog(heatmap);

  return (
    <CalendarHeatmap
      startDate={heatmap.startDate}
      endDate={heatmap.endDate}
      values={heatmap.heatmapData}
      classForValue={(value) => {
        if (!value) {
          return `color-gh-${theme || "light"}-0`; // Grabs colors from css
        }
        return `color-gh-${theme || "light"}-${value.count}`; // Grabs colors from css
      }}
      titleForValue={(value) => {
        if (!value) return null;

        return `${value?.date}: ${value?.count}`;
      }}
    />
  );
};

// liftData.js

// liftData.js
// liftData.js

export const generateHeatmapData = (parsedData, months) => {
  const startTime = performance.now(); // We measure critical processing steps

  const currentDate = new Date();
  const windowMonths = months;

  const windowPeriod = new Date();
  windowPeriod.setMonth(currentDate.getMonth() - windowMonths);

  const filteredData = parsedData.filter(
    (lift) => new Date(lift.date) >= windowPeriod,
  );

  // Create a Set to track unique dates
  const uniqueDates = new Set();

  // Filter and create heatmapData with unique dates and a constant count of 1
  const heatmapData = filteredData
    .filter((lift) => {
      const dateStr = lift.date.toString();
      if (!uniqueDates.has(dateStr)) {
        uniqueDates.add(dateStr);
        return true;
      }
      return false;
    })
    .map((lift) => ({ date: lift.date, count: 1 }));

  // Ensure there's an entry for the date 12 months ago with count: 0
  if (new Date(heatmapData[0].date) > windowPeriod) {
    heatmapData.unshift({
      date: windowPeriod,
      count: 0,
    });
  }

  // Sort the heatmapData by date
  heatmapData.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Set startDate to at least 12 months ago
  const startDate = heatmapData.length > 0 ? heatmapData[0].date : windowPeriod;
  const endDate = currentDate;

  devLog(
    "generateHeatmapData() execution time: " +
      Math.round(performance.now() - startTime) +
      "ms",
  );

  return {
    startDate,
    endDate,
    heatmapData,
  };
};
