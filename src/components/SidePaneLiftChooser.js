"use client";

import { useState, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bold, Italic, Underline } from "lucide-react";
import { devLog } from "@/lib/SJ-utils";
import { useLocalStorage } from "usehooks-ts";
import { ParsedDataContext } from "@/pages/_app";

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
        <div className="mt-2 overflow-auto">
          <CheckboxLifts sortedLiftTypes={liftTypes} />
        </div>
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

const CheckboxLifts = ({ sortedLiftTypes }) => {
  // const [selectedLiftTypes, setSelectedLiftTypes] = useState([]);
  const {
    parsedData,
    setParsedData,
    ssid,
    setSsid,
    isDemoMode,
    setIsDemoMode,
  } = useContext(ParsedDataContext);
  const [liftTypesSelected, setLiftTypesSelected] = useLocalStorage(
    `selectedLifts_${isDemoMode}`,
    [],
  );

  useEffect(() => {
    devLog(liftTypesSelected);
  }, [liftTypesSelected]);

  const handleCheckboxChange = (liftType) => {
    setLiftTypesSelected((prevSelected) => {
      // If the liftType is already selected, check if it's the last one
      if (prevSelected.includes(liftType)) {
        // Ensure there is always at least one lift selected
        if (prevSelected.length === 1) {
          return prevSelected; // Do not remove the last selected lift
        }
        return prevSelected.filter((selected) => selected !== liftType);
      }

      // If the liftType is not selected, add it
      return [...prevSelected, liftType];
    });
  };

  return (
    <div>
      <div>
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
    </div>
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
