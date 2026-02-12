/** @format */

"use client";

import { devLog } from "@/lib/processing-utils";
import { event } from "@/lib/analytics";
import { useState, useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Palette } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";

export function ThemeChooser() {
  const { theme, setTheme, themes } = useTheme();
  const [position, setPosition] = useState("light");
  const [animatedBackground, setAnimatedBackground] = useLocalStorage(
    LOCAL_STORAGE_KEYS.ANIMATED_BACKGROUND,
    false,
    { initializeWithValue: false },
  );

  useEffect(() => {
    if (theme) {
      setPosition(theme);
    }
  }, [theme]);

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Choose theme">
                <Palette className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Choose visual theme</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent>
        <DropdownMenuLabel>Choose theme:</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={position}
          onValueChange={setPosition}
        >
          {themes.map((t) => (
            <DropdownMenuRadioItem
              key={t}
              value={t}
              onClick={() => setTheme(t)}
            >
              {/* Optionally prettify label */}
              {t
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={animatedBackground ?? false}
          onCheckedChange={(checked) =>
            setAnimatedBackground(checked === true)
          }
        >
          Animated background
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const DARK_THEMES = [
  "dark",
  "neo-brutalism-dark",
  "retro-arcade-dark",
  "starry-night-dark",
];

// This is the old dark mode toggle that is no longer used
export function DarkModeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = DARK_THEMES.includes(theme ?? "");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const newTheme = theme === "dark" ? "light" : "dark";
              setTheme(newTheme);

              event("theme_changed", {
                event_category: "User Preferences",
                event_label: `Theme changed to ${newTheme}`,
              });
            }}
          >
            <Moon
              className={cn(
                "absolute h-[1.2rem] w-[1.2rem] transition-all",
                isDark ? "scale-100 rotate-0" : "scale-0 rotate-90",
              )}
            />
            <Sun
              className={cn(
                "h-[1.2rem] w-[1.2rem] transition-all",
                isDark ? "scale-0 -rotate-90" : "scale-100 rotate-0",
              )}
            />
            <span className="sr-only">Toggle dark mode</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle dark mode</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
