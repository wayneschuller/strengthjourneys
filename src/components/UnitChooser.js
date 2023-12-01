/** @format */
"use client";

import * as Switch from "@radix-ui/react-switch";

import * as React from "react";
import { Moon, Sun, Weight } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

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
