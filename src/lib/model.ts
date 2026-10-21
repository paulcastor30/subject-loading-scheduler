import { z } from "zod";
const id = z.string().min(1);
const text = z.string().trim().min(1, "Required");
const positive = z.coerce.number().finite().min(0);
const base = { id };
const named = { ...base, name: text };
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const interval = {
  day: z.coerce.number().int().min(0).max(6),
  start: time,
  end: time,
};
export const schemas = {
  academicYears: z.object({ ...named }),
  semesters: z.object({
    ...named,
    academicYearId: id,
    finalized: z.boolean().default(false),
  }),
  programs: z.object({ ...named, code: text }),
  curricula: z.object({ ...named, programId: id }),
  subjects: z.object({
    ...named,
    code: text,
    curriculumId: id,
    courseUnits: positive,
    lectureHours: positive,
    labHours: positive,
    equipment: z.string().default(""),
  }),
  faculty: z.object({
    ...named,
    specialization: z.string().default(""),
    maxLoad: positive,
    active: z.boolean().default(true),
  }),
  sections: z.object({
    ...named,
    programId: id,
    yearLevel: z.coerce.number().int().min(1).max(10),
    size: z.coerce.number().int().positive(),
  }),
  offerings: z.object({
    ...base,
    semesterId: id,
    subjectId: id,
    sectionId: id,
  }),
  assignments: z.object({ ...base, offeringId: id, facultyId: id }),
  meetings: z.object({
    ...base,
    offeringId: id,
    component: z.enum(["lecture", "lab"]),
    roomId: id,
    ...interval,
  }),
  rooms: z.object({
    ...named,
    code: text,
    building: text,
    type: z.enum(["classroom", "laboratory"]),
    capacity: z.coerce.number().int().positive(),
    equipment: z.string().default(""),
    active: z.boolean().default(true),
  }),
  facultyAvailability: z.object({ ...base, facultyId: id, ...interval }),
  roomAvailability: z.object({
    ...base,
    roomId: id,
    kind: z.enum(["available", "blocked"]),
    ...interval,
    reason: z.string().default(""),
  }),
  workloadRules: z.object({
    ...named,
    lectureFactor: positive,
    labFactor: positive,
  }),
  schedulingRules: z.object({
    ...named,
    days: z.array(z.number().int().min(0).max(6)).min(1),
    start: time,
    end: time,
    overload: z.enum(["error", "warning"]),
    specialization: z.enum(["warning", "off"]),
  }),
};
export type Entity = keyof typeof schemas;
export type Rows = { [K in Entity]: z.infer<(typeof schemas)[K]>[] };
export type Row<K extends Entity> = Rows[K][number];
export type History = { id: string; at: string; description: string };
export type Data = Rows & { history: History[] };
const shape = Object.fromEntries(
  Object.entries(schemas).map(([key, schema]) => [key, z.array(schema)]),
) as { [K in Entity]: z.ZodArray<(typeof schemas)[K]> };
export const dataSchema = z.object({
  ...shape,
  history: z.array(z.object({ id, at: z.iso.datetime(), description: text })),
});
export const entities = Object.keys(schemas) as Entity[];
export const uid = () => crypto.randomUUID();
export const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export function emptyData(): Data {
  const rows = Object.fromEntries(
    entities.map((key) => [key, []]),
  ) as unknown as Rows;
  return {
    ...rows,
    workloadRules: [
      {
        id: "default-load",
        name: "Department workload",
        lectureFactor: 1,
        labFactor: 1,
      },
    ],
    schedulingRules: [
      {
        id: "default-schedule",
        name: "Department scheduling",
        days: [0, 1, 2, 3, 4, 5],
        start: "07:00",
        end: "19:00",
        overload: "error",
        specialization: "warning",
      },
    ],
    history: [],
  };
}
export const labels: Record<Entity, string> = {
  academicYears: "Academic years",
  semesters: "Semesters",
  programs: "Academic programs",
  curricula: "Curricula",
  subjects: "Subjects",
  faculty: "Faculty",
  sections: "Student sections",
  offerings: "Subject offerings",
  assignments: "Teaching assignments",
  meetings: "Class meetings",
  rooms: "Rooms",
  facultyAvailability: "Faculty availability",
  roomAvailability: "Room availability",
  workloadRules: "Workload rule",
  schedulingRules: "Scheduling rule",
};
export function offeringName(data: Data, offeringId: string): string {
  const o = data.offerings.find((r) => r.id === offeringId);
  return o
    ? `${data.subjects.find((r) => r.id === o.subjectId)?.code ?? "?"} · ${data.sections.find((r) => r.id === o.sectionId)?.name ?? "?"}`
    : "Unknown offering";
}
export function rowName(data: Data, entity: Entity, recordId: string): string {
  if (entity === "offerings") return offeringName(data, recordId);
  const row = (
    data[entity] as { id: string; name?: string; code?: string }[]
  ).find((r) => r.id === recordId);
  return row ? [row.code, row.name].filter(Boolean).join(" · ") || row.id : "—";
}
export const refs: Partial<Record<Entity, Record<string, Entity>>> = {
  semesters: { academicYearId: "academicYears" },
  curricula: { programId: "programs" },
  subjects: { curriculumId: "curricula" },
  sections: { programId: "programs" },
  offerings: {
    semesterId: "semesters",
    subjectId: "subjects",
    sectionId: "sections",
  },
  assignments: { offeringId: "offerings", facultyId: "faculty" },
  meetings: { offeringId: "offerings", roomId: "rooms" },
  facultyAvailability: { facultyId: "faculty" },
  roomAvailability: { roomId: "rooms" },
};
export function integrity(data: Data): string[] {
  const errors: string[] = [];
  for (const entity of entities) {
    const ids = new Set<string>();
    for (const row of data[entity]) {
      if (ids.has(row.id))
        errors.push(`${labels[entity]}: duplicate ID ${row.id}.`);
      ids.add(row.id);
      for (const [field, target] of Object.entries(refs[entity] ?? {})) {
        const value = (row as unknown as Record<string, unknown>)[field];
        if (!data[target].some((r) => r.id === value))
          errors.push(`${labels[entity]}: missing ${target} reference.`);
      }
      if ("start" in row && "end" in row && row.start >= row.end)
        errors.push(`${labels[entity]}: end must be after start.`);
    }
  }
  for (const entity of ["workloadRules", "schedulingRules"] as const)
    if (data[entity].length !== 1)
      errors.push(`Exactly one ${labels[entity].toLowerCase()} is required.`);
  for (const entity of ["programs", "subjects", "rooms"] as const) {
    const codes = data[entity].map((r) => r.code.toLowerCase());
    if (new Set(codes).size !== codes.length)
      errors.push(`${labels[entity]}: codes must be unique.`);
  }
  const scheduling = data.schedulingRules[0];
  if (scheduling && new Set(scheduling.days).size !== scheduling.days.length)
    errors.push("Scheduling days must be unique.");
  const terms = data.semesters.map(
    (t) => `${t.academicYearId}|${t.name.toLowerCase()}`,
  );
  if (new Set(terms).size !== terms.length)
    errors.push("Semester names must be unique within an academic year.");
  const offerings = data.offerings.map(
    (o) => `${o.semesterId}|${o.subjectId}|${o.sectionId}`,
  );
  if (new Set(offerings).size !== offerings.length)
    errors.push("A subject can only be offered once per section and semester.");
  for (const o of data.offerings) {
    const subject = data.subjects.find((r) => r.id === o.subjectId),
      section = data.sections.find((r) => r.id === o.sectionId);
    const curriculum = data.curricula.find(
      (r) => r.id === subject?.curriculumId,
    );
    if (curriculum && section && curriculum.programId !== section.programId)
      errors.push(
        "Offering subject curriculum and section must belong to the same program.",
      );
  }
  const assigned = data.assignments.map((a) => a.offeringId);
  if (new Set(assigned).size !== assigned.length)
    errors.push("An offering can have only one teaching assignment.");
  return [...new Set(errors)];
}
