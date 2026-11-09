// Zealosh LMS — Reporting CSV Sanitizer & Formula Injection Protection
// Enforces spreadsheet formula injection mitigation (OWASP CSV Injection Defense)
// Path: src/lib/reporting/csv-sanitizer.ts

export interface CsvColumn<T = any> {
  key: keyof T | string;
  label: string;
  format?: (value: any, row: T) => unknown;
}

const INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitizes a single cell value to prevent formula injection while preserving data formatting.
 * Prepends a single quote (') if the cell begins with dangerous spreadsheet execution triggers.
 * Preserves legitimate negative and positive numeric values without converting them to text.
 */
export function sanitizeCsvCell(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return '""';
  }

  // Pure numbers are safe and preserved as numeric literals in spreadsheets
  if (typeof raw === 'number') {
    return isFinite(raw) ? `"${raw}"` : '""';
  }

  let text: string;
  if (typeof raw === 'object') {
    text = JSON.stringify(raw);
  } else {
    text = String(raw);
  }

  // Check if string represents a pure numeric value (including legitimate negative/positive numbers)
  const isPureNumber = /^[+-]?\d+(\.\d+)?$/.test(text.trim());

  // Formula injection defense: neutralize spreadsheet command triggers unless it's a pure number
  if (text.length > 0 && !isPureNumber && INJECTION_PREFIXES.some((char) => text.startsWith(char))) {
    text = `'${text}`;
  }

  // Escape internal double quotes by doubling them
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Builds a sanitized, RFC 4180-compliant CSV string from column definitions and data rows.
 */
export function generateSanitizedCsv<T extends Record<string, any>>(
  columns: CsvColumn<T>[],
  rows: T[]
): string {
  const headerLine = columns.map((col) => sanitizeCsvCell(col.label)).join(',');

  const dataLines = rows.map((row) =>
    columns
      .map((col) => {
        const val = col.format ? col.format(row[col.key as string], row) : row[col.key as string];
        return sanitizeCsvCell(val);
      })
      .join(',')
  );

  return [headerLine, ...dataLines].join('\r\n');
}

