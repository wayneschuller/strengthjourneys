/** @format */

"use client";

import { useState, useEffect } from "react";
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
} from "@/components/ui/dropdown-menu";
import { Palette } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeChooser() {
  const { theme, setTheme } = useTheme();
  const [position, setPosition] = useState("light");

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
              <Button size="icon" variant="outline">
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
                <DropdownMenuRadioItem
                  value="light"
                  onClick={() => setTheme("light")}
                >
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="dark"
                  onClick={() => setTheme("dark")}
                >
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="neo-brutalism"
                  onClick={() => setTheme("neo-brutalism")}
                >
                  Neo-Brutalism
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="neo-brutalism-dark"
                  onClick={() => setTheme("neo-brutalism-dark")}
                >
                  Neo-Brutalism (Dark)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="retro-arcade"
                  onClick={() => setTheme("retro-arcade")}
                >
                  Retro Arcade
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="retro-arcade-dark"
                  onClick={() => setTheme("retro-arcade-dark")}
                >
                  Retro Arcade (Dark)
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>Choose visual theme</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
