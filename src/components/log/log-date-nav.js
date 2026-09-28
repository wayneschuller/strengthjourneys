/**
 * Sticky date navigation header for the log page.
 * Keeps calendar-picker rendering separate from session orchestration.
 */

import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { getReadableDateString } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SyncIndicator } from "@/components/log/session-summary";

// The span is the trigger because a disabled Button drops pointer events,
// and a greyed-out chevron should still say why.
function NavChevron({ disabled, icon: Icon, label, onClick, tooltip }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0">
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function LogDateNav({
  datePickerOpen,
  firstSessionDate,
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
  const atFirst = !firstSessionDate || sessionDate <= firstSessionDate;
  const atToday = sessionDate >= todayIso;
  const describe = (date) =>
    date === todayIso ? "Today" : getReadableDateString(date, true);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="border-border/40 bg-background/95 sticky top-0 z-[5] flex items-center gap-2 border-b py-3 backdrop-blur-sm">
        <NavChevron
          icon={ChevronsLeft}
          label="First session"
          disabled={atFirst}
          onClick={() => onNavigateToDate(firstSessionDate)}
          tooltip={
            firstSessionDate
              ? `First session: ${describe(firstSessionDate)}`
              : "First session"
          }
        />

        <NavChevron
          icon={ChevronLeft}
          label="Previous session"
          disabled={!prevSessionDate}
          onClick={() => onNavigateToDate(prevSessionDate)}
          tooltip={
            prevSessionDate
              ? `Previous session: ${describe(prevSessionDate)}`
              : "You're at the start"
          }
        />

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
                    {isToday
                      ? "Today"
                      : getReadableDateString(sessionDate, true)}
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

        <NavChevron
          icon={ChevronRight}
          label="Next session"
          disabled={!nextSessionDate}
          onClick={() => onNavigateToDate(nextSessionDate)}
          tooltip={
            nextSessionDate === todayIso
              ? "Today"
              : nextSessionDate
                ? `Next session: ${describe(nextSessionDate)}`
                : "You're on today"
          }
        />

        <NavChevron
          icon={ChevronsRight}
          label="Today"
          disabled={atToday}
          onClick={() => onNavigateToDate(todayIso)}
          tooltip={atToday ? "You're on today" : "Jump to today"}
        />
      </div>
    </TooltipProvider>
  );
}
