/**
 * Lift Explorer sidebar card. Combines a searchable shadcn combobox for jumping
 * straight to a known lift with a browsable list for everything else.
 *
 * The list is a lens, not a fixed ranking: the same lifts can be sorted by
 * volume, recency, staleness, or name. "Stale" is the exploratory one — it
 * surfaces movements you used to train and quietly dropped, which is the kind
 * of thing a spreadsheet will never volunteer.
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { LiftPickerList } from "@/components/lift-explorer/lift-picker-list";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getCompactAgeFromYmd, formatDateToYmdLocal } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const DEFAULT_VISIBLE_LIFT_COUNT = 25;
const MOBILE_CHIP_COUNT = 8;

// A lift needs some history before "you haven't touched this in a while" is
// interesting, otherwise one-off experiments crowd out the real dropped lifts.
const STALE_LENS_MIN_SETS = 5;

const SORT_MODES = [
  { value: "sets", label: "Top", title: "Most trained" },
  { value: "recent", label: "Recent", title: "Most recently trained" },
  { value: "stale", label: "Stale", title: "Longest since you trained it" },
  { value: "alpha", label: "A–Z", title: "Alphabetical" },
];

/**
 * Card containing a searchable lift selector and the browsable lift list.
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
  const [sortMode, setSortMode] = useState("sets");
  const [isListExpanded, setIsListExpanded] = useState(false);
  // Read the clock once on mount so relative ages stay pure across renders.
  const [todayYmd] = useState(() => formatDateToYmdLocal(new Date()));
  const allLiftTypes = useMemo(() => liftTypes ?? [], [liftTypes]);

  const stats = useMemo(() => {
    // liftTypes arrives sorted by set count descending, so the first entry sets
    // the scale every volume bar is drawn against.
    const topSets = allLiftTypes[0]?.totalSets ?? 0;

    return allLiftTypes.map((item, index) => ({
      liftType: item.liftType,
      sets: item.totalSets,
      reps: item.totalReps,
      lastDate: item.newestDate,
      age: getCompactAgeFromYmd(item.newestDate, todayYmd),
      rank: index + 1,
      // Floor the width so the rarest lifts still show a sliver of colour.
      barPercent:
        topSets > 0 ? Math.max((item.totalSets / topSets) * 100, 2) : 0,
      color: getColor(item.liftType),
    }));
  }, [allLiftTypes, getColor, todayYmd]);

  const sortedStats = useMemo(() => {
    // YYYY-MM-DD sorts lexically, so date lenses need no Date objects.
    if (sortMode === "alpha") {
      return [...stats].sort((a, b) => a.liftType.localeCompare(b.liftType));
    }

    if (sortMode === "recent") {
      return [...stats].sort((a, b) =>
        (b.lastDate ?? "").localeCompare(a.lastDate ?? ""),
      );
    }

    if (sortMode === "stale") {
      const established = stats.filter(
        (item) => item.sets >= STALE_LENS_MIN_SETS,
      );
      const pool = established.length > 0 ? established : stats;

      return [...pool].sort((a, b) =>
        (a.lastDate ?? "").localeCompare(b.lastDate ?? ""),
      );
    }

    return stats; // Already sorted by set count descending upstream
  }, [sortMode, stats]);

  const visibleStats = useMemo(
    () =>
      isListExpanded
        ? sortedStats
        : sortedStats.slice(0, DEFAULT_VISIBLE_LIFT_COUNT),
    [isListExpanded, sortedStats],
  );

  // A selected lift below the fold is shown in its own block rather than
  // appended to the list, where it would read as the next lift in the ranking.
  const outOfViewSelected = useMemo(() => {
    if (!selectedLiftType) return null;
    if (visibleStats.some((item) => item.liftType === selectedLiftType)) {
      return null;
    }

    return sortedStats.find((item) => item.liftType === selectedLiftType) ?? null;
  }, [selectedLiftType, sortedStats, visibleStats]);

  const hiddenCount = sortedStats.length - visibleStats.length;

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
        <Tabs value={sortMode} onValueChange={setSortMode}>
          <TabsList className="grid h-8 w-full grid-cols-4">
            {SORT_MODES.map((mode) => (
              <TabsTrigger
                key={mode.value}
                value={mode.value}
                title={mode.title}
                className="px-1 text-xs"
              >
                {mode.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 md:overflow-y-auto">
        {/* Phones can't fit the list, but a scrollable strip still beats a lone dropdown */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
          {sortedStats.slice(0, MOBILE_CHIP_COUNT).map((item) => (
            <LiftChip
              key={item.liftType}
              item={item}
              isSelected={item.liftType === selectedLiftType}
              onSelectLift={onSelectLift}
            />
          ))}
        </div>
        <div className="hidden md:block">
          {/* Expanded, a long lifting history runs to hundreds of movements, so
              it scrolls inside the card rather than down the whole page. */}
          <div className={cn(isListExpanded && "max-h-[70vh] overflow-y-auto")}>
            <LiftPickerList
              stats={visibleStats}
              selectedLiftType={selectedLiftType}
              onSelectLift={onSelectLift}
              showRank={sortMode === "sets"}
            />
            {outOfViewSelected && (
              <div className="mt-1 border-t pt-1">
                <LiftPickerList
                  stats={[outOfViewSelected]}
                  selectedLiftType={selectedLiftType}
                  onSelectLift={onSelectLift}
                />
              </div>
            )}
          </div>
          {(hiddenCount > 0 || isListExpanded) && (
            <button
              type="button"
              onClick={() => setIsListExpanded((expanded) => !expanded)}
              className="text-muted-foreground hover:text-foreground mt-1 w-full px-1.5 py-1 text-left text-xs underline-offset-2 hover:underline"
            >
              {isListExpanded
                ? "Show fewer lifts"
                : `+${hiddenCount} more ${hiddenCount === 1 ? "lift" : "lifts"}`}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Single lift pill used in the mobile strip.
 */
function LiftChip({ item, isSelected, onSelectLift }) {
  return (
    <button
      type="button"
      onClick={() => onSelectLift?.(item.liftType)}
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs whitespace-nowrap",
        isSelected ? "bg-muted font-medium" : "hover:bg-muted/50",
      )}
    >
      <span
        aria-hidden="true"
        className="size-2 rounded-[2px]"
        style={{ background: item.color }}
      />
      {item.liftType}
      {item.age && (
        <span className="text-muted-foreground tabular-nums">{item.age}</span>
      )}
    </button>
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
        className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] p-0 md:w-[var(--radix-popover-trigger-width)]"
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
                        {item.age ? ` · ${item.age}` : ""}
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
