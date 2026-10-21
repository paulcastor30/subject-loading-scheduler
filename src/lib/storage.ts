import Dexie, { type Table } from "dexie";
import { dataSchema, emptyData, entities, integrity, type Data } from "./model";
import { validate } from "./engine";
export const BACKUP_VERSION = 1;
export class SchedulerDB extends Dexie {
  meta!: Table<{ key: string; value: string }, string>;
  constructor(name = "slss-local-v1") {
    super(name);
    // Version 1 is intentionally normalized. Add upgrade callbacks for future schema changes.
    this.version(1).stores({
      ...Object.fromEntries(entities.map((key) => [key, "id"])),
      history: "id,at",
      meta: "key",
    });
  }
}
export const db = new SchedulerDB();
export async function readData(
  database = db,
): Promise<{ data: Data; revision: string }> {
  return database.transaction("r", database.tables, async () => {
    const revision = (await database.meta.get("revision"))?.value ?? "";
    if (!revision) return { data: emptyData(), revision };
    const values = await Promise.all(
      [...entities, "history"].map((key) => database.table(key).toArray()),
    );
    const data = dataSchema.parse(
      Object.fromEntries(
        [...entities, "history"].map((key, i) => [key, values[i]]),
      ),
    );
    data.history.sort((a, b) => b.at.localeCompare(a.at));
    return { data, revision };
  });
}
export function checkData(input: unknown): Data {
  const data = dataSchema.parse(input);
  const errors = [
    ...integrity(data),
    ...validate(data)
      .filter((i) => i.severity === "error")
      .map((i) => i.message),
  ];
  if (errors.length) throw new Error(errors.slice(0, 12).join("\n"));
  return data;
}
export async function writeData(
  data: Data,
  expectedRevision: string,
  database = db,
) {
  const checked = checkData(data);
  return database.transaction("rw", database.tables, async () => {
    const actual = (await database.meta.get("revision"))?.value ?? "";
    if (actual !== expectedRevision)
      throw new Error(
        "Data changed in another tab. Reload this page before editing. Your proposed change was not saved.",
      );
    for (const key of [...entities, "history"]) {
      await database.table(key).clear();
      if (checked[key as keyof Data].length)
        await database.table(key).bulkPut(checked[key as keyof Data]);
    }
    const revision = crypto.randomUUID();
    await database.meta.put({ key: "revision", value: revision });
    return revision;
  });
}
export function backup(data: Data) {
  return JSON.stringify(
    {
      application: "SLSS",
      schemaVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2,
  );
}
export function restore(source: string): Data {
  const parsed = JSON.parse(source);
  if (parsed.application !== "SLSS" || parsed.schemaVersion !== BACKUP_VERSION)
    throw new Error(
      "Unsupported backup. Use an SLSS schema version 1 JSON backup.",
    );
  return checkData(parsed.data);
}
export function duplicateSemester(
  data: Data,
  sourceId: string,
  targetId: string,
  includeAssignments: boolean,
): Data {
  if (sourceId === targetId) throw new Error("Choose two different semesters.");
  if (
    !data.semesters.some((t) => t.id === sourceId) ||
    !data.semesters.some((t) => t.id === targetId)
  )
    throw new Error("Choose valid semesters.");
  if (data.semesters.find((t) => t.id === targetId)?.finalized)
    throw new Error("Reopen the destination semester first.");
  const next = structuredClone(data);
  const source = data.offerings.filter((o) => o.semesterId === sourceId);
  if (!source.length) throw new Error("Source semester has no offerings.");
  for (const o of source) {
    if (
      next.offerings.some(
        (n) =>
          n.semesterId === targetId &&
          n.subjectId === o.subjectId &&
          n.sectionId === o.sectionId,
      )
    )
      throw new Error(
        "Destination contains duplicate offerings. No data was copied.",
      );
    const offeringId = crypto.randomUUID();
    next.offerings.push({ ...o, id: offeringId, semesterId: targetId });
    if (includeAssignments) {
      next.assignments.push(
        ...data.assignments
          .filter((a) => a.offeringId === o.id)
          .map((a) => ({ ...a, id: crypto.randomUUID(), offeringId })),
      );
      next.meetings.push(
        ...data.meetings
          .filter((m) => m.offeringId === o.id)
          .map((m) => ({ ...m, id: crypto.randomUUID(), offeringId })),
      );
    }
  }
  return checkData(next);
}
