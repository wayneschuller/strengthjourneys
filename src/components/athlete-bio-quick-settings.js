/** @format */


import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { UnitChooser } from "@/components/unit-type-chooser";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnimatePresence, motion } from "motion/react";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { cn } from "@/lib/utils";
import { Activity, X } from "lucide-react";

/**
 * Dropdown variant of the athlete bio settings panel, used in the nav bar.
 * Renders an icon button that opens a dropdown with age, sex, and bodyweight controls.
 */
export function AthleteBioQuickSettings() {
  const {
    age,
    setAge,
    bodyWeight,
    setBodyWeight,
    sex,
    setSex,
    isMetric,
    toggleIsMetric,
    bioDataIsDefault,
  } = useAthleteBio();

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                aria-label="Set athlete bio data"
                className={cn(
                  "relative",
                  bioDataIsDefault && "ring-2 ring-amber-400/70",
                )}
              >
                <Activity className="h-4 w-4" />
                {bioDataIsDefault && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Set athlete age, weight, and sex</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Your bio data</span>
          {bioDataIsDefault && (
            <Badge
              variant="secondary"
              className="text-[0.6rem] font-semibold uppercase tracking-wide animate-pulse"
            >
              Recommended
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-3 px-3 pt-2 pb-3 text-xs">
          {/* Row 1: Age input + sex switch */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="nav-athlete-age"
                className="text-xs font-normal text-muted-foreground"
              >
                Age
              </Label>
              <Input
                id="nav-athlete-age"
                type="number"
                min={13}
                max={100}
                value={age}
                onChange={(event) => {
                  const value = parseInt(event.target.value || "0", 10);
                  if (!Number.isNaN(value)) {
                    setAge(value);
                  }
                }}
                className="h-7 w-16 px-2 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                M
              </span>
              <Switch
                id="nav-athlete-sex-switch"
                checked={sex === "female"}
                onCheckedChange={(checked) =>
                  setSex(checked ? "female" : "male")
                }
                className="h-5 w-9 data-[state=checked]:bg-pink-500"
              />
              <span className="pl-1 text-xs font-semibold text-muted-foreground">
                F
              </span>
            </div>
          </div>

          {/* Row 2: Bodyweight slider with inline unit chooser */}
          <div className="space-y-2 pt-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="nav-athlete-bodyweight-slider"
                className="text-xs font-normal text-muted-foreground"
              >
                Bodyweight
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{bodyWeight}</span>
                <UnitChooser
                  isMetric={isMetric}
                  onSwitchChange={toggleIsMetric}
                />
              </div>
            </div>
            <div className="pt-0.5">
              <Slider
                id="nav-athlete-bodyweight-slider"
                min={isMetric ? 40 : 90}
                max={isMetric ? 180 : 400}
                step={1}
                value={[bodyWeight]}
                onValueChange={(values) => setBodyWeight(values[0])}
                aria-label="Bodyweight"
              />
            </div>
          </div>
          <p className="pt-1 text-[10px] leading-snug text-muted-foreground">
            We only store this in your browser to power strength level
            calculations. For more details, see our{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Inline variant of the athlete bio settings panel, used inside the calculator's Big Four strength section.
 * Shows a bio summary line with an edit toggle that slides out compact age, sex, and bodyweight controls.
 * Auto-opens once on mount when bio data is genuinely at defaults (never set by the user).
 *
 * @param {Object} props
 * @param {string} [props.liftNote] - Optional extra context appended to the summary line (e.g. "lifting 239lb in each lift type").
 * @param {boolean} [props.forceStackedControls] - Render controls below the summary and allow wrapping within the parent width.
 * @param {string} [props.defaultBioPrompt] - Custom summary text shown when bio data is still default/unset.
 */
export function AthleteBioInlineSettings({
  liftNote,
  forceStackedControls = false,
  defaultBioPrompt,
}) {
  const {
    age,
    setAge,
    bodyWeight,
    setBodyWeight,
    sex,
    setSex,
    isMetric,
    toggleIsMetric,
    bioDataIsDefault,
    bioDataIsInitialized,
  } = useAthleteBio();

  // Auto-open once bio data has been read from localStorage and is genuinely still at defaults.
  // The ref prevents re-opening if the user closes the panel and then something re-renders.
  const [isOpen, setIsOpen] = useState(false);
  const hasSetInitialOpen = useRef(false);
  useEffect(() => {
    if (!bioDataIsInitialized || hasSetInitialOpen.current) return;
    hasSetInitialOpen.current = true;
    if (bioDataIsDefault) setIsOpen(true);
  }, [bioDataIsInitialized, bioDataIsDefault]);
  const unit = isMetric ? "kg" : "lb";

  // JSX bio summary — values are bolded, labels stay light
  const bioSummaryContent = (bioDataIsDefault && defaultBioPrompt) ? (
    defaultBioPrompt
  ) : (
    <>
      Strength levels for a{" "}
      <strong className="font-semibold text-foreground">{bodyWeight}{unit}</strong>{" "}
      <strong className="font-semibold text-foreground">{sex}</strong>,{" "}
      age <strong className="font-semibold text-foreground">{age}</strong>
      {liftNote ? ` ${liftNote}` : ""}
      {bioDataIsDefault ? " · enter your details" : ""}.
    </>
  );

  const ageOnChange = (e) => {
    const v = parseInt(e.target.value || "0", 10);
    if (!isNaN(v)) setAge(v);
  };
  const bwOnChange = (e) => {
    const v = parseInt(e.target.value || "0", 10);
    if (!isNaN(v)) setBodyWeight(v);
  };

  return (
    <div className={cn("flex flex-col items-center gap-1", forceStackedControls && "w-full")}>
      {/* Row 1: bio summary + toggle button — always visible */}
      <div className={cn(
        "flex items-center gap-2",
        forceStackedControls && "w-full flex-wrap justify-center",
      )}>
        <p className={cn(
          "text-xs",
          bioDataIsDefault ? "text-amber-500" : "text-muted-foreground",
          forceStackedControls && "text-center",
        )}>
          {bioSummaryContent}
        </p>

        {/* Button — desktop controls float right of it; mobile controls appear below */}
        <div className="relative shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsOpen((o) => !o)}
                  aria-label={isOpen ? "Close bio settings" : "Edit bio data"}
                  className={cn(
                    "relative h-7 w-7",
                    bioDataIsDefault && !isOpen && "ring-2 ring-amber-400/70",
                  )}
                >
                  {isOpen ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Activity className="h-3.5 w-3.5" />
                  )}
                  {bioDataIsDefault && !isOpen && (
                    <span className="absolute -right-1 -top-1 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Set athlete age, weight, and sex</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Desktop: controls float right of the button */}
          <AnimatePresence>
            {isOpen && !forceStackedControls && (
              <motion.div
                className="absolute left-full top-1/2 ml-2 hidden -translate-y-1/2 items-center gap-x-2 whitespace-nowrap xl:flex"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
              >
                <Label htmlFor="inline-bio-age" className="text-xs text-muted-foreground">Age</Label>
                <Input
                  id="inline-bio-age"
                  type="number"
                  min={13}
                  max={100}
                  value={age}
                  onChange={ageOnChange}
                  className="h-7 w-16 px-2 text-xs"
                />
                <span className="text-xs font-semibold text-muted-foreground">M</span>
                <Switch
                  id="inline-bio-sex"
                  checked={sex === "female"}
                  onCheckedChange={(c) => setSex(c ? "female" : "male")}
                  className="h-5 w-9 data-[state=checked]:bg-pink-500"
                />
                <span className="text-xs font-semibold text-muted-foreground">F</span>
                <Input
                  type="number"
                  min={isMetric ? 40 : 90}
                  max={isMetric ? 180 : 400}
                  value={bodyWeight}
                  onChange={bwOnChange}
                  className="h-7 w-20 px-2 text-xs"
                />
                <UnitChooser isMetric={isMetric} onSwitchChange={toggleIsMetric} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile: controls appear on the next row, centred */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={cn(
              "items-center justify-center gap-x-2 gap-y-2",
              forceStackedControls
                ? "flex w-full flex-wrap justify-center"
                : "flex xl:hidden",
            )}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Age</span>
              <Input
                aria-label="Age"
                type="number"
                min={13}
                max={100}
                value={age}
                onChange={ageOnChange}
                className="h-7 w-16 px-2 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-xs font-semibold text-muted-foreground">M</span>
              <Switch
                aria-label="Sex"
                checked={sex === "female"}
                onCheckedChange={(c) => setSex(c ? "female" : "male")}
                className="h-5 w-9 data-[state=checked]:bg-pink-500"
              />
              <span className="text-xs font-semibold text-muted-foreground">F</span>
            </div>

            <div className="flex items-center gap-2">
              <Input
                aria-label="Bodyweight"
                type="number"
                min={isMetric ? 40 : 90}
                max={isMetric ? 180 : 400}
                value={bodyWeight}
                onChange={bwOnChange}
                className="h-7 w-20 px-2 text-xs"
              />
              <UnitChooser isMetric={isMetric} onSwitchChange={toggleIsMetric} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
