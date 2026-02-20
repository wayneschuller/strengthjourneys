/** @format */
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

export function UnitChooser({ isMetric, onSwitchChange }) {
  const { toast } = useToast();
  const nextUnit = isMetric ? "lb" : "kg";

  const handleClick = () => {
    onSwitchChange(!isMetric);
    toast({
      description: `App units set to ${nextUnit} — all charts and weights updated.`,
      duration: 3000,
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Switch app units to ${nextUnit}`}
            onClick={handleClick}
          >
            {isMetric ? "kg" : "lb"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Switch app units to {nextUnit} — affects all charts and weights</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
