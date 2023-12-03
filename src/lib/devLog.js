// Simple wrapper for console.log
export function devLog(message) {
  if (process.env.NODE_ENV === "development") {
    console.log(message);
  }
}
