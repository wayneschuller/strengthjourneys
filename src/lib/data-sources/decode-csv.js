// CSV text → string[][] decoder.
//
// This is the lightweight text-path companion to `decode-workbook.js`.
// Its job is deliberately narrow: take raw CSV-like text and normalize it into
// a header-first `string[][]` shape that every downstream importer can consume.
//
// A few real-world export quirks matter here:
// - different apps use different delimiters (comma, semicolon, tab)
// - quoted fields may contain commas, line breaks, or escaped quotes
// - files may end with `\n`, `\r\n`, bare `\r`, or no trailing newline at all
//
// We keep this dependency-free because it runs on the client during import and
// only needs a predictable, conservative parser rather than a full CSV library.

/**
 * Guess the most likely delimiter from the first line.
 *
 * Supports the common export variants we've seen in the wild:
 * comma, semicolon, and tab-delimited files.
 *
 * @param {string} text Raw CSV text
 * @returns {string} Detected delimiter
 */
export function guessCSVDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/, 1)[0] || "";
  const candidates = [",", ";", "\t"];

  let bestDelimiter = ",";
  let bestScore = -1;

  candidates.forEach((delimiter) => {
    const score = firstLine.split(delimiter).length - 1;
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  });

  return bestDelimiter;
}

/**
 * Parse a CSV string into an array of rows, where each row is an array of strings.
 *
 * @param {string} text Raw CSV text
 * @param {string} [delimiter] Column delimiter
 * @returns {string[][]} Parsed rows (header row first)
 */
export function decodeCSV(text, delimiter = guessCSVDelimiter(text)) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // Peek ahead: escaped quote ("") or end of quoted field
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === delimiter) {
        row.push(field);
        field = "";
        i++;
      } else if (char === "\r") {
        // \r\n or bare \r — treat as row end
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        i++;
        if (i < text.length && text[i] === "\n") i++;
      } else if (char === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        i++;
      } else {
        field += char;
        i++;
      }
    }
  }

  // Push last field/row if file doesn't end with newline
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Filter out completely empty trailing rows
  while (
    rows.length > 0 &&
    rows[rows.length - 1].every((cell) => cell === "")
  ) {
    rows.pop();
  }

  return rows;
}
