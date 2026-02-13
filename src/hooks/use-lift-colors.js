import { createContext, useContext, useState, useEffect, useRef } from "react";
import { SliderPicker } from "react-color";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog } from "@/lib/processing-utils";

// Default lift colors
// Color palette inspired from:
// https://coolors.co/palette/001219-005f73-0a9396-94d2bd-e9d8a6-ee9b00-ca6702-bb3e03-ae2012-9b2226
const DEFAULT_COLORS = {
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

// Validate hex color without regex (e.g., #FF6B6B or #F6B)
const isValidHexColor = (color) => {
  if (typeof color !== "string") return false;
  if (color[0] !== "#") return false;
  const hex = color.slice(1).toLowerCase();
  if (hex.length !== 3 && hex.length !== 6) return false;
  const validChars = "0123456789abcdef";
  for (let char of hex) {
    if (!validChars.includes(char)) return false;
  }
  return true;
};

// Generate random hex color
const generateRandomColor = () => {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;
};

// Default context value
const LiftColorsContext = createContext({
  getActiveColor: () => {},
  setLiftColor: () => {},
});

// Context Provider
export const LiftColorsProvider = ({ children }) => {
  // Initialize with empty overrides (safe for server and client)
  const [overrides, setOverrides] = useState({});

  // Load overrides from localStorage after mount (client-only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.LIFT_COLOR_OVERRIDES);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (
            typeof parsed !== "object" ||
            Array.isArray(parsed) ||
            parsed === null
          ) {
            throw new Error("Overrides value isn't an object");
          }
          // Validate each color in overrides
          const validOverrides = {};
          for (const [liftType, color] of Object.entries(parsed)) {
            if (isValidHexColor(color)) {
              validOverrides[liftType] = color;
            } else {
              console.warn(
                `Invalid color for ${liftType}: "${color}". Ignoring.`,
              );
            }
          }
          setOverrides(validOverrides);
        } catch (e) {
          console.warn(
            "Error parsing liftColorOverrides from localStorage:",
            e,
          );
          localStorage.removeItem(LOCAL_STORAGE_KEYS.LIFT_COLOR_OVERRIDES);
        }
      }
    }
  }, []); // Runs once after mount

  // Persist overrides to localStorage when they change (client-only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (Object.keys(overrides).length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.LIFT_COLOR_OVERRIDES, JSON.stringify(overrides));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.LIFT_COLOR_OVERRIDES);
      }
    }
  }, [overrides]);

  // Merge defaults with overrides
  const activeColors = { ...DEFAULT_COLORS, ...overrides };

  // Pending random colors assigned during render — flushed via useEffect
  const pendingRef = useRef({});

  // Flush any colors assigned during render into state
  useEffect(() => {
    const pending = pendingRef.current;
    if (Object.keys(pending).length === 0) return;
    pendingRef.current = {};
    setOverrides((prev) => ({ ...prev, ...pending }));
  });

  // Get color for a lift type — pure read, safe to call during render
  const getActiveColor = (liftType) => {
    if (activeColors[liftType]) return activeColors[liftType];
    // Already queued a random color this render cycle
    if (pendingRef.current[liftType]) return pendingRef.current[liftType];
    // Assign a random color and queue it for persistence
    const randomColor = generateRandomColor();
    pendingRef.current[liftType] = randomColor;
    return randomColor;
  };

  // Set a color override and update localStorage
  const setLiftColor = (liftType, color) => {
    if (!isValidHexColor(color)) {
      console.warn(`Invalid color for ${liftType}: "${color}". Not setting.`);
      return;
    }
    setOverrides((prev) => ({
      ...prev,
      [liftType]: color,
    }));
  };

  // Resets the override for a given liftType, returning it to the default color (or random if not listed)
  const resetColor = (liftType) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[liftType];
      return next;
    });
  };

  return (
    <LiftColorsContext.Provider
      value={{
        getActiveColor,
        setLiftColor,
        resetColor,
      }}
    >
      {children}
    </LiftColorsContext.Provider>
  );
};

// Custom hook for accessing colors (read and write)
export const useLiftColors = () => {
  const context = useContext(LiftColorsContext);
  if (!context) {
    throw new Error("useLiftColors must be used within a LiftColorsProvider");
  }

  return {
    getColor: context.getActiveColor,
    setColor: context.setLiftColor,
    resetColor: context.resetColor,
  };
};

// Color picker component
export function LiftColorPicker({ liftType }) {
  // const { color, setColor, resetColor, isLightColor } = useLiftColors();
  const { getColor, setColor, resetColor } = useLiftColors();
  const color = getColor(liftType);

  const handleColorChange = (newColor) => {
    // Validate the color before setting it
    if (isValidHexColor(newColor.hex)) {
      setColor(liftType, newColor.hex);
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
            color: isLightColor(color) ? "#000" : "#fff",
          }}
        >
          Change {liftType} Color
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px]">
        <div className="flex flex-col gap-4">
          <SliderPicker color={color} onChangeComplete={handleColorChange} />
          <Button
            variant="outline"
            onClick={() => {
              resetColor(liftType);
            }}
          >
            Reset to Default
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Function to check if a color is light or dark
const isLightColor = (color) => {
  const hex = color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Using the luminance formula
  return 0.299 * r + 0.587 * g + 0.114 * b > 128;
};
