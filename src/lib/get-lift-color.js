/** @format */
// getLiftColor.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html

import { useState, useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";
import { devLog } from "./processing-utils";
import { SliderPicker } from "react-color";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Color palette inspired from:
// https://coolors.co/palette/001219-005f73-0a9396-94d2bd-e9d8a6-ee9b00-ca6702-bb3e03-ae2012-9b2226
const LIFT_COLORS = {
  // Core lifts
  "Back Squat": "#9B2226", // Ruby Red
  Squat: "#9B2226", // Ruby Red
  Deadlift: "#005F73", // Blue Sapphire
  "Bench Press": "#94D2BD", // Middle Blue Green
  Press: "#544B3D", // Dark Brown
  "Strict Press": "#544B3D", // Dark Brown
  "Overhead Press": "#544B3D", // Dark Brown
  "Front Squat": "#0A9396", // Viridian Green
  "Romanian Deadlift": "#EE9B00", // Gamboge
  // Accessory lifts
  "Pull-up": "#CA6702", // Alloy Orange
  "Chin-up": "#BB3E03", // Rust
  "Dumbbell Press": "#AE2012", // Rufous
  "Incline Press": "#E9D8A6", // Medium Champagne
  // Default fallback
  default: "#001219", // Rich Black FOGRA 29
};

// Helper function to validate hex color
function isValidHexColor(hex) {
  if (!hex || typeof hex !== "string") return false;
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

// Provide good defaults for popular barbell lifts
export function getLiftColor(liftType) {
  const storageKey = `SJ_${liftType}_color`;
  let color;

  // Only try to access localStorage in the browser
  if (typeof window !== "undefined") {
    const storedColor = localStorage.getItem(storageKey);
    // Validate the stored color is a valid hex color
    if (storedColor && isValidHexColor(storedColor)) {
      color = storedColor;
    } else if (storedColor) {
      // Log invalid color for debugging
      devLog(
        `Invalid color stored for ${liftType}: "${storedColor}". Falling back to default.`,
      );
    }
  }

  if (!color) {
    // Try to find an exact match first
    color = LIFT_COLORS[liftType];

    // If no exact match, try to find a partial match (e.g., "Squat" matches "Back Squat")
    if (!color) {
      const matchingKey = Object.keys(LIFT_COLORS).find(
        (key) =>
          liftType.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(liftType.toLowerCase()),
      );
      color = matchingKey ? LIFT_COLORS[matchingKey] : LIFT_COLORS.default;
    }

    // If still no color, generate a random one
    if (!color) {
      color = `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`;
    }

    // Only set localStorage in the browser
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, color);
    }
  }

  return color;
}

export function brightenHexColor(hex, factor) {
  // Remove # if present
  hex = hex.replace("#", "");

  // Convert hex to RGB
  let r = parseInt(hex.slice(0, 2), 16);
  let g = parseInt(hex.slice(2, 4), 16);
  let b = parseInt(hex.slice(4, 6), 16);

  // Brighten the color
  r = Math.min(255, Math.floor(r * factor));
  g = Math.min(255, Math.floor(g * factor));
  b = Math.min(255, Math.floor(b * factor));

  // Convert back to hex
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Simple function to increase saturation of a hex color
export function saturateHexColor(hex, factor = 1.2) {
  // Remove # if present
  hex = hex.replace("#", "");
  // Convert hex to RGB
  let r = parseInt(hex.slice(0, 2), 16) / 255;
  let g = parseInt(hex.slice(2, 4), 16) / 255;
  let b = parseInt(hex.slice(4, 6), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Increase saturation
  s = Math.min(1, s * factor);

  // Convert HSL back to RGB
  let r1, g1, b1;
  if (s === 0) {
    r1 = g1 = b1 = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r1 = hue2rgb(p, q, h + 1 / 3);
    g1 = hue2rgb(p, q, h);
    b1 = hue2rgb(p, q, h - 1 / 3);
  }

  // Convert back to hex
  return `#${Math.round(r1 * 255)
    .toString(16)
    .padStart(2, "0")}${Math.round(g1 * 255)
    .toString(16)
    .padStart(2, "0")}${Math.round(b1 * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

// Custom hook for managing lift colors
export function useLiftColors(liftType) {
  const storageKey = `SJ_${liftType}_color`;

  const [color, setColor] = useLocalStorage(
    storageKey,
    getLiftColor(liftType),
    {
      initializeWithValue: false,
    },
  );

  // Function to reset to default color
  const resetColor = () => {
    setColor(getLiftColor(liftType));
  };

  // Function to get a brighter version of the current color
  const getBrightenedColor = (factor = 1.2) => {
    return brightenHexColor(color, factor);
  };

  // Function to get a darker version of the current color
  const getDarkenedColor = (factor = 0.8) => {
    return brightenHexColor(color, factor);
  };

  // Function to check if a color is light or dark
  const isLightColor = () => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    // Using the luminance formula
    return 0.299 * r + 0.587 * g + 0.114 * b > 128;
  };

  return {
    color,
    setColor,
    resetColor,
    getBrightenedColor,
    getDarkenedColor,
    isLightColor,
  };
}

// Color picker component
export function LiftColorPicker({ liftType, onColorChange }) {
  const { color, setColor, resetColor, isLightColor } = useLiftColors(liftType);

  const handleColorChange = (newColor) => {
    // Validate the color before setting it
    if (isValidHexColor(newColor.hex)) {
      setColor(newColor.hex);
      onColorChange?.(newColor.hex);
    } else {
      devLog(
        `Invalid color selected for ${liftType}: "${newColor.hex}". Not updating color.`,
      );
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[200px]"
          style={{
            backgroundColor: color,
            color: isLightColor() ? "#000" : "#fff",
          }}
        >
          {liftType} Color
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px]">
        <div className="flex flex-col gap-4">
          <SliderPicker color={color} onChangeComplete={handleColorChange} />
          <Button
            variant="outline"
            onClick={() => {
              resetColor();
              onColorChange?.(getLiftColor(liftType));
            }}
          >
            Reset to Default
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Function to get all lift colors
export function getAllLiftColors() {
  return Object.entries(LIFT_COLORS).reduce((acc, [liftType, color]) => {
    acc[liftType] = getLiftColor(liftType);
    return acc;
  }, {});
}

// Function to reset all lift colors to defaults
export function resetAllLiftColors() {
  Object.keys(LIFT_COLORS).forEach((liftType) => {
    localStorage.removeItem(`SJ_${liftType}_color`);
  });
}

// Function to clean up invalid colors from localStorage
export function cleanupInvalidColors() {
  if (typeof window === "undefined") return;

  Object.keys(LIFT_COLORS).forEach((liftType) => {
    const storageKey = `SJ_${liftType}_color`;
    const storedColor = localStorage.getItem(storageKey);
    if (storedColor && !isValidHexColor(storedColor)) {
      devLog(`Cleaning up invalid color for ${liftType}: "${storedColor}"`);
      localStorage.removeItem(storageKey);
    }
  });
}
