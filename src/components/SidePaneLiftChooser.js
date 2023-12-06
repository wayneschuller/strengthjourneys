"use client";

import { useState, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bold, Italic, Underline } from "lucide-react";
import { devLog } from "@/lib/SJ-utils";
import { useLocalStorage } from "usehooks-ts";
import { ParsedDataContext } from "@/pages/_app";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

export function SidePanelLiftChooser({ liftTypes, selected, setSelected }) {
  // devLog(`Rendering <SidePanelLiftChooser /> selectedlifts:`);
  // devLog(selected);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Choose Lifts</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Choose Lifts</SheetTitle>
          <SheetDescription>
            Choose what lifts to analyze and visualize (sets)
          </SheetDescription>
        </SheetHeader>
        <CheckboxLifts
          sortedLiftTypes={liftTypes}
          liftTypesSelected={selected}
          setLiftTypesSelected={setSelected}
        />
        {/* <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" value="Pedro Duarte" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username
            </Label>
            <Input id="username" value="@peduarte" className="col-span-3" />
          </div>
        </div> */}
        <SheetFooter>
          <SheetClose asChild>
            {/* <Button type="submit">Save changes</Button> */}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const CheckboxLifts = ({
  sortedLiftTypes,
  liftTypesSelected,
  setLiftTypesSelected,
}) => {
  const {
    parsedData,
    setParsedData,
    ssid,
    setSsid,
    isDemoMode,
    setIsDemoMode,
  } = useContext(ParsedDataContext);

  const localStorageKey = `selectedLifts${isDemoMode ? "_demoMode" : ""}`;

  const handleCheckboxChange = (liftType) => {
    // Calculate updatedSelected first
    const updatedSelected = liftTypesSelected.includes(liftType)
      ? liftTypesSelected.filter((selected) => selected !== liftType)
      : [...liftTypesSelected, liftType];

    // Ensure there is always at least one lift selected
    // Unlikely as we also disable the UI when one is left
    if (updatedSelected.length === 0) {
      // Do not remove the last selected lift
      return;
    }

    // Set the state
    setLiftTypesSelected(updatedSelected);

    // Update localStorage
    localStorage.setItem(localStorageKey, JSON.stringify(updatedSelected));
  };

  return (
    <ScrollArea className="mt-2 h-[90vh]">
      <div className="p-4">
        {sortedLiftTypes.map(({ liftType, frequency }) => (
          <div key={liftType}>
            <input
              className="mr-4"
              type="checkbox"
              id={liftType}
              value={liftType}
              checked={liftTypesSelected.includes(liftType)}
              onChange={() => handleCheckboxChange(liftType)}
              disabled={
                liftTypesSelected.length === 1 &&
                liftTypesSelected.includes(liftType)
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

function ToggleGroupDemo({ liftTypes }) {
  devLog(liftTypes);

  return (
    <ToggleGroup type="multiple" orientation="vertical">
      <ToggleGroupItem value="bold" aria-label="Toggle bold">
        <Bold className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Toggle italic">
        <Italic className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="strikethrough" aria-label="Toggle strikethrough">
        <Underline className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
