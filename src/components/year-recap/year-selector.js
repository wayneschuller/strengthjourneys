"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

/**
 * Get unique years that have data (ascending).
 * @param {Array} parsedData
 * @returns {number[]}
 */
export function getYearsWithData(parsedData) {
  if (!parsedData || parsedData.length === 0) return [];

  const years = new Set();
  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    const year = new Date(entry.date + "T00:00:00Z").getFullYear();
    years.add(year);
  });

  return Array.from(years).sort((a, b) => a - b);
}

/**
 * Renders a set of year buttons for selecting a recap year, sorted newest-first.
 * Supports a default horizontal layout and a "sidebar" two-column grid variant.
 * @param {Object} props
 * @param {number[]} props.years - Array of years to display as selectable buttons.
 * @param {number} props.selectedYear - The currently selected year, highlighted with primary styling.
 * @param {Function} props.onSelect - Callback invoked with the chosen year number when a button is clicked.
 * @param {string} [props.variant] - Layout variant: "default" (flex-wrap row) or "sidebar" (2-column grid).
 */
export function YearSelector({ years, selectedYear, onSelect, variant = "default" }) {
  const descendingYears = [...years].sort((a, b) => b - a);
  const isSidebar = variant === "sidebar";

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Pick a year</h2>
      <div
        className={cn(
          "gap-3",
          isSidebar ? "grid grid-cols-2" : "flex flex-wrap",
        )}
      >
        {descendingYears.map((year) => (
          <Button
            key={year}
            size="lg"
            variant="outline"
            className={cn(
              "text-lg font-semibold focus-visible:ring-0",
              !isSidebar && "min-w-[120px]",
              selectedYear === year && "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
            )}
            onClick={() => onSelect(year)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {year}
          </Button>
        ))}
      </div>
    </div>
  );
}
