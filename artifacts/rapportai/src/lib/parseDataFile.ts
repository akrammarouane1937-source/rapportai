import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedDataFile {
  filename: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  preview: string; // first 5 rows as formatted text for AI
}

export async function parseDataFile(file: File): Promise<ParsedDataFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return parseCsv(file);
  if (ext === "xlsx" || ext === "xls") return parseExcel(file);
  throw new Error("Format non supporté. Utilisez CSV ou Excel (.xlsx / .xls).");
}

function buildPreview(columns: string[], rows: Record<string, unknown>[]): string {
  const head = rows.slice(0, 5);
  const lines = [columns.join(" | ")];
  for (const row of head) {
    lines.push(columns.map((c) => String(row[c] ?? "")).join(" | "));
  }
  return lines.join("\n");
}

function parseCsv(file: File): Promise<ParsedDataFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        const rows = result.data;
        const columns: string[] = result.meta.fields ?? [];
        resolve({
          filename: file.name,
          columns,
          rows,
          rowCount: rows.length,
          preview: buildPreview(columns, rows),
        });
      },
      error: (err) => reject(err),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedDataFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return {
    filename: file.name,
    columns,
    rows,
    rowCount: rows.length,
    preview: buildPreview(columns, rows),
  };
}

/** Extract numeric series for a given column from parsed rows */
export function extractSeries(rows: Record<string, unknown>[], column: string): number[] {
  return rows
    .map((r) => parseFloat(String(r[column] ?? "")))
    .filter((n) => !isNaN(n));
}

/** Extract string labels for a given column */
export function extractLabels(rows: Record<string, unknown>[], column: string): string[] {
  return rows.map((r) => String(r[column] ?? ""));
}
