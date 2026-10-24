import { schemas, uid, type Data, type Row } from "./model";
export type QuickEntity = "subjects" | "faculty" | "rooms";
export type QuickRow = { id: string; values: Record<string, string> };
export type QuickRecord = Row<"subjects"> | Row<"faculty"> | Row<"rooms">;
export type QuickInspection = {
  records: QuickRecord[];
  errors: Record<string, Record<string, string>>;
  count: number;
  valid: boolean;
  error: string;
};
export type QuickColumn = {
  key: string;
  label: string;
  numeric?: boolean;
  optional?: boolean;
  aliases?: string[];
};
export const MAX_QUICK_ROWS = 500;
export const quickColumns: Record<QuickEntity, QuickColumn[]> = {
  subjects: [
    { key: "code", label: "Code" },
    { key: "name", label: "Title", aliases: ["name", "subject title"] },
    {
      key: "courseUnits",
      label: "Course units",
      numeric: true,
      aliases: ["units"],
    },
    { key: "lectureHours", label: "Lecture hours", numeric: true },
    { key: "labHours", label: "Lab hours", numeric: true },
    { key: "equipment", label: "Equipment", optional: true },
  ],
  faculty: [
    { key: "name", label: "Name", aliases: ["faculty name"] },
    {
      key: "maxLoad",
      label: "Load limit",
      numeric: true,
      aliases: ["max load", "teaching load limit"],
    },
    { key: "specialization", label: "Specialization", optional: true },
    { key: "rank", label: "Rank", optional: true },
  ],
  rooms: [
    { key: "code", label: "Code", aliases: ["room code"] },
    { key: "name", label: "Name", aliases: ["room name"] },
    { key: "building", label: "Building" },
    { key: "type", label: "Type" },
    { key: "capacity", label: "Capacity", numeric: true },
    { key: "equipment", label: "Equipment", optional: true },
  ],
};
export const blankQuickRow = (): QuickRow => ({ id: uid(), values: {} });
export const quickRowEmpty = (row: QuickRow) =>
  Object.values(row.values).every((v) => !v.trim());
export function quickDefaults(
  data: Data,
  entity: QuickEntity,
): Record<string, string> {
  if (entity === "subjects")
    return {
      curriculumId: data.curricula.length === 1 ? data.curricula[0].id : "",
      courseUnits: "3",
      lectureHours: "3",
      labHours: "0",
    };
  if (entity === "faculty") return { maxLoad: "18" };
  return { building: "", type: "classroom", capacity: "30" };
}

// Excel clipboard data is tab-delimited; commas in people's names are ordinary text.
export function parseQuickPaste(entity: QuickEntity, text: string): QuickRow[] {
  if (text.length > 1_000_000)
    throw new Error("Paste at most 1,000,000 characters at a time.");
  const table: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const pushRow = () => {
    row.push(cell.trim());
    if (row.some(Boolean)) table.push(row);
    row = [];
    cell = "";
    closed = false;
    if (table.length > MAX_QUICK_ROWS + 1)
      throw new Error("Paste at most 500 rows at a time.");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === "\t") {
      row.push(cell.trim());
      cell = "";
      closed = false;
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else if (c === '"') {
      if (cell || closed)
        throw new Error(
          "Invalid quotes in pasted rows. Quote the whole cell and double any quotes inside it.",
        );
      quoted = true;
    } else if (closed && c.trim())
      throw new Error("Unexpected text after a closing quote in pasted rows.");
    else if (!closed) cell += c;
  }
  if (quoted) throw new Error("Unclosed quote in pasted rows.");
  pushRow();
  const columns = quickColumns[entity];
  const normalize = (s: string) =>
    s
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase();
  const header = table[0]?.map((value) =>
    columns.find((c) =>
      [c.key, c.label, ...(c.aliases ?? [])].some(
        (label) => normalize(label) === normalize(value),
      ),
    ),
  );
  const hasHeader = header?.length && header.every(Boolean);
  const keys = hasHeader
    ? header.map((c) => c!.key)
    : columns.map((c) => c.key);
  if (new Set(keys).size !== keys.length)
    throw new Error("Pasted column headers must be unique.");
  if (hasHeader) table.shift();
  if (table.length > MAX_QUICK_ROWS)
    throw new Error("Paste at most 500 rows at a time.");
  return table.map((cells, index) => {
    if (cells.length > keys.length)
      throw new Error(
        `Pasted row ${index + 1} has too many columns. Use the column order shown above the paste box.`,
      );
    return {
      id: uid(),
      values: Object.fromEntries(cells.map((value, i) => [keys[i], value])),
    };
  });
}

