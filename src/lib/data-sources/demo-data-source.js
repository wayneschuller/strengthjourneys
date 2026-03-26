import { sampleParsedData, transposeDatesToToday } from "./sample-parsed-data";

// Built-in preview dataset used whenever the app intentionally falls back to
// demo mode instead of a user-owned data source.
export function getDemoParsedData() {
  return transposeDatesToToday(sampleParsedData, true);
}
