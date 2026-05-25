/**
 * Unit label for editable log set rows.
 * Shows a tooltip only when the row unit differs from the active preference.
 */

import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function UnitLabel({ unitType, mismatch }) {
  if (!mismatch) {
    return (
      <span className="text-muted-foreground ml-0.5 text-sm font-medium">
        {unitType}
      </span>
    );
  }
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground ml-0.5 inline-flex items-center gap-0.5 text-sm font-medium">
            {unitType}
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-52 text-center">
          Showing {unitType} — the original unit in your spreadsheet
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
