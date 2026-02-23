/** @format */

import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import GridPattern from "./magicui/grid-pattern";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import FlickeringGrid from "./magicui/flickering-grid";
import {
  StarryNightLayer,
  WarpBackground,
} from "@/components/theme-backgrounds";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";

const staticGridClassName = cn(
  "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-foreground/30",
  "[mask-image:radial-gradient(1200px_circle_at_top_left,white,transparent)]",
  "inset-x-0 inset-y-[-30%] h-[200%] -skew-y-12",
);

const blueprintMaskClassName =
  "[mask-image:radial-gradient(140vmax_circle_at_top_left,white_0,white_72%,transparent_100%)]";

const blueprintOverlayClassName = cn(
  "pointer-events-none absolute inset-0",
  blueprintMaskClassName,
);

const GRID_SQUARES = [
  [0, 3],
  [4, 5],
  [10, 6],
  [6, 7],
  [22, 7],
  [1, 8],
  [16, 10],
  [0, 11],
  [3, 14],
  [8, 15],
  [14, 16],
];

const BLUEPRINT_SQUARES = [
  [1, 2],
  [2, 3],
  [5, 4],
  [7, 6],
  [10, 3],
  [12, 6],
  [15, 9],
  [18, 7],
  [20, 10],
  [23, 12],
];

/**
 * Fixed full-viewport decorative background layer. Renders a theme-appropriate
 * grid pattern, starry night layer, flickering grid, or warp effect depending
 * on the active theme and the user's animated background preference.
 *
 * @param {Object} props - No props; reads theme and local storage settings internally.
 */
