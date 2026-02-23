/** @format */


import { devLog } from "@/lib/processing-utils";
import { gaEvent, GA_EVENT_TAGS, gaTrackSignInClick } from "@/lib/analytics";
import { useState, useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/router";
import { Moon, Sun } from "lucide-react";
import { GoogleLogo } from "@/components/hero-section";
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

const BASIC_THEMES = ["light", "dark"];

/**
 * Dropdown button that lets the user select from all available app themes.
 * Authenticated users can access all themes and toggle the animated background; unauthenticated users are limited to light/dark.
 */
export function ThemeChooser() {
  const router = useRouter();
  const { theme, setTheme, themes } = useTheme();
  const { status: authStatus } = useSession();
  const isAuthenticated = authStatus === "authenticated";
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
          onValueChange={(value) => {
            if (isAuthenticated || BASIC_THEMES.includes(value)) {
              setPosition(value);
              setTheme(value);
            }
          }}
        >
          {themes.map((t) => {
            const isBasicTheme = BASIC_THEMES.includes(t);
            const isLocked = !isAuthenticated && !isBasicTheme;
            return (
              <DropdownMenuRadioItem
                key={t}
                value={t}
                className={cn(
                  isLocked && "opacity-50 pointer-events-none cursor-default"
                )}
              >
                {/* Optionally prettify label */}
                {t
                  .replace(/-/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={animatedBackground ?? false}
          onCheckedChange={(checked) =>
            isAuthenticated && setAnimatedBackground(checked === true)
          }
          className={cn(
            !isAuthenticated && "opacity-50 pointer-events-none cursor-default"
          )}
        >
          Animated background
        </DropdownMenuCheckboxItem>
        {!isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                gaTrackSignInClick(router.pathname);
                signIn("google");
              }}
              className="cursor-pointer"
            >
              <GoogleLogo size={16} />
              <span>
                <span className="font-medium">Sign in with Google</span>
                <span className="text-muted-foreground text-xs block">
                  Unlock all themes and animated background
                </span>
              </span>
            </DropdownMenuItem>
          </>
        )}
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

/**
 * Simple icon button that toggles between light and dark themes.
 * @deprecated Replaced by ThemeChooser; kept for reference but no longer rendered in the app.
 */
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

              gaEvent(GA_EVENT_TAGS.THEME_CHANGED, {
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
