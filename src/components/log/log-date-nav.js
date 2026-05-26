/**
 * Sticky date navigation header for the log page.
 * Keeps calendar-picker rendering separate from session orchestration.
 */

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { getReadableDateString } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SyncIndicator } from "@/components/log/session-summary";

export function LogDateNav({
  datePickerOpen,
  isToday,
  nextSessionDate,
  onDatePickerOpenChange,
  onDatePickerSelect,
  onNavigateToDate,
  previewMode,
  prevSessionDate,
  selectedDateObj,
  sessionDate,
  sessionDateObjects,
  syncState,
  todayIso,
}) {
  return (
    <div className="border-border/40 bg-background/95 sticky top-0 z-[5] flex items-center gap-2 border-b py-3 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        disabled={!prevSessionDate}
        onClick={() => onNavigateToDate(prevSessionDate)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="relative flex-1 text-center">
        <Popover open={datePickerOpen} onOpenChange={onDatePickerOpenChange}>
          <PopoverTrigger asChild>
            <button
              className="hover:bg-muted/40 group mx-auto inline-flex flex-col items-center rounded-md px-3 py-1 transition-colors"
              aria-label="Pick a date"
            >
              <span className="inline-flex items-center gap-1.5 text-lg leading-tight font-semibold">
                <Calendar className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                <span className="decoration-muted-foreground/50 group-hover:decoration-foreground/50 underline decoration-dotted underline-offset-4">
                  {isToday ? "Today" : getReadableDateString(sessionDate, true)}
                </span>
              </span>
              {isToday ? (
                <span className="text-muted-foreground text-xs">
                  {getReadableDateString(sessionDate, true)}
                </span>
              ) : null}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <CalendarWidget
              mode="single"
              selected={selectedDateObj}
              onSelect={onDatePickerSelect}
              disabled={{ after: new Date() }}
              modifiers={{ hasSession: sessionDateObjects }}
              modifiersClassNames={{
                hasSession: "bg-primary/15 font-semibold text-primary",
              }}
              defaultMonth={selectedDateObj}
            />
            {!isToday && (
              <div className="border-border border-t px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onNavigateToDate(todayIso);
                    onDatePickerOpenChange(false);
                  }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Back to today
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {!previewMode && <SyncIndicator state={syncState} />}

      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        disabled={!nextSessionDate}
        onClick={() => onNavigateToDate(nextSessionDate)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
