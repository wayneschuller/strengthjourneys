"use client";

import * as React from "react";
import { useState, useEffect, useContext } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { getSelectedLiftsKey } from "@/lib/localStorage-keys";
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
import { useUserLiftingData } from "@/hooks/use-userlift-data";

/** Default prefix for component-scoped lift selection. Export for consumers that need to hydrate from the same key. */
export const VISUALIZER_STORAGE_PREFIX = "visualizer";

/**
 * Icon or text button that opens a side-panel Sheet with a checklist of the user's lift types.
 * Persists the selection to localStorage under the given storage prefix.
 *
 * @param {Object} props
 * @param {boolean} [props.isIconMode] - When true, renders a compact icon-only button instead of a labelled button.
 * @param {string[]} props.selectedLiftTypes - Array of currently selected lift type names.
 * @param {function(string[])} props.setSelectedLiftTypes - Callback invoked with the updated selection array.
 * @param {string} [props.storagePrefix=VISUALIZER_STORAGE_PREFIX] - localStorage key prefix for persisting selection.
 * @param {string} [props.title="Choose Lifts"] - Title displayed in the Sheet header.
 * @param {React.ReactNode} [props.description] - Description displayed below the Sheet title.
 * @param {string} [props.tooltipLabel] - Accessible tooltip text; falls back to `title` when omitted.
 */
export function SidePanelSelectLiftsButton({
  isIconMode,
  selectedLiftTypes,
  setSelectedLiftTypes,
  storagePrefix = VISUALIZER_STORAGE_PREFIX,
  title = "Choose Lifts",
  description = (
    <>
      Select which lifts to show on your strength chart.
      <p>
        (numbers in parentheses show your total sets for each lift type)
      </p>
    </>
  ),
  tooltipLabel,
}) {
  const srLabel = tooltipLabel ?? title;
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
                  <span className="sr-only">{srLabel}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{srLabel}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <CheckboxLifts
          selectedLiftTypes={selectedLiftTypes}
          setSelectedLiftTypes={setSelectedLiftTypes}
          storagePrefix={storagePrefix}
        />
      </SheetContent>
    </Sheet>
  );
}

// Internal scrollable checklist of all lift types for the side-panel lift chooser.
const CheckboxLifts = ({
  selectedLiftTypes,
  setSelectedLiftTypes,
  storagePrefix,
}) => {
  const { liftTypes } = useUserLiftingData();
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
    const localStorageKey = getSelectedLiftsKey(
      authStatus === "unauthenticated",
      storagePrefix
    );
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
