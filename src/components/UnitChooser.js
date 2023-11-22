/** @format */
"use client";

"use client";

import * as Switch from "@radix-ui/react-switch";

import * as React from "react";
import { Moon, Sun, Weight } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const UnitChooser = ({ isMetric, onSwitchChange }) => {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => onSwitchChange(!isMetric)}
    >
      {isMetric ? "kg" : "lb"}
    </Button>
  );
};

export const UnitChooser3 = ({ isMetric, onSwitchChange }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Weight className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Weight className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onSwitchChange(!isMetric)}>
          Kilograms
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSwitchChange(!isMetric)}>
          Pounds
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const UnitChooser2 = ({ isMetric, onSwitchChange }) => (
  <div className="flex items-center align-middle">
    <label className="pr-[10px] text-sm leading-none" aria-label="pounds">
      Pounds
    </label>
    <Switch.Root
      className={`shadow-blackA4 relative h-[25px] w-[42px] rounded-full bg-black shadow-[0_2px_10px] focus:shadow-[0_0_0_2px] focus:shadow-black ${
        isMetric ? "data-[state=checked]:bg-black" : ""
      } cursor-default outline-none`}
      id="unit type"
      aria-label="unit type"
      onCheckedChange={() => onSwitchChange(!isMetric)}
      checked={isMetric}
    >
      <Switch.Thumb
        className={`shadow-blackA4 block h-[21px] w-[21px] rounded-full bg-white shadow-[0_2px_2px] transition-transform duration-100 will-change-transform ${
          isMetric ? "data-[state=checked]:translate-x-[19px]" : ""
        }`}
      />
    </Switch.Root>
    <label
      className="pl-[10px] text-sm leading-none"
      htmlFor="kilos-mode"
      aria-label="kilos"
    >
      Kilos
    </label>
  </div>
);
