import readXlsxFile from "read-excel-file";
import writeXlsxFile from "write-excel-file";
import { entities, schemas, uid, type Data, type Entity } from "./model";
import { checkData } from "./storage";
export type RawRow = Record<string, string>;
export type ImportPreview = {
  source: Data;
  data: Data;
  errors: { row: number; message: string }[];
  added: number;
};
export function previewImport(
  data: Data,
  entity: Entity,
  rows: RawRow[],
  mapping: Record<string, string>,
): ImportPreview {
  const next = structuredClone(data);
  const errors: ImportPreview["errors"] = [];
  let added = 0;
  rows.forEach((row, i) => {
    const value: Record<string, unknown> = { id: uid() };
    let invalidBoolean = false;
    for (const [field, column] of Object.entries(mapping)) {
      const raw = row[column];
      if (raw === undefined || raw === "") continue;
      if (
        ["active", "finalized"].includes(field) &&
        !["true", "false"].includes(raw.toLowerCase())
      ) {
        errors.push({ row: i + 2, message: `${field}: use true or false.` });
        invalidBoolean = true;
      }
      value[field] = ["active", "finalized"].includes(field)
        ? raw.toLowerCase() === "true"
        : field === "days"
          ? raw.split(",").map(Number)
          : raw;
    }
    if (invalidBoolean) return;
    const parsed = schemas[entity].safeParse(value);
    if (!parsed.success) {
      errors.push({
        row: i + 2,
        message: parsed.error.issues
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; "),
      });
      return;
    }
    const duplicate = (
      next[entity] as unknown as Record<string, unknown>[]
    ).some(
      (existing) =>
        existing.id === parsed.data.id ||
        ("code" in parsed.data &&
          String(existing.code).toLowerCase() ===
            String(parsed.data.code).toLowerCase()) ||
        JSON.stringify({ ...existing, id: "" }) ===
          JSON.stringify({ ...parsed.data, id: "" }),
    );
    if (duplicate) {
      errors.push({
        row: i + 2,
        message:
          "Duplicate record or code. Existing records are never overwritten.",
      });
      return;
    }
    const candidate = structuredClone(next);
    (candidate[entity] as unknown[]).push(parsed.data);
    try {
      checkData(candidate);
      (next[entity] as unknown[]).push(parsed.data);
      added++;
    } catch (error) {
      errors.push({
        row: i + 2,
        message: error instanceof Error ? error.message : "Invalid record",
      });
    }
  });
  return { source: data, data: next, errors, added };
}
export async function readSpreadsheet(file: File): Promise<RawRow[]> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose a file smaller than 10 MB.");
  if (file.name.toLowerCase().endsWith(".csv"))
    return parseCSV(await file.text());
  const sheet = await readXlsxFile(file);
  const headers = (sheet.shift() ?? []).map((v) => String(v ?? "").trim());
  if (
    !headers.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw new Error(
      "The first row must contain nonempty, unique column headers.",
    );
  const rows = sheet
    .filter((r) => r.some((v) => v !== null))
    .map((r) =>
      Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? "").trim()])),
    );
  if (rows.length > 5000)
    throw new Error("Import at most 5,000 rows per file.");
  return rows;
}
export function parseCSV(source: string): RawRow[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell !== "")
        throw new Error("Invalid CSV quoting.");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  const headers =
    rows.shift()?.map((h) => h.replace(/^\uFEFF/, "").trim()) ?? [];
  if (
    !headers.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("Use nonempty, unique column headers.");
  if (rows.length > 5000)
    throw new Error("Import at most 5,000 rows per file.");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(
        `CSV row ${i + 2} has ${r.length} cells; expected ${headers.length}.`,
      );
    return Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
  });
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportExcel(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  subtitle = "",
) {
  const cells = [
    [{ value: title, fontWeight: "bold" as const, fontSize: 16 }],
    [{ value: subtitle }],
    [{ value: `Generated ${new Date().toLocaleString()}` }],
    [],
    headers.map((value) => ({
      value,
      fontWeight: "bold" as const,
      color: "#ffffff",
      backgroundColor: "#153e36",
    })),
    ...rows.map((row) => row.map((value) => ({ value, wrap: true }))),
  ];
  const blob = await writeXlsxFile(cells, {
    columns: headers.map((h) => ({
      width: Math.min(55, Math.max(18, h.length)),
    })),
    stickyRowsCount: 5,
  });
  download(blob, `${title.replace(/[^a-z0-9]/gi, "-")}.xlsx`);
}
export function templateFields(entity: Entity): string[] {
  return Object.keys(schemas[entity].shape);
}
export function templateCSV(entity: Entity) {
  return `${templateFields(entity).join(",")}\r\n`;
}
export function referenceExport(data: Data, entity: Entity) {
  const fields = templateFields(entity);
  return {
    fields,
    rows: (data[entity] as unknown as Record<string, unknown>[]).map((r) =>
      fields.map((f) =>
        Array.isArray(r[f]) ? (r[f] as number[]).join(",") : String(r[f] ?? ""),
      ),
    ),
  };
}
export const importEntities = entities.filter(
  (e) => !["workloadRules", "schedulingRules"].includes(e),
);
