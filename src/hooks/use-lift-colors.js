import { createContext, useContext, useState, useEffect } from "react";

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
      const saved = localStorage.getItem("liftColorOverrides");
      if (saved) {
        const parsed = JSON.parse(saved);
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
      }
    }
  }, []); // Runs once after mount

  // Persist overrides to localStorage when they change (client-only)
  useEffect(() => {
    if (typeof window !== "undefined" && Object.keys(overrides).length > 0) {
      localStorage.setItem("liftColorOverrides", JSON.stringify(overrides));
    }
  }, [overrides]);

  // Merge defaults with overrides
  const activeColors = { ...DEFAULT_COLORS, ...overrides };

  // Get color for a lift type, using exact match or random
  const getActiveColor = (liftType) => {
    // Exact match in activeColors (includes overrides or defaults)
    if (activeColors[liftType]) {
      return activeColors[liftType];
    }
    // Fallback to random color for unknown lift types
    return generateRandomColor();
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

  return (
    <LiftColorsContext.Provider
      value={{
        getActiveColor,
        setLiftColor,
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
  };
};
