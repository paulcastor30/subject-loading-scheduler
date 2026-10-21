import { days, offeringName, rowName, type Data } from "./model";
import { utilization, validate, workload } from "./engine";
export const reportTypes = [
  "Individual Faculty Teaching Load",
  "Departmental Faculty Loading Summary",
  "Subject Offerings and Assignments",
  "Faculty Weekly Schedule",
  "Student Section Weekly Schedule",
  "Classroom and Laboratory Timetable",
  "Room Utilization Summary",
  "Unassigned Subject Report",
  "Scheduling Conflict Report",
] as const;
export type ReportType = (typeof reportTypes)[number];
export function buildReport(
  data: Data,
  term: string,
  type: ReportType,
  resource = "",
  program = "",
): { headers: string[]; rows: (string | number)[][] } {
  const offerings = data.offerings.filter(
    (o) =>
      o.semesterId === term &&
      (!program ||
        data.sections.find((s) => s.id === o.sectionId)?.programId === program),
  );
  const ids = new Set(offerings.map((o) => o.id));
  const assignments = data.assignments.filter((a) => ids.has(a.offeringId));
  const facultyName = (offeringId: string) =>
    rowName(
      data,
      "faculty",
      data.assignments.find((a) => a.offeringId === offeringId)?.facultyId ??
        "",
    );
  if (type === "Departmental Faculty Loading Summary")
    return {
      headers: [
        "Faculty",
        "Assigned offerings",
        "Course units",
        "Planned contact hours",
        "Scheduled hours",
        "Credited load",
        "Load limit",
      ],
      rows: data.faculty
        .filter(
          (f) => f.active || assignments.some((a) => a.facultyId === f.id),
        )
        .map((f) => {
          const own = assignments.filter((a) => a.facultyId === f.id),
            subjects = own.map((a) =>
              data.subjects.find(
                (s) =>
                  s.id ===
                  data.offerings.find((o) => o.id === a.offeringId)?.subjectId,
              )!,
            );
          const scheduled = data.meetings
            .filter((m) => own.some((a) => a.offeringId === m.offeringId))
            .reduce(
              (sum, m) =>
                sum +
                (Number(m.end.slice(0, 2)) * 60 +
                  Number(m.end.slice(3)) -
                  Number(m.start.slice(0, 2)) * 60 -
                  Number(m.start.slice(3))) /
                  60,
              0,
            );
          const rule = data.workloadRules[0];
          return [
            f.name,
            own.length,
            subjects.reduce((s, v) => s + v.courseUnits, 0),
            subjects.reduce((s, v) => s + v.lectureHours + v.labHours, 0),
            Number(scheduled.toFixed(2)),
            subjects.reduce(
              (s, v) =>
                s +
                v.lectureHours * rule.lectureFactor +
                v.labHours * rule.labFactor,
              0,
            ),
            f.maxLoad,
          ];
        }),
    };
  if (type === "Room Utilization Summary")
    return {
      headers: [
        "Room",
        "Type",
        "Capacity",
        "Occupied minutes / week",
        "Available minutes / week",
        "Utilization %",
      ],
      rows: data.rooms
        .filter((r) => r.active && (!resource || r.id === resource))
        .map((r) => {
          const s = utilization(data, r.id, term);
          return [
            r.code,
            r.type,
            r.capacity,
            s.occupied,
            s.available,
            Number(s.percent.toFixed(2)),
          ];
        }),
    };
  if (type === "Scheduling Conflict Report")
    return {
      headers: ["Severity", "Check", "Offering", "Action needed"],
      rows: validate(data, term)
        .filter((i) => !program || !i.offeringId || ids.has(i.offeringId))
        .map((i) => [
          i.severity,
          i.code,
          i.offeringId ? offeringName(data, i.offeringId) : "Semester",
          i.message,
        ]),
    };
  if (
    type.endsWith("Schedule") ||
    type === "Classroom and Laboratory Timetable"
  )
    return {
      headers: [
        "Day",
        "Start",
        "End",
        "Subject / section",
        "Component",
        "Faculty",
        "Room",
      ],
      rows: data.meetings
        .filter(
          (m) =>
            ids.has(m.offeringId) &&
            (!resource ||
              (type === "Faculty Weekly Schedule"
                ? assignments.some(
                    (a) =>
                      a.offeringId === m.offeringId && a.facultyId === resource,
                  )
                : type === "Student Section Weekly Schedule"
                  ? offerings.some(
                      (o) => o.id === m.offeringId && o.sectionId === resource,
                    )
                  : m.roomId === resource)),
        )
        .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
        .map((m) => [
          days[m.day],
          m.start,
          m.end,
          offeringName(data, m.offeringId),
          m.component,
          facultyName(m.offeringId),
          rowName(data, "rooms", m.roomId),
        ]),
    };
  const filtered = offerings.filter((o) =>
    type === "Unassigned Subject Report"
      ? !assignments.some((a) => a.offeringId === o.id)
      : type === "Individual Faculty Teaching Load" && resource
        ? assignments.some(
            (a) => a.offeringId === o.id && a.facultyId === resource,
          )
        : true,
  );
  const rule = data.workloadRules[0];
  return {
    headers: [
      "Subject",
      "Title",
      "Section",
      "Faculty",
      "Course units",
      "Lecture h / week",
      "Lab h / week",
      "Credited load",
      "Scheduled meetings",
    ],
    rows: filtered.map((o) => {
      const s = data.subjects.find((s) => s.id === o.subjectId)!;
      return [
        s.code,
        s.name,
        rowName(data, "sections", o.sectionId),
        facultyName(o.id),
        s.courseUnits,
        s.lectureHours,
        s.labHours,
        assignments.some((a) => a.offeringId === o.id)
          ? s.lectureHours * rule.lectureFactor + s.labHours * rule.labFactor
          : 0,
        data.meetings
          .filter((m) => m.offeringId === o.id)
          .map(
            (m) =>
              `${days[m.day].slice(0, 3)} ${m.start}–${m.end} ${data.rooms.find((r) => r.id === m.roomId)?.code} (${m.component})`,
          )
          .join("; "),
      ];
    }),
  };
}
export function facultyLoadNote(data: Data, term: string, faculty: string) {
  return faculty
    ? `${rowName(data, "faculty", faculty)} · ${workload(data, faculty, term)} credited load units`
    : "";
}
