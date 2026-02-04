/** @format */

"use client";

import { devLog } from "@/lib/processing-utils";
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

export function ThemeChooser() {
  const { theme, setTheme, themes } = useTheme();
  const [position, setPosition] = useState("light");
  const [animatedBackground, setAnimatedBackground] = useLocalStorage(
    LOCAL_STORAGE_KEYS.ANIMATED_BACKGROUND,
    false,
    { initializeWithValue: false }
  );

  useEffect(() => {
    if (theme) {
      setPosition(theme);
    }
  }, [theme]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Choose theme">
                <Palette className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
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
        </TooltipTrigger>
        <TooltipContent>Choose visual theme</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// This is the old dark mode toggle that is no longer used
export function DarkModeToggle() {
  const { theme, setTheme } = useTheme();

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

              if (
                typeof window !== "undefined" &&
                process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV !== "development"
              ) {
                window.gtag("event", "theme_changed", {
                  event_category: "User Preferences",
                  event_label: `Theme changed to ${newTheme}`,
                });
              }
            }}
          >
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <span className="sr-only">Toggle dark mode</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle dark mode</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
