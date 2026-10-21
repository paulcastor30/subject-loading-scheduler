import Dexie, { type Table } from "dexie";
import {
  labels as integrityLabels,
  dataSchema,
  emptyData,
  entities,
  integrity,
  type Data,
} from "./model";
import { checkActiveResourceChanges, validate } from "./engine";
export const BACKUP_VERSION = 2;
export class SchedulerDB extends Dexie {
  meta!: Table<{ key: string; value: string }, string>;
  constructor(name = "slss-local-v1") {
    super(name);
    // Version 1 is intentionally normalized. Add upgrade callbacks for future schema changes.
    this.version(1).stores({
      ...Object.fromEntries(
        entities
          .filter(
            (key) =>
              !["teachingGroups", "loadCategories", "loadActivities"].includes(
                key,
              ),
          )
          .map((key) => [key, "id"]),
      ),
      history: "id,at",
      meta: "key",
    });
    this.version(2).stores({
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
  const parsed = dataSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      parsed.error.issues
        .slice(0, 12)
        .map((issue) => {
          const [entity, index, field] = issue.path;
          return `${typeof entity === "string" && entity in integrityLabels ? integrityLabels[entity as keyof typeof integrityLabels] : String(entity)}${typeof index === "number" ? ` row ${index + 1}` : ""}${field ? ` · ${String(field)}` : ""}: ${issue.message}`;
        })
        .join("\n"),
    );
  const data = parsed.data;
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
  if (
    parsed.application !== "SLSS" ||
    ![1, BACKUP_VERSION].includes(parsed.schemaVersion)
  )
    throw new Error(
      "Unsupported backup. Use an SLSS schema version 1 or 2 JSON backup.",
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
    const groupMap = new Map<string, string>();
    for (const group of data.teachingGroups.filter(
      (g) => g.offeringId === o.id,
    )) {
      const id = crypto.randomUUID();
      groupMap.set(group.id, id);
      next.teachingGroups.push({ ...group, id, offeringId });
    }
    if (includeAssignments) {
      next.assignments.push(
        ...data.assignments
          .filter((a) => a.offeringId === o.id)
          .map((a) => ({
            ...a,
            id: crypto.randomUUID(),
            offeringId,
            ...(a.groupId ? { groupId: groupMap.get(a.groupId) } : {}),
          })),
      );
      next.meetings.push(
        ...data.meetings
          .filter((m) => m.offeringId === o.id)
          .map((m) => ({
            ...m,
            id: crypto.randomUUID(),
            offeringId,
            ...(m.groupId ? { groupId: groupMap.get(m.groupId) } : {}),
          })),
      );
    }
  }
  checkActiveResourceChanges(data, next);
  return checkData(next);
}
