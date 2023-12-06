"use client";

import { useState, useEffect, useContext } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { devLog } from "@/lib/SJ-utils";

const MonthsHighlightsCard = ({ parsedData, liftTypesSelected }) => {
  if (!parsedData) return;

  // let array = getBestEverLastMonth(liftTypesSelected, parsedData);
  // devLog(`MonthsHighlightsCard`);
  // devLog(array);

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Month{"'"}s Highlights</CardTitle>
        {/* <CardDescription>Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        {parsedData && <div>Sets: {parsedData.length}</div>}
      </CardContent>
    </Card>
  );
};

export default MonthsHighlightsCard;

function getBestEverLastMonth(selectedLiftTypes, parsedData) {
  // Calculate the date one month ago
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  // Filter the parsedData for lifts in selectedLiftTypes and within the last month
  const filteredData = parsedData.filter((lifting) => {
    const liftingDate = new Date(lifting.date);
    return (
      selectedLiftTypes.includes(lifting.liftType) && liftingDate >= oneMonthAgo
    );
  });

  // Find the best-ever result for each rep scheme for selected lift types
  const bestEverResults = {};

  parsedData.forEach((lifting) => {
    if (selectedLiftTypes.includes(lifting.liftType)) {
      const { reps, weight } = lifting;

      if (
        !bestEverResults[lifting.liftType] ||
        weight > bestEverResults[lifting.liftType][reps]?.weight
      ) {
        bestEverResults[lifting.liftType] = {
          ...bestEverResults[lifting.liftType],
          [reps]: { reps, weight, liftingDate: lifting.date },
        };
      }
    }
  });

  // Filter the best-ever results for each lift type for rep schemes that occurred in the last month
  const bestEverLastMonth = Object.entries(bestEverResults).map(
    ([liftType, repResults]) => {
      const filteredRepResults = Object.values(repResults).filter((result) => {
        const liftingDate = new Date(result.liftingDate);
        return liftingDate >= oneMonthAgo;
      });

      return { liftType, bestEverResults: filteredRepResults };
    },
  );

  return bestEverLastMonth;
}
