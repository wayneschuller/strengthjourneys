"use client";

import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { devLog } from "@/lib/SJ-utils";

const MonthsHighlightsCard = ({ selectedLiftsPRs }) => {
  const { parsedData, selectedLiftTypes } = useContext(ParsedDataContext);
  if (!parsedData) return;
  if (!selectedLiftTypes) return;

  devLog(`Monthly:`);
  devLog(selectedLiftsPRs);
  // FIXME: put an isLoading skeleton in here internally?
  // {isLoading && (
  //   <div className="flex">
  //     <Skeleton className="h-36 w-11/12 flex-1" />
  //   </div>
  // )}

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Month{"'"}s Highlights</CardTitle>
        {/* <CardDescription>Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        {/* ooh yeah */}
        {Object.entries(selectedLiftsPRs).map(([liftType, prs]) => (
          <div key={`${liftType}-monthly`}>
            <h3>{`Monthly best for ${liftType}`}</h3>
            <ul>
              {prs.map(
                (repsArray, repsIndex) =>
                  // Skip empty arrays
                  repsArray.length > 0 && (
                    <li key={repsIndex}>
                      <strong>{`${repsIndex}-rep PRs:`}</strong>
                      <ul>
                        {repsArray.map(
                          (pr, nthBestIndex) =>
                            pr.date &&
                            new Date(pr.date) >
                              new Date(
                                new Date().setMonth(new Date().getMonth() - 1),
                              ) && (
                              <li key={nthBestIndex}>
                                {`Weight: ${pr.weight} ${pr.unitType}, Reps: ${
                                  pr.reps
                                }, Date: ${pr.date} (#${
                                  nthBestIndex + 1
                                } ever)`}
                              </li>
                            ),
                        )}
                      </ul>
                    </li>
                  ),
              )}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default MonthsHighlightsCard;

// Function to get top lifts for different rep ranges for a specified lift type
function getLiftTypePRs(parsedData, liftType) {
  const startTime = performance.now();

  // Initialize liftTypePRs array with empty arrays for each rep range (0 to 10)
  const liftTypePRs = Array.from({ length: 11 }, () => []);

  // Filter entries for the specified lift type
  const liftTypeEntries = parsedData.filter(
    (entry) => entry.liftType === liftType,
  );

  // Sort entries based on weight in descending order
  const sortedEntries = liftTypeEntries.sort((a, b) => b.weight - a.weight);

  // Populate liftTypePRs array for each rep range
  for (let reps = 1; reps <= 10; reps++) {
    const liftTypeEntriesForReps = sortedEntries.filter(
      (entry) => entry.reps === reps,
    );
    liftTypePRs[reps] = liftTypeEntriesForReps.slice(0, 20);
  }

  devLog(
    `getLiftTypePRs(${liftType}) execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );
  return liftTypePRs;
}
