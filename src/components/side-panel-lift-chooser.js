"use client";

import * as React from "react";
import { useState, useEffect, useContext } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { devLog } from "@/lib/processing-utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Dumbbell } from "lucide-react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserLiftingData } from "@/lib/use-userlift-data";

export function SidePanelSelectLiftsButton({ isIconMode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  {isIconMode && (
                    <Button variant="outline" size="icon">
                      <Dumbbell strokeWidth={1.25} />
                    </Button>
                  )}
                  {!isIconMode && (
                    <Button className="font-normal" variant="outline">
                      <Dumbbell strokeWidth={1.25} className="mr-3" /> Choose
                      Lifts
                    </Button>
                  )}
                  <span className="sr-only">
                    Choose lifts for special analysis
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Choose lifts for special analysis</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Choose Lifts</SheetTitle>
          <SheetDescription>
            Choose what lifts to analyze and visualize
            <p>
              (numbers in parentheses show your total sets for each lift type)
            </p>
          </SheetDescription>
        </SheetHeader>
        <CheckboxLifts />
      </SheetContent>
    </Sheet>
  );
}

const CheckboxLifts = ({}) => {
  const { liftTypes, selectedLiftTypes, setSelectedLiftTypes } =
    useUserLiftingData();
  const { status: authStatus } = useSession();

  const handleCheckboxChange = (liftType) => {
    // Calculate updatedSelected first
    let updatedSelected = selectedLiftTypes.includes(liftType)
      ? selectedLiftTypes.filter((selected) => selected !== liftType)
      : [...selectedLiftTypes, liftType];

    // Ensure there is always at least one lift selected
    // Unlikely as we also disable the UI when one is left
    if (updatedSelected.length === 0) {
      // Do not remove the last selected lift
      return;
    }

    // Sort the selectedLiftTypes based on the frequency descending order in liftTypes
    updatedSelected = liftTypes
      .map((lift) => lift.liftType)
      .filter((liftType) => updatedSelected.includes(liftType));

    // Update localStorage
    const localStorageKey = `selectedLifts${
      authStatus === "unauthenticated" ? "_demoMode" : ""
    }`;
    localStorage.setItem(localStorageKey, JSON.stringify(updatedSelected));

    // Set the state
    setSelectedLiftTypes(updatedSelected);
  };

  // FIXME: if there are more than 10, add a check all button?

  return (
    <ScrollArea className="mt-2 h-[90vh]">
      <div className="p-4">
        {liftTypes.map(({ liftType, totalSets }) => (
          <div key={liftType}>
            <input
              className="mr-4"
              type="checkbox"
              id={liftType}
              value={liftType}
              checked={selectedLiftTypes.includes(liftType)}
              onChange={() => handleCheckboxChange(liftType)}
              disabled={
                selectedLiftTypes.length === 1 &&
                selectedLiftTypes.includes(liftType)
              }
            />
            <label
              className="text-lg"
              htmlFor={liftType}
            >{`${liftType} (${totalSets})`}</label>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
