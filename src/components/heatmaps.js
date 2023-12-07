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
  // devLog(`ActivityHeatmapsCard`);

  // FIXME: put the isLoading skelenton in here internally

  // FIXME: for desktop: break up the data into 2 year chunks.
  // The final row can be an unfinished chunk, just pad it out.
  // Then show heatmaps for each of those chunks!

  const { startDate, endDate } = findDateRange(parsedData);
  const intervals = generateDateRanges(startDate, endDate, 24);
  devLog(intervals);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
        <CardDescription>
          Two year heatmap{intervals.length > 1 && "s"} beginning {startDate}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {intervals.map((interval, index) => {
          const formattedStartDate = new Date(
            interval.start,
          ).toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          const formattedEndDate = new Date(interval.end).toLocaleDateString(
            "en-US",
            { day: "numeric", month: "long", year: "numeric" },
          );

          return (
            <div className="mb-6" key={`${index}-heatmap`}>
              <div className="text-center text-sm lg:text-lg">
                {formattedStartDate} - {formattedEndDate}
              </div>
              <Heatmap
                parsedData={parsedData}
                startDate={interval.start}
                endDate={interval.end}
              />
            </div>
          );
        })}
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

const Heatmap = ({ parsedData, startDate, endDate }) => {
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

  const heatmapData = generateHeatmapData(parsedData, startDate, endDate);

  // devLog(`Heatmap (theme: ${theme}):`);
  // devLog(heatmap);

  return (
    <CalendarHeatmap
      startDate={startDate}
      endDate={endDate}
      values={heatmapData}
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

export const generateHeatmapData = (parsedData, startDate, endDate) => {
  const startTime = performance.now();

  const filteredData = parsedData.filter(
    (lift) =>
      new Date(lift.date) >= new Date(startDate) &&
      new Date(lift.date) <= new Date(endDate),
  );

  const uniqueDates = new Set();

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

  if (
    heatmapData.length > 0 &&
    new Date(heatmapData[0].date) > new Date(startDate)
  ) {
    heatmapData.unshift({
      date: new Date(startDate),
      count: 0,
    });
  }

  heatmapData.sort((a, b) => new Date(a.date) - new Date(b.date));

  devLog(
    "generateHeatmapData() execution time: " +
      Math.round(performance.now() - startTime) +
      "ms",
  );

  return heatmapData;
};

export const generateHeatmapDataMonths = (parsedData, months) => {
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

function findDateRange(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return null; // Return null for an empty array or invalid input
  }

  // Initialize start and end dates with the date of the first item in the array
  let startDate = new Date(parsedData[0].date);
  let endDate = new Date(parsedData[0].date);

  // Iterate through the array to find the actual start and end dates
  parsedData.forEach((item) => {
    const currentDate = new Date(item.date);

    if (currentDate < startDate) {
      startDate = currentDate;
    }

    if (currentDate > endDate) {
      endDate = currentDate;
    }
  });

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

function generateDateRangesOld(startDateStr, endDateStr) {
  // Convert input date strings to Date objects
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  // Calculate the duration of the input date range in milliseconds
  const rangeDuration = endDate - startDate;

  // Check if the duration is less than two years
  if (rangeDuration < 2 * 365 * 24 * 60 * 60 * 1000) {
    // If less than two years, return a two-year range with startDate and endDate in the middle
    const middleDate = new Date(startDate.getTime() + rangeDuration / 2);
    const twoYearStartDate = new Date(middleDate);
    twoYearStartDate.setFullYear(middleDate.getFullYear() - 1);
    const twoYearEndDate = new Date(middleDate);
    twoYearEndDate.setFullYear(middleDate.getFullYear() + 1);
    return [{ start: twoYearStartDate, end: twoYearEndDate }];
  } else {
    // If more than two years, generate multiple two-year ranges
    const dateRanges = [];
    let currentStartDate = new Date(startDate);

    while (currentStartDate < endDate) {
      const currentEndDate = new Date(currentStartDate);
      currentEndDate.setFullYear(currentEndDate.getFullYear() + 2);

      dateRanges.push({ start: currentStartDate, end: currentEndDate });
      // Move the start date for the next iteration
      currentStartDate = new Date(currentEndDate);
    }
    return dateRanges;
  }
}

function generateDateRanges(startDateStr, endDateStr, intervalMonths) {
  // Convert input date strings to Date objects
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  // Calculate the duration of the input date range in milliseconds
  const rangeDuration = endDate - startDate;

  // Calculate the interval duration in milliseconds
  const intervalDuration = intervalMonths * 30 * 24 * 60 * 60 * 1000;

  // Check if the duration is less than the specified interval
  if (rangeDuration < intervalDuration) {
    // If less than the interval, place startDate and endDate in the middle of the interval
    const middleDate = new Date(
      startDate.getTime() + rangeDuration / 2 - intervalDuration / 2,
    );
    const intervalStartDate = new Date(middleDate);
    const intervalEndDate = new Date(intervalStartDate);
    intervalEndDate.setMilliseconds(
      intervalEndDate.getMilliseconds() + intervalDuration,
    );

    return [{ start: intervalStartDate, end: intervalEndDate }];
  } else {
    // If more than the interval, generate multiple ranges with the specified interval
    const dateRanges = [];
    let currentStartDate = new Date(startDate);

    while (currentStartDate < endDate) {
      const currentEndDate = new Date(currentStartDate);
      currentEndDate.setMilliseconds(
        currentEndDate.getMilliseconds() + intervalDuration,
      );

      dateRanges.push({
        start: new Date(currentStartDate),
        end: new Date(currentEndDate),
      });

      // Move the start date for the next iteration
      currentStartDate.setTime(currentEndDate.getTime());
    }
    return dateRanges;
  }
}
