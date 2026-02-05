/** @format */

"use client";

import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import GridPattern from "./magicui/grid-pattern";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import FlickeringGrid from "./magicui/flickering-grid";
import { WarpBackground } from "@/components/ui/warp-background";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";


const staticGridClassName = cn(
  "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-foreground/30",
  "[mask-image:radial-gradient(1200px_circle_at_top_left,white,transparent)]",
  "inset-x-0 inset-y-[-30%] h-[200%] -skew-y-12"
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

export function AppBackground() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = theme ?? resolvedTheme ?? "light";
  const [animatedBackground] = useLocalStorage(
    LOCAL_STORAGE_KEYS.ANIMATED_BACKGROUND,
    false,
    { initializeWithValue: false }
  );

  // Avoid theme-based SSR/CSR mismatch by only rendering
  // theme-conditional backgrounds after the component mounts.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isRetroArcade =
    currentTheme === "retro-arcade" || currentTheme === "retro-arcade-dark";
  const isNeoBrutalism =
    currentTheme === "neo-brutalism" ||
    currentTheme === "neo-brutalism-dark";

  const showAnimated = animatedBackground ?? false;
  const isVanillaLightDark = !isRetroArcade && !isNeoBrutalism;
  const showStaticGrid = !showAnimated;
  const showAnimatedGrid = mounted && showAnimated && isVanillaLightDark;

  return (
    <div className="fixed inset-0 z-0">
      {/* Static GridPattern when animated is disabled (all themes) */}
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
            "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-foreground/30",
            "[mask-image:radial-gradient(1200px_circle_at_top_left,white,transparent)]",
            "inset-x-0 inset-y-[-30%] h-[200%] -skew-y-12"
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
            flickerChance={currentTheme === "neo-brutalism" ? 0.06 : 0.12}
            maxOpacity={currentTheme === "neo-brutalism" ? 0.16 : 0.2}
            color={
              currentTheme === "neo-brutalism"
                ? "hsl(0 100% 60%)" // primary red on light
                : "hsl(0 100% 70%)" // primary red on dark
            }
          />
          {/* Secondary yellow layer */}
          <FlickeringGrid
            className="pointer-events-none absolute inset-0 h-full w-full"
            squareSize={12}
            gridGap={32}
            flickerChance={currentTheme === "neo-brutalism" ? 0.05 : 0.1}
            maxOpacity={currentTheme === "neo-brutalism" ? 0.13 : 0.17}
            color={
              currentTheme === "neo-brutalism"
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
            currentTheme === "retro-arcade"
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

