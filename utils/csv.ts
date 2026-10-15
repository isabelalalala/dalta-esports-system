// CSV without a library. Used by the report CSV (utils/reports.ts) and the exports (utils/exports.ts).

export type CsvValue = string | number | boolean | null | undefined;

// One CSV value. Quotes values with commas, quotes or line breaks.
// Text starting with = + - @ is prefixed with ' so Excel doesn't run it as a formula
// (names, comments and team names are typed by users).
export function csvCell(value: CsvValue) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(values: CsvValue[]) {
  return values.map(csvCell).join(',');
}

// A whole file: header + rows. The BOM makes Excel read it as UTF-8 (ñ, é, ★, ...).
export function csvFile(header: string[], rows: CsvValue[][]) {
  return '﻿' + [csvLine(header), ...rows.map(csvLine)].join('\r\n');
}
