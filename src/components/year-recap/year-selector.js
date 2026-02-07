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

export function YearSelector({ years, selectedYear, onSelect }) {
  const descendingYears = [...years].sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Pick a year</h2>
      <div className="flex flex-wrap gap-3">
        {descendingYears.map((year) => (
          <Button
            key={year}
            size="lg"
            variant="outline"
            className={cn(
              "min-w-[120px] text-lg font-semibold focus-visible:ring-0",
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
