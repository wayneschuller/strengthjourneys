/** @format */

"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const DarkModeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              theme === "dark" ? setTheme("light") : setTheme("dark");
            }}
          >
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle dark mode</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
