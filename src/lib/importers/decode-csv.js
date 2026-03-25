// CSV text → string[][] decoder.
//
// Handles quoted fields, escaped quotes (""), newlines within quotes,
// and both \r\n and \n line endings. No external dependencies.

/**
 * Parse a CSV string into an array of rows, where each row is an array of strings.
 *
 * @param {string} text Raw CSV text
 * @param {string} [delimiter=","] Column delimiter
 * @returns {string[][]} Parsed rows (header row first)
 */
export function decodeCSV(text, delimiter = ",") {
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
  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell === "")) {
    rows.pop();
  }

  return rows;
}
