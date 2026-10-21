import {
  groupCredits,
  groupLabel,
  loadRows,
  meetingAssignment,
  offeringComplete,
  otherLoad,
  preparations,
  teachingLoad,
} from "./loading";
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
  "OVCAA Form 3 Loading Summary",
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
    [
      ...new Set(
        data.assignments
          .filter((a) => a.offeringId === offeringId)
          .map((a) => rowName(data, "faculty", a.facultyId)),
      ),
    ].join("; ") || "Unassigned";
  if (type === "OVCAA Form 3 Loading Summary")
    return {
      headers: [
        "Faculty",
        "Rank",
        "Course / section / duty",
        "Group / category",
        "Schedule",
        "Day",
        "Room",
        "Academic / other credit",
        "Students",
        "Credit source",
      ],
      rows: data.faculty
        .filter((f) => !resource || f.id === resource)
        .flatMap((f) => {
          const details = loadRows(data, term, f.id, program).map((row) => [
            f.name,
            f.rank ?? "",
            ...row,
          ]);
          const teaching =
              details.reduce(
                (sum, row) => sum + (typeof row[7] === "number" ? row[7] : 0),
                0,
              ) - otherLoad(data, f.id, term),
            other = otherLoad(data, f.id, term),
            total = teaching + other;
          return [
            ...details,
            [
              f.name,
              f.rank ?? "",
              "TOTAL FACULTY LOAD",
              "",
              "",
              "",
              "",
              Number(total.toFixed(2)),
              "",
              `Teaching ${teaching.toFixed(2)}; other ${other.toFixed(2)}; preparations ${preparations(data, f.id, term)}; limit ${f.maxLoad}; over ${Math.max(0, total - f.maxLoad).toFixed(2)}; under ${Math.max(0, f.maxLoad - total).toFixed(2)}`,
            ],
          ];
        }),
    };
  if (type === "Departmental Faculty Loading Summary")
    return {
      headers: [
        "Faculty",
        "Assigned offerings",
        "Course units",
        "Planned contact hours",
        "Scheduled hours",
        "Teaching load",
        "Load limit",
        "Other duties",
        "Total load",
        "Preparations",
        "Over limit",
        "Under limit",
      ],
      rows: data.faculty
        .filter(
          (f) => f.active || assignments.some((a) => a.facultyId === f.id),
        )
        .map((f) => {
          const own = assignments.filter((a) => a.facultyId === f.id),
            offers = [...new Set(own.map((a) => a.offeringId))].map((id) =>
              offerings.find((o) => o.id === id)!,
            );
          const hours = own.reduce((sum, a) => {
            const group = data.teachingGroups.find((g) => g.id === a.groupId);
            const subject = data.subjects.find(
              (s) =>
                s.id ===
                offerings.find((o) => o.id === a.offeringId)?.subjectId,
            );
            return (
              sum +
              (group?.contactHours ??
                (subject ? subject.lectureHours + subject.labHours : 0))
            );
          }, 0);
          const scheduled = data.meetings
            .filter(
              (m) =>
                ids.has(m.offeringId) &&
                meetingAssignment(data, m)?.facultyId === f.id,
            )
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
          const teaching = program
            ? own.reduce((sum, a) => {
                const group = data.teachingGroups.find(
                    (g) => g.id === a.groupId,
                  ),
                  s = data.subjects.find(
                    (s) =>
                      s.id ===
                      offerings.find((o) => o.id === a.offeringId)?.subjectId,
                  )!;
                return (
                  sum +
                  (group
                    ? groupCredits(data, group)
                    : s.lectureHours * data.workloadRules[0].lectureFactor +
                      s.labHours * data.workloadRules[0].labFactor)
                );
              }, 0)
            : teachingLoad(data, f.id, term);
          const other = otherLoad(data, f.id, term),
            total = teaching + other;
          return [
            f.name,
            offers.length,
            offers.reduce(
              (sum, o) =>
                sum +
                data.subjects.find((s) => s.id === o.subjectId)!.courseUnits,
              0,
            ),
            hours,
            Number(scheduled.toFixed(2)),
            Number(teaching.toFixed(2)),
            f.maxLoad,
            other,
            Number(total.toFixed(2)),
            preparations(data, f.id, term),
            Number(Math.max(0, total - f.maxLoad).toFixed(2)),
            Number(Math.max(0, f.maxLoad - total).toFixed(2)),
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
                ? meetingAssignment(data, m)?.facultyId === resource
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
          `${m.component} · ${groupLabel(data, m.groupId)}`,
          rowName(data, "faculty", meetingAssignment(data, m)?.facultyId ?? ""),
          rowName(data, "rooms", m.roomId),
        ]),
    };
  const filtered = offerings.filter((o) =>
    type === "Unassigned Subject Report"
      ? !offeringComplete(data, o.id)
      : type === "Individual Faculty Teaching Load" && resource
        ? assignments.some(
            (a) => a.offeringId === o.id && a.facultyId === resource,
          )
        : true,
  );
  const rule = data.workloadRules[0];
  if (type === "Individual Faculty Teaching Load" && resource)
    return {
      headers: [
        "Course / section / duty",
        "Group / category",
        "Schedule",
        "Day",
        "Room",
        "Credit",
        "Students",
        "Credit source",
      ],
      rows: loadRows(data, term, resource, program),
    };
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
        data.teachingGroups.some((g) => g.offeringId === o.id)
          ? data.teachingGroups
              .filter(
                (g) =>
                  g.offeringId === o.id &&
                  assignments.some((a) => a.groupId === g.id),
              )
              .reduce((sum, g) => sum + groupCredits(data, g), 0)
          : assignments.some((a) => a.offeringId === o.id)
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
