/** @format */
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useIsClient } from "usehooks-ts";

export function UnitChooser({ isMetric, onSwitchChange }) {
  const isClient = useIsClient();

  if (!isClient) return null; // Don't serve the button until we have client with localstorage

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={`Switch to ${isMetric ? "imperial" : "metric"} units`}
      onClick={() => onSwitchChange(!isMetric)}
    >
      {isMetric ? "kg" : "lb"}
    </Button>
  );
}
