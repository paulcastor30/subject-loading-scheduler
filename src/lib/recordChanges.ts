import {
  days,
  emptyData,
  entities,
  offeringName,
  refs,
  rowName,
  type Data,
  type Entity,
} from "./model";
import { groupCredits } from "./loading";
import { checkData } from "./storage";

export type RecordAction = "delete" | "reset" | "deactivate" | "activate";
export type ChangeRequest = {
  action: RecordAction;
  entity: Entity;
  ids: string[];
};
export type RecordChange = { entity: Entity; id: string; name: string };
export type ChangePlan = {
  request: ChangeRequest;
  source: Data;
  next: Data;
  removed: RecordChange[];
  changed: RecordChange[];
  errors: string[];
  finalizedDeleted: string[];
};
const rules: Entity[] = ["workloadRules", "schedulingRules"];
export function recordDescription(
  data: Data,
  entity: Entity,
  id: string,
): string {
  const row = data[entity].find((r) => r.id === id);
  if (!row) return "Record no longer available";
  const termName = (term: string) => {
    const t = data.semesters.find((s) => s.id === term);
    return `${data.academicYears.find((y) => y.id === t?.academicYearId)?.name ?? ""} · ${t?.name ?? ""}`;
  };
  const className = (offeringId: string) =>
    `${offeringName(data, offeringId)} · ${termName(data.offerings.find((o) => o.id === offeringId)?.semesterId ?? "")}`;
  if (entity === "semesters") return termName(id);
  if (entity === "offerings") return className(id);
  if (entity === "teachingGroups" && "offeringId" in row && "name" in row)
    return `${className(row.offeringId)} · ${row.name}`;
  if (entity === "assignments" && "facultyId" in row && "offeringId" in row)
    return `${rowName(data, "faculty", row.facultyId)} → ${className(row.offeringId)}${row.groupId ? ` · ${data.teachingGroups.find((g) => g.id === row.groupId)?.name ?? "Group"}` : ""}`;
  if (entity === "meetings" && "offeringId" in row && "day" in row)
    return `${className(row.offeringId)} · ${days[row.day]} ${row.start}–${row.end} · ${rowName(data, "rooms", row.roomId)}`;
  if (entity === "loadActivities" && "facultyId" in row && "name" in row)
    return `${row.name} · ${rowName(data, "faculty", row.facultyId)} · ${termName(row.semesterId)}`;
  if (entity === "facultyAvailability" && "facultyId" in row && "day" in row)
    return `${rowName(data, "faculty", row.facultyId)} · ${days[row.day]} ${row.start}–${row.end}`;
  if (
    entity === "roomAvailability" &&
    "roomId" in row &&
    "kind" in row &&
    "day" in row
  )
    return `${rowName(data, "rooms", row.roomId)} · ${row.kind} · ${days[row.day]} ${row.start}–${row.end}`;
  return rowName(data, entity, id);
}
export function planRecordChange(
  data: Data,
  request: ChangeRequest,
): ChangePlan {
  const next = structuredClone(data),
    removed: RecordChange[] = [],
    changed: RecordChange[] = [],
    errors: string[] = [];
  const ids = new Set(request.ids);
  const targets = data[request.entity].filter((r) => ids.has(r.id));
  if (!targets.length || targets.length !== ids.size)
    errors.push(
      "Some selected records no longer exist. Select the records again.",
    );
  const describe = (entity: Entity, id: string): RecordChange => ({
    entity,
    id,
    name: recordDescription(data, entity, id),
  });
  if (request.action === "delete") {
    if (rules.includes(request.entity))
      errors.push("Rules are required. Use Reset to defaults instead.");
    else {
      const deleted = Object.fromEntries(
        entities.map((e) => [e, new Set<string>()]),
      ) as Record<Entity, Set<string>>;
      targets.forEach((r) => deleted[request.entity].add(r.id));
      let added = true;
      while (added) {
        added = false;
        for (const entity of entities)
          for (const row of data[entity]) {
            if (deleted[entity].has(row.id)) continue;
            const dependent = Object.entries(refs[entity] ?? {}).some(
              ([field, parent]) => {
                // A credit category is optional. Preserve groups and their current credit below.
                if (field === "loadCategoryId") return false;
                const value = (row as unknown as Record<string, unknown>)[
                  field
                ];
                return typeof value === "string" && deleted[parent].has(value);
              },
            );
            if (dependent) {
              deleted[entity].add(row.id);
              added = true;
            }
          }
      }
      for (const entity of entities) {
        for (const row of data[entity])
          if (deleted[entity].has(row.id))
            removed.push(describe(entity, row.id));
        (next[entity] as unknown[]) = next[entity].filter(
          (r) => !deleted[entity].has(r.id),
        );
      }
      next.teachingGroups = next.teachingGroups.map((g) => {
        if (!g.loadCategoryId || !deleted.loadCategories.has(g.loadCategoryId))
          return g;
        const original = data.teachingGroups.find((v) => v.id === g.id)!;
        const category = data.loadCategories.find(
          (c) => c.id === g.loadCategoryId,
        )!;
        changed.push(describe("teachingGroups", g.id));
        const rest = { ...g };
        delete rest.loadCategoryId;
        return {
          ...rest,
          creditedLoad: groupCredits(data, original),
          creditReason:
            g.creditedLoad !== undefined
              ? g.creditReason
              : `Preserved credit after removing category ${category.name} (factor ${category.factor}).`,
        };
      });
    }
  } else if (request.action === "reset") {
    if (!rules.includes(request.entity))
      errors.push("Only workload and scheduling rules can be reset.");
    else {
      const defaults = emptyData();
      (next[request.entity] as unknown[]) = targets.map((row) => ({
        ...defaults[request.entity][0],
        id: row.id,
      }));
      targets.forEach((r) => changed.push(describe(request.entity, r.id)));
    }
  } else if (request.entity === "faculty" || request.entity === "rooms") {
    const active = request.action === "activate";
    const update = <T extends { id: string; active: boolean }>(r: T): T => {
      if (!ids.has(r.id) || r.active === active) return r;
      changed.push(describe(request.entity, r.id));
      return { ...r, active };
    };
    if (request.entity === "faculty") next.faculty = next.faculty.map(update);
    else next.rooms = next.rooms.map(update);
    if (!changed.length)
      errors.push(
        `The selected records are already ${active ? "active" : "inactive"}.`,
      );
  } else errors.push("Only faculty and rooms can be activated or deactivated.");

  const removedIds = (entity: Entity) =>
    new Set(removed.filter((r) => r.entity === entity).map((r) => r.id));
  const removedOfferings = removedIds("offerings"),
    removedTerms = removedIds("semesters");
  for (const t of data.semesters.filter(
    (s) => s.finalized && !removedTerms.has(s.id),
  )) {
    const offerings = new Set(
      data.offerings.filter((o) => o.semesterId === t.id).map((o) => o.id),
    );
    const touches =
      removed.some((r) => {
        const row = data[r.entity].find((v) => v.id === r.id);
        return (
          (r.entity === "offerings" &&
            removedOfferings.has(r.id) &&
            offerings.has(r.id)) ||
          (row && "offeringId" in row && offerings.has(row.offeringId)) ||
          (row && "semesterId" in row && row.semesterId === t.id)
        );
      }) ||
      changed.some(
        (r) =>
          r.entity === "teachingGroups" &&
          offerings.has(
            data.teachingGroups.find((g) => g.id === r.id)!.offeringId,
          ),
      );
    if (touches)
      errors.push(
        `Reopen ${recordDescription(data, "semesters", t.id)} before removing its connected records. You can delete the whole semester from Semesters instead.`,
      );
  }
  if (!errors.length)
    try {
      checkData(next);
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "The proposed changes are invalid.",
      );
    }
  return {
    request,
    source: data,
    next,
    removed,
    changed,
    errors,
    finalizedDeleted: data.semesters
      .filter((t) => t.finalized && removedTerms.has(t.id))
      .map((t) => recordDescription(data, "semesters", t.id)),
  };
}

export function applyRecordChange(data: Data, plan: ChangePlan): Data {
  if (plan.source !== data)
    throw new Error(
      "Records changed after this preview. Review the changes again.",
    );
  if (plan.errors.length) throw new Error(plan.errors.join("\n"));
  return checkData(plan.next);
}
