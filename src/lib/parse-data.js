// Re-export from new location for backwards compatibility.
// All parsing logic now lives in src/lib/data-sources/.
export {
  parseData,
  normalizeLiftTypeNames,
} from "@/lib/data-sources/import-dispatcher";