export function AppBackground() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = theme ?? resolvedTheme ?? "light";
  const [animatedBackground] = useLocalStorage(
    LOCAL_STORAGE_KEYS.ANIMATED_BACKGROUND,
    false,
    { initializeWithValue: false },
  );

  // Avoid theme-based SSR/CSR mismatch: until mounted, assume light theme for
  // background so static output is identical on server and first client paint.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const themeForBackground = mounted ? currentTheme : "light";

  const isRetroArcade =
    themeForBackground === "retro-arcade" ||
    themeForBackground === "retro-arcade-dark";
  const isNeoBrutalism =
    themeForBackground === "neo-brutalism" ||
    themeForBackground === "neo-brutalism-dark";
  const isStarryNight =
    themeForBackground === "starry-night" ||
    themeForBackground === "starry-night-dark";
  const isBlueprint =
    themeForBackground === "blueprint" ||
    themeForBackground === "blueprint-dark";
  const isBlueprintDark = themeForBackground === "blueprint-dark";

  const showAnimated = animatedBackground ?? false;
  const isVanillaLightDark =
    !isRetroArcade && !isNeoBrutalism && !isStarryNight && !isBlueprint;
  const showStaticGrid = !showAnimated && !isStarryNight && !isBlueprint;
  const showAnimatedGrid = mounted && showAnimated && isVanillaLightDark;

  return (
    <div className="fixed inset-0 z-0">
      {/* Starry night theme: only star layer, no grid */}
      {mounted && isStarryNight && (
        <StarryNightLayer
          animated={showAnimated}
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full",
            themeForBackground === "starry-night-dark"
              ? "text-amber-100/60"
              : "text-primary/85",
          )}
        />
      )}

      {/* Blueprint theme: loud drafting-paper grids + accents */}
      {mounted && isBlueprint && (
        <div className="absolute inset-0 overflow-hidden">
          {/* Atmospheric wash */}
          <div
            aria-hidden
            className={cn(
              "absolute inset-0",
              isBlueprintDark
                ? "bg-[radial-gradient(900px_circle_at_18%_12%,rgba(107,242,255,0.12),transparent_56%),radial-gradient(820px_circle_at_86%_44%,rgba(255,166,60,0.10),transparent_62%)]"
                : "bg-[radial-gradient(900px_circle_at_18%_12%,rgba(47,120,214,0.13),transparent_56%),radial-gradient(820px_circle_at_86%_44%,rgba(255,166,60,0.11),transparent_62%)]",
            )}
          />

          {/* Diagonal hatch */}
          <div
            aria-hidden
            className={cn(
              blueprintOverlayClassName,
              "text-primary/25",
              "bg-[repeating-linear-gradient(135deg,transparent_0_18px,currentColor_18px_19px,transparent_19px_36px)]",
              "opacity-85",
            )}
          />

          {!showAnimated && (
            <>
              <GridPattern
                width={70}
                height={70}
                x={-7}
                y={-9}
                strokeDasharray="0"
                squares={BLUEPRINT_SQUARES}
                className={cn(
                  "fill-primary/12 stroke-primary/40",
                  "scale-[1.10] rotate-[-16deg]",
                  "origin-top-left",
                  "opacity-75",
                  blueprintMaskClassName,
                )}
              />
              <GridPattern
                width={24}
                height={24}
                x={-3}
                y={-5}
                strokeDasharray="2 10"
                className={cn(
                  "fill-accent/12 stroke-foreground/18",
                  "scale-[1.03] rotate-[12deg]",
                  "origin-top-left",
                  "opacity-65",
                  blueprintMaskClassName,
                )}
              />
              <GridPattern
                width={12}
                height={12}
                x={-2}
                y={-2}
                strokeDasharray="1 7"
                className={cn(
                  "stroke-primary/22 fill-transparent",
                  "rotate-[26deg]",
                  "origin-top-left",
                  "opacity-55",
                  blueprintMaskClassName,
                )}
              />
            </>
          )}

          {showAnimated && (
            <>
              <AnimatedGridPattern
                numSquares={58}
                maxOpacity={0.34}
                duration={2.4}
                repeatDelay={0.25}
                width={44}
                height={44}
                x={-6}
                y={-10}
                strokeDasharray="0"
                className={cn(
                  "pointer-events-none absolute inset-0 h-full w-full",
                  "text-accent/55",
                  "stroke-primary/40 fill-transparent",
                  "scale-[1.08] rotate-[-16deg]",
                  "origin-top-left",
                  "opacity-80",
                  blueprintMaskClassName,
                )}
              />
              <AnimatedGridPattern
                numSquares={78}
                maxOpacity={0.26}
                duration={3.2}
                repeatDelay={0.35}
                width={18}
                height={18}
                x={-3}
                y={-5}
                strokeDasharray="2 10"
                className={cn(
                  "pointer-events-none absolute inset-0 h-full w-full",
                  "text-primary/45",
                  "stroke-foreground/22 fill-transparent",
                  "rotate-[12deg]",
                  "origin-top-left",
                  "opacity-70",
                  blueprintMaskClassName,
                )}
              />
            </>
          )}

          {/* Corner framing */}
          <div
            aria-hidden
            className={cn(
              "absolute top-10 left-10 h-[1px] w-[42vw]",
              "bg-primary/35",
              "[mask-image:linear-gradient(to_right,white,transparent)]",
            )}
          />
          <div
            aria-hidden
            className={cn(
              "absolute top-10 left-10 h-[42vh] w-[1px]",
              "bg-primary/35",
              "[mask-image:linear-gradient(to_bottom,white,transparent)]",
            )}
          />
        </div>
      )}

      {/* Static GridPattern when animated is disabled (not for starry night) */}
      {showStaticGrid && (
        <GridPattern squares={GRID_SQUARES} className={staticGridClassName} />
      )}

      {/* Animated GridPattern for light/dark when animated is enabled */}
      {showAnimatedGrid && (
        <AnimatedGridPattern
          numSquares={80}
          maxOpacity={0.22}
          duration={1.5}
          repeatDelay={0.3}
          className={cn(
            "stroke-foreground/30 pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30",
            "[mask-image:radial-gradient(1200px_circle_at_top_left,white,transparent)]",
            "inset-x-0 inset-y-[-30%] h-[200%] -skew-y-12",
          )}
        />
      )}

      {/* Bold, primary-colored flickering background for neo-brutalism themes */}
      {mounted && showAnimated && isNeoBrutalism && (
        <>
          {/* Primary red layer */}
          <FlickeringGrid
            className="pointer-events-none absolute inset-0 h-full w-full"
            squareSize={10}
            gridGap={28}
            flickerChance={themeForBackground === "neo-brutalism" ? 0.06 : 0.12}
            maxOpacity={themeForBackground === "neo-brutalism" ? 0.16 : 0.2}
            color={
              themeForBackground === "neo-brutalism"
                ? "hsl(0 100% 60%)" // primary red on light
                : "hsl(0 100% 70%)" // primary red on dark
            }
          />
          {/* Secondary yellow layer */}
          <FlickeringGrid
            className="pointer-events-none absolute inset-0 h-full w-full"
            squareSize={12}
            gridGap={32}
            flickerChance={themeForBackground === "neo-brutalism" ? 0.05 : 0.1}
            maxOpacity={themeForBackground === "neo-brutalism" ? 0.13 : 0.17}
            color={
              themeForBackground === "neo-brutalism"
                ? "hsl(60 100% 50%)" // secondary yellow on light
                : "hsl(60 100% 60%)" // secondary yellow on dark
            }
          />
        </>
      )}

      {/* Warp background for retro-arcade themes */}
      {mounted && showAnimated && isRetroArcade && (
        <WarpBackground
          className="pointer-events-none absolute inset-0 border-0 p-0"
          perspective={140}
          beamsPerSide={4}
          beamSize={6}
          beamDelayMin={0}
          beamDelayMax={3}
          beamDuration={3.5}
          gridColor={
            themeForBackground === "retro-arcade"
              ? "rgba(95, 168, 163, 0.6)" // teal-ish grid for light retro
              : "rgba(214, 107, 122, 0.7)" // pink-ish grid for dark retro
          }
        >
          {/* Empty child just to satisfy WarpBackground API while using it purely as a background */}
          <div className="h-full w-full" />
        </WarpBackground>
      )}
    </div>
  );
}

export default AppBackground;
