/**
 * Lift Explorer sidebar card. Provides a searchable shadcn combobox for quickly
 * jumping across every logged lift while preserving the scannable lift list.
 */
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { TopLiftsTable } from "@/components/lift-explorer/top-lifts-table";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { cn } from "@/lib/utils";

const DEFAULT_VISIBLE_LIFT_COUNT = 25;

/**
 * Card containing a searchable lift selector and the default visible lift list.
 * Controlled — caller manages which lift is selected.
 *
 * @param {Object} props
 * @param {string|null} props.selectedLiftType - Currently selected lift type.
 * @param {function} props.onSelectLift - Called with a liftType string on row click.
 */
export function TopLiftsCard({ selectedLiftType, onSelectLift }) {
  const { isDemoMode, liftTypes } = useUserLiftingData();
  const { getColor } = useLiftColors();
  const [isLiftMenuOpen, setIsLiftMenuOpen] = useState(false);
  const allLiftTypes = useMemo(() => liftTypes ?? [], [liftTypes]);

  const stats = useMemo(() => {
    const totalSets = allLiftTypes.reduce(
      (sum, item) => sum + item.totalSets,
      0,
    );

    return allLiftTypes.map((item) => ({
      liftType: item.liftType,
      sets: item.totalSets,
      reps: item.totalReps,
      color: getColor(item.liftType),
      percentage:
        totalSets > 0 ? ((item.totalSets / totalSets) * 100).toFixed(1) : "0.0",
    }));
  }, [allLiftTypes, getColor]);
  const visibleStats = useMemo(() => {
    const firstLifts = stats.slice(0, DEFAULT_VISIBLE_LIFT_COUNT);
    const alreadyVisible = firstLifts.some(
      (item) => item.liftType === selectedLiftType,
    );

    if (!selectedLiftType || alreadyVisible) {
      return firstLifts;
    }

    const selectedLift = stats.find((item) => item.liftType === selectedLiftType);

    return selectedLift ? [...firstLifts, selectedLift] : firstLifts;
  }, [selectedLiftType, stats]);

  if (allLiftTypes.length < 1) return null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="gap-3 [&>*+*]:mt-0">
        <CardTitle className="flex flex-wrap items-center gap-2">
          {isDemoMode && <DemoModeBadge />}
          Your Lifts
        </CardTitle>
        <LiftSearchCombobox
          isOpen={isLiftMenuOpen}
          onOpenChange={setIsLiftMenuOpen}
          stats={stats}
          selectedLiftType={selectedLiftType}
          onSelectLift={onSelectLift}
        />
      </CardHeader>
      <CardContent className="hidden min-h-0 flex-1 overflow-y-auto md:block">
        <TopLiftsTable
          stats={visibleStats}
          selectedLiftType={selectedLiftType}
          onSelectLift={onSelectLift}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Searchable single-select lift menu built from shadcn Popover + Command.
 */
function LiftSearchCombobox({
  isOpen,
  onOpenChange,
  stats,
  selectedLiftType,
  onSelectLift,
}) {
  const selectedLift = stats.find((item) => item.liftType === selectedLiftType);
  const selectedLabel = selectedLift?.liftType ?? "Choose a lift";

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between font-normal"
        >
          <span className="min-w-0 truncate text-left">{selectedLabel}</span>
          <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <Command>
          <CommandInput placeholder="Search lifts..." />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No lifts found.</CommandEmpty>
            <CommandGroup heading="Lifts">
              {stats.map((item) => {
                const isSelected = item.liftType === selectedLiftType;

                return (
                  <CommandItem
                    key={item.liftType}
                    value={`${item.liftType} ${item.sets} sets ${item.reps} reps`}
                    onSelect={() => {
                      onSelectLift?.(item.liftType);
                      onOpenChange(false);
                    }}
                    className="cursor-pointer items-start"
                  >
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-[2px]"
                      style={{ background: item.color }}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate font-medium">{item.liftType}</span>
                      <span className="text-muted-foreground text-xs">
                        {item.sets.toLocaleString()} sets /{" "}
                        {item.reps.toLocaleString()} reps
                      </span>
                    </span>
                    <Check
                      className={cn(
                        "ml-auto",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
