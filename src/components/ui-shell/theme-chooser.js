/**
 * Theme controls for the app shell, including training-history reward unlocks.
 * Only real user data counts; demo data never grants reward progress.
 */

import { useEffect, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";
import { useSession } from "next-auth/react";
import { Lock, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { GoogleSignInMenuItem } from "@/components/onboarding/google-sign-in";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  getRewardRequirement,
  getThemeUnlocks,
  THEME_REWARDS,
} from "@/lib/theme-unlocks";
import { cn } from "@/lib/utils";

/**
 * Dropdown button that lets the user select from all available app themes.
 * Real training data progressively unlocks signed-in theme rewards.
 */
export function ThemeChooser() {
  const { theme, setTheme, themes } = useTheme();
  const { status: authStatus } = useSession();
  const { parsedData, isDemoMode, isLoading, isReturningUserLoading } =
    useUserLiftingData();
  const isAuthenticated = authStatus === "authenticated";
  const [animatedBackground, setAnimatedBackground] = useLocalStorage(
    LOCAL_STORAGE_KEYS.ANIMATED_BACKGROUND,
    false,
    { initializeWithValue: false },
  );
  const [showBackground, setShowBackground] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHOW_BACKGROUND,
    true,
    { initializeWithValue: false },
  );
  const { metrics, unlockedThemes, nextReward } = useMemo(
    () =>
      getThemeUnlocks({
        isAuthenticated,
        isDemoMode,
        parsedData,
      }),
    [isAuthenticated, isDemoMode, parsedData],
  );

  useEffect(() => {
    const isUserDataLoading = isLoading || isReturningUserLoading;
    if (authStatus === "loading" || isUserDataLoading || !theme) return;
    if (unlockedThemes.has(theme)) return;

    setTheme("light");
  }, [
    authStatus,
    isLoading,
    isReturningUserLoading,
    setTheme,
    theme,
    unlockedThemes,
  ]);

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
          value={unlockedThemes.has(theme) ? theme : "light"}
          onValueChange={(value) => {
            if (unlockedThemes.has(value)) {
              setTheme(value);
            }
          }}
        >
          {themes.map((t) => {
            const isLocked = !unlockedThemes.has(t);
            const reward = THEME_REWARDS.find(({ themes: rewardThemes }) =>
              rewardThemes.includes(t),
            );
            return (
              <DropdownMenuRadioItem
                key={t}
                value={t}
                disabled={isLocked}
                className={cn(
                  "gap-2",
                  isLocked && "opacity-50 cursor-default",
                )}
              >
                <span className="flex-1">
                  {t
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                  {isLocked && isAuthenticated && reward && (
                    <span className="text-muted-foreground block text-[10px] leading-tight">
                      {getRewardRequirement(reward)}
                    </span>
                  )}
                </span>
                {isLocked && <Lock className="h-3 w-3" />}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={showBackground ?? true}
          onCheckedChange={(checked) => setShowBackground(checked === true)}
        >
          Background
        </DropdownMenuCheckboxItem>
        {(showBackground ?? true) && (
          <DropdownMenuCheckboxItem
            checked={animatedBackground ?? false}
            onCheckedChange={(checked) =>
              isAuthenticated && setAnimatedBackground(checked === true)
            }
            className={cn(
              "pl-8 text-muted-foreground",
              !isAuthenticated &&
                "opacity-50 pointer-events-none cursor-default",
            )}
          >
            Animated background
          </DropdownMenuCheckboxItem>
        )}
        {!isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <GoogleSignInMenuItem cta="theme_chooser">
              <span>
                <span className="font-medium">Sign in with Google</span>
                <span className="text-muted-foreground text-xs block">
                  Earn themes from your training history
                </span>
              </span>
            </GoogleSignInMenuItem>
          </>
        )}
        {isAuthenticated && nextReward && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="max-w-64 whitespace-normal text-xs font-normal">
              <span className="font-medium">Next: {nextReward.label}</span>
              {nextReward.sets === 1 ? (
                <span className="text-muted-foreground block">
                  Log your first real set to unlock both variants.
                </span>
              ) : (
                <span className="text-muted-foreground block">
                  {metrics.setCount}/{nextReward.sets} sets · {metrics.repCount}/
                  {nextReward.reps} reps · {metrics.historyDays}/
                  {nextReward.historyDays} days
                </span>
              )}
              <span className="text-muted-foreground block">
                Reach any one to unlock it.
              </span>
            </DropdownMenuLabel>
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
