/** @format */

"use client";

import { useState } from "react";
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

export function AthleteBioQuickSettings({ variant = "dropdown" }) {
  const {
    age,
    setAge,
    bodyWeight,
    setBodyWeight,
    sex,
    setSex,
    isMetric,
    toggleIsMetric,
  } = useAthleteBio();

  // Heuristic: if bio matches initial defaults, assume user hasn't customized it yet.
  const hasCustomBio =
    age !== 30 || bodyWeight !== 200 || sex !== "male" || isMetric !== false;

  if (variant === "inline") {
    return (
      <AthleteBioInline
        age={age}
        setAge={setAge}
        bodyWeight={bodyWeight}
        setBodyWeight={setBodyWeight}
        sex={sex}
        setSex={setSex}
        isMetric={isMetric}
        toggleIsMetric={toggleIsMetric}
        hasCustomBio={hasCustomBio}
      />
    );
  }

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
                  !hasCustomBio && "ring-2 ring-amber-400/70",
                )}
              >
                <Activity className="h-4 w-4" />
                {!hasCustomBio && (
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
          {!hasCustomBio && (
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

// Inline variant: shows bio summary text with an Activity toggle button.
// Clicking the button slides out compact editing controls on the same row.
function AthleteBioInline({
  age,
  setAge,
  bodyWeight,
  setBodyWeight,
  sex,
  setSex,
  isMetric,
  toggleIsMetric,
  hasCustomBio,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const unit = isMetric ? "kg" : "lb";

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="wait" initial={false}>
        {isOpen ? (
          <motion.div
            key="controls"
            className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.15 }}
          >
            <Label
              htmlFor="inline-bio-age"
              className="shrink-0 text-xs text-muted-foreground"
            >
              Age
            </Label>
            <Input
              id="inline-bio-age"
              type="number"
              min={13}
              max={100}
              value={age}
              onChange={(e) => {
                const v = parseInt(e.target.value || "0", 10);
                if (!isNaN(v)) setAge(v);
              }}
              className="h-7 w-12 px-2 text-xs"
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
              onChange={(e) => {
                const v = parseInt(e.target.value || "0", 10);
                if (!isNaN(v)) setBodyWeight(v);
              }}
              className="h-7 w-14 px-2 text-xs"
            />
            <UnitChooser isMetric={isMetric} onSwitchChange={toggleIsMetric} />
          </motion.div>
        ) : (
          <motion.p
            key="summary"
            className="flex-1 text-xs text-muted-foreground"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
          >
            {!hasCustomBio && <span className="mr-1 text-amber-500">⚠</span>}
            {bodyWeight}{unit} · {sex} · age {age}
          </motion.p>
        )}
      </AnimatePresence>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? "Close bio settings" : "Edit bio data"}
        className={cn(
          "relative h-7 w-7 shrink-0",
          !hasCustomBio && !isOpen && "ring-2 ring-amber-400/70",
        )}
      >
        {isOpen ? (
          <X className="h-3.5 w-3.5" />
        ) : (
          <Activity className="h-3.5 w-3.5" />
        )}
        {!hasCustomBio && !isOpen && (
          <span className="absolute -right-1 -top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
        )}
      </Button>
    </div>
  );
}
