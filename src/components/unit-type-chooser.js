/** @format */
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function UnitChooser({ isMetric, onSwitchChange }) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => onSwitchChange(!isMetric)}
    >
      {isMetric ? "kg" : "lb"}
    </Button>
  );
}
