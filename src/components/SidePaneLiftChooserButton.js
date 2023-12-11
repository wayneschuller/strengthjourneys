"use client";

import * as React from "react";
import { useState, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { devLog } from "@/lib/SJ-utils";
import { ParsedDataContext } from "@/pages/_app";
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

// FIXME: is there any way to detect when the sheet is closed?
// On mobile we could do the final selectedLift change here
// rather than when checkboxes are ticked which is CPU expensive
const handleOnClose = (context) => {
  devLog(`sheet closed:`);
  devLog(context);
};

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
                      <Dumbbell />
                    </Button>
                  )}
                  {!isIconMode && (
                    <Button variant="outline">
                      <Dumbbell className="mr-3" /> Choose Lifts
                    </Button>
                  )}
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
            Choose what lifts to analyze and visualize (sets)
          </SheetDescription>
        </SheetHeader>
        {/* This is our sheet content here */}
        <CheckboxLifts />
        {/* Sheet content ends */}
        <SheetFooter>
          <SheetClose asChild>
            {/* <Button type="submit">Save changes</Button> */}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const CheckboxLifts = ({}) => {
  const { isDemoMode, liftTypes, selectedLiftTypes, setSelectedLiftTypes } =
    useContext(ParsedDataContext);

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
    const localStorageKey = `selectedLifts${isDemoMode ? "_demoMode" : ""}`;
    localStorage.setItem(localStorageKey, JSON.stringify(updatedSelected));

    // Set the state
    setSelectedLiftTypes(updatedSelected);
  };

  // FIXME: if there are more than 10, add a check all button?

  return (
    <ScrollArea className="mt-2 h-[90vh]">
      <div className="p-4">
        {liftTypes.map(({ liftType, frequency }) => (
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
            >{`${liftType} (${frequency})`}</label>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
