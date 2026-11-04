type Cell = string | number | boolean | null | undefined;

function escapeCell(value: Cell) {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]) {
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

/** Download rows as a CSV file. The BOM makes Excel read the file as UTF-8. */
export function downloadCsv(fileName: string, header: string[], rows: Cell[][]) {
  const blob = new Blob(["\uFEFF", toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvDate(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 16).replace("T", " ") : "";
}