export function inspectQuickEntry(
  data: Data,
  entity: QuickEntity,
  rows: QuickRow[],
  defaults: Record<string, string>,
): QuickInspection {
  const filled = rows.filter((r) => !quickRowEmpty(r));
  const result: QuickInspection = {
    records: [],
    errors: {},
    count: filled.length,
    valid: false,
    error: "",
  };
  if (rows.length > MAX_QUICK_ROWS) {
    result.error = "Use at most 500 rows in one batch.";
    return result;
  }
  const add = (id: string, field: string, message: string) => {
    (result.errors[id] ??= {})[field] = message;
  };
  const columns = quickColumns[entity];
  const normalized = (s: unknown) =>
    String(s ?? "")
      .trim()
      .toLowerCase();
  const keyFor = (value: Record<string, unknown>) =>
    entity === "subjects"
      ? `${value.curriculumId}|${normalized(value.code)}`
      : normalized(value[entity === "faculty" ? "name" : "code"]);
  const existing = new Set(data[entity].map((r) => keyFor(r)));
  const existingIds = new Set(data[entity].map((r) => r.id));
  const batch = new Map<string, string[]>();
  const effective = filled.map((r) => {
    const value: Record<string, unknown> = {
      id: r.id,
      ...(entity === "subjects"
        ? { curriculumId: defaults.curriculumId ?? "" }
        : {}),
      ...(entity !== "subjects" ? { active: true } : {}),
    };
    for (const c of columns)
      value[c.key] = r.values[c.key]?.trim() || defaults[c.key]?.trim() || "";
    const key = keyFor(value);
    if (key) batch.set(key, [...(batch.get(key) ?? []), r.id]);
    return { row: r, value, key };
  });
  for (const { row, value, key } of effective) {
    if (entity === "rooms") value.type = String(value.type).toLowerCase();
    if (existingIds.has(row.id))
      add(
        row.id,
        "id",
        "This draft row was already saved. Remove it before saving another batch.",
      );
    for (const c of columns) {
      if (!c.optional && !String(value[c.key] ?? "").trim())
        add(
          row.id,
          c.key,
          `Enter ${c.label.toLowerCase()}, or set a shared default.`,
        );
    }
    if (
      entity === "subjects" &&
      !data.curricula.some((c) => c.id === value.curriculumId)
    )
      add(
        row.id,
        "curriculumId",
        "Choose an existing curriculum in Shared defaults.",
      );
    const duplicateField = entity === "faculty" ? "name" : "code";
    if (key && existing.has(key))
      add(
        row.id,
        duplicateField,
        entity === "faculty"
          ? "This name already exists. Review the roster; use Add record for a different person with the same name."
          : "This code already exists. Existing records will not be replaced.",
      );
    else if (key && (batch.get(key)?.length ?? 0) > 1)
      add(
        row.id,
        duplicateField,
        "Duplicate in this batch. Give each record a different value or remove the extra row.",
      );
    const parsed = schemas[entity].safeParse(value);
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (!result.errors[row.id]?.[field]) add(row.id, field, issue.message);
      }
    else result.records.push(parsed.data);
  }
  result.valid = result.count > 0 && !Object.keys(result.errors).length;
  return result;
}
