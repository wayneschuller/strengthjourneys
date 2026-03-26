// Workbook decoder for spreadsheet-style imports.
//
// This module takes an uploaded Excel file (`.xls` / `.xlsx`) and converts the
// first non-empty worksheet into the same `string[][]` row format used by the
// CSV decoder. Keeping both decoders aligned means the downstream import
// dispatcher can stay format-agnostic: it always receives header-first rows of
// plain strings no matter where the file came from.
//
// We lazy-load `xlsx` inside `decodeWorkbook()` so the heavier workbook parser
// only lands in the client bundle when someone actually chooses an Excel file.

function coerceCell(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

function pickFirstNonEmptySheet(workbook, XLSX) {
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    if (
      rows.some((row) => Array.isArray(row) && row.some((cell) => cell !== ""))
    ) {
      return rows;
    }
  }

  return [];
}

export async function decodeWorkbook(file) {
  const [{ read, utils }, buffer] = await Promise.all([
    import("xlsx"),
    file.arrayBuffer(),
  ]);

  const workbook = read(buffer, {
    type: "array",
    cellDates: false,
    cellText: true,
  });

  const rows = pickFirstNonEmptySheet(workbook, { utils }).map((row) =>
    row.map(coerceCell),
  );

  while (
    rows.length > 0 &&
    rows[rows.length - 1].every((cell) => cell === "")
  ) {
    rows.pop();
  }

  return rows;
}
