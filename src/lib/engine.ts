import { days, offeringName, type Data, type Row } from "./model";
export const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
export const clockTime = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const overlaps = (
  a: { start: string; end: string },
  b: { start: string; end: string },
) => a.start < b.end && b.start < a.end;
export type Issue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  offeringId?: string;
  meetingId?: string;
};
export function workload(data: Data, facultyId: string, semesterId: string) {
  const rule = data.workloadRules[0];
  return data.assignments
    .filter((a) => a.facultyId === facultyId)
    .reduce((sum, a) => {
      const o = data.offerings.find(
        (o) => o.id === a.offeringId && o.semesterId === semesterId,
      );
      const s = data.subjects.find((s) => s.id === o?.subjectId);
      return (
        sum +
        (s
          ? s.lectureHours * rule.lectureFactor + s.labHours * rule.labFactor
          : 0)
      );
    }, 0);
}
function covered(
  start: string,
  end: string,
  intervals: { start: string; end: string }[],
) {
  let cursor = start;
  for (const range of [...intervals].sort((a, b) =>
    a.start.localeCompare(b.start),
  )) {
    if (range.start > cursor) break;
    if (range.end > cursor) cursor = range.end;
    if (cursor >= end) return true;
  }
  return false;
}
export function roomOpen(
  data: Data,
  roomId: string,
  day: number,
  start: string,
  end: string,
) {
  const rule = data.schedulingRules[0];
  if (
    !rule.days.includes(day) ||
    start < rule.start ||
    end > rule.end ||
    start >= end
  )
    return false;
  const all = data.roomAvailability.filter((r) => r.roomId === roomId);
  const allowed = all.filter((r) => r.kind === "available");
  return (
    (!allowed.length ||
      covered(
        start,
        end,
        allowed.filter((r) => r.day === day),
      )) &&
    !all.some(
      (r) =>
        r.kind === "blocked" && r.day === day && overlaps(r, { start, end }),
    )
  );
}
export function validate(data: Data, semesterId?: string): Issue[] {
  const issues: Issue[] = [];
  const rule = data.schedulingRules[0];
  const offerings = data.offerings.filter(
    (o) => !semesterId || o.semesterId === semesterId,
  );
  const offeringMap = new Map(data.offerings.map((o) => [o.id, o]));
  const assignmentMap = new Map(data.assignments.map((a) => [a.offeringId, a]));
  const meetings = data.meetings.filter((m) =>
    offerings.some((o) => o.id === m.offeringId),
  );
  const add = (
    severity: Issue["severity"],
    code: string,
    message: string,
    m?: Row<"meetings">,
    offeringId?: string,
  ) =>
    issues.push({
      severity,
      code,
      message,
      meetingId: m?.id,
      offeringId: m?.offeringId ?? offeringId,
    });
  for (const o of offerings) {
    const subject = data.subjects.find((s) => s.id === o.subjectId);
    const assignment = assignmentMap.get(o.id);
    if (!assignment)
      add(
        "warning",
        "unassigned",
        `${offeringName(data, o.id)} needs a faculty assignment.`,
        undefined,
        o.id,
      );
    else {
      const faculty = data.faculty.find((f) => f.id === assignment.facultyId);
      if (!faculty?.active)
        add(
          "error",
          "inactive-faculty",
          `${offeringName(data, o.id)} requires an active faculty member.`,
          undefined,
          o.id,
        );
      if (
        faculty?.specialization &&
        rule.specialization === "warning" &&
        subject &&
        !faculty.specialization
          .toLowerCase()
          .split(",")
          .some(
            (s) =>
              subject.name.toLowerCase().includes(s.trim()) ||
              subject.code.toLowerCase().includes(s.trim()),
          )
      )
        add(
          "warning",
          "specialization",
          `${faculty.name}: review specialization for ${subject.code}.`,
          undefined,
          o.id,
        );
    }
    for (const component of ["lecture", "lab"] as const) {
      const scheduled =
        data.meetings
          .filter((m) => m.offeringId === o.id && m.component === component)
          .reduce((s, m) => s + minutes(m.end) - minutes(m.start), 0) / 60;
      const expected =
        subject?.[component === "lecture" ? "lectureHours" : "labHours"] ?? 0;
      if (Math.abs(scheduled - expected) > 0.001)
        add(
          "warning",
          "contact-hours",
          `${offeringName(data, o.id)}: ${scheduled} of ${expected} weekly ${component} contact hours scheduled.`,
          undefined,
          o.id,
        );
    }
  }
  for (let i = 0; i < meetings.length; i++) {
    const m = meetings[i],
      o = offeringMap.get(m.offeringId),
      room = data.rooms.find((r) => r.id === m.roomId);
    const section = data.sections.find((s) => s.id === o?.sectionId),
      subject = data.subjects.find((s) => s.id === o?.subjectId);
    const assignment = assignmentMap.get(m.offeringId);
    const faculty = data.faculty.find((f) => f.id === assignment?.facultyId);
    const context = `${offeringName(data, m.offeringId)} · ${days[m.day]} ${m.start}–${m.end}`;
    if (
      m.start >= m.end ||
      !rule.days.includes(m.day) ||
      m.start < rule.start ||
      m.end > rule.end
    )
      add(
        "error",
        "invalid-time",
        `${context}: choose an enabled day and a valid time within ${rule.start}–${rule.end}.`,
        m,
      );
    if (!room?.active)
      add("error", "inactive-room", `${context}: choose an active room.`, m);
    if (room && section && room.capacity < section.size)
      add(
        "error",
        "capacity",
        `${room.code} seats ${room.capacity}; ${section.name} needs ${section.size} seats. Choose a larger room.`,
        m,
      );
    if (m.component === "lab" && room?.type !== "laboratory")
      add(
        "error",
        "room-type",
        `${context}: laboratory meetings require a laboratory.`,
        m,
      );
    if (
      subject?.[m.component === "lecture" ? "lectureHours" : "labHours"] === 0
    )
      add(
        "error",
        "component",
        `${subject.code} has no ${m.component} component.`,
        m,
      );
    const equipment =
      subject?.equipment
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) ?? [];
    if (
      room &&
      equipment.some(
        (e) =>
          !room.equipment
            .toLowerCase()
            .split(",")
            .map((s) => s.trim())
            .includes(e),
      )
    )
      add(
        "error",
        "equipment",
        `${room.code} lacks required equipment (${subject?.equipment}).`,
        m,
      );
    if (!roomOpen(data, m.roomId, m.day, m.start, m.end))
      add(
        "error",
        "room-availability",
        `${room?.code ?? "Room"} is unavailable on ${days[m.day]} ${m.start}–${m.end}. Choose another room or time.`,
        m,
      );
    if (faculty) {
      const available = data.facultyAvailability.filter(
        (a) => a.facultyId === faculty.id,
      );
      if (
        available.length &&
        !covered(
          m.start,
          m.end,
          available.filter((a) => a.day === m.day),
        )
      )
        add(
          "error",
          "faculty-availability",
          `${faculty.name} is unavailable on ${days[m.day]} ${m.start}–${m.end}.`,
          m,
        );
    }
    for (let j = i + 1; j < meetings.length; j++) {
      const n = meetings[j],
        other = offeringMap.get(n.offeringId);
      if (
        !o ||
        !other ||
        o.semesterId !== other.semesterId ||
        m.day !== n.day ||
        !overlaps(m, n)
      )
        continue;
      const otherAssignment = assignmentMap.get(n.offeringId);
      const pair = `${context} overlaps ${offeringName(data, n.offeringId)} (${n.start}–${n.end}).`;
      if (m.roomId === n.roomId)
        add(
          "error",
          "room-overlap",
          `${room?.code} is already occupied. ${pair} Choose another room or time.`,
          m,
        );
      if (o.sectionId === other.sectionId)
        add(
          "error",
          "section-overlap",
          `${section?.name} has overlapping classes. ${pair}`,
          m,
        );
      if (
        assignment &&
        otherAssignment &&
        assignment.facultyId === otherAssignment.facultyId
      )
        add(
          "error",
          "faculty-overlap",
          `${faculty?.name} has overlapping classes. ${pair}`,
          m,
        );
    }
  }
  const terms = semesterId ? [semesterId] : data.semesters.map((s) => s.id);
  for (const term of terms)
    for (const f of data.faculty) {
      const load = workload(data, f.id, term);
      if (load > f.maxLoad)
        add(
          rule.overload,
          "load-limit",
          `${f.name}: ${load.toFixed(2)} credited units exceeds the ${f.maxLoad} unit limit (${data.semesters.find((s) => s.id === term)?.name}).`,
        );
    }
  return issues;
}
export type RoomQuery = {
  semesterId: string;
  day: number;
  start: string;
  end: string;
  size: number;
  type: string;
  equipment?: string;
  excludeOfferingId?: string;
};
export function availableRooms(data: Data, q: RoomQuery) {
  if (q.start >= q.end) return [];
  const equipment =
    q.equipment
      ?.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const ids = new Set(
    data.offerings
      .filter((o) => o.semesterId === q.semesterId)
      .map((o) => o.id),
  );
  return data.rooms
    .filter(
      (r) =>
        r.active &&
        r.capacity >= q.size &&
        (!q.type || r.type === q.type) &&
        equipment.every((e) =>
          r.equipment
            .toLowerCase()
            .split(",")
            .map((s) => s.trim())
            .includes(e),
        ) &&
        roomOpen(data, r.id, q.day, q.start, q.end) &&
        !data.meetings.some(
          (m) =>
            ids.has(m.offeringId) &&
            m.offeringId !== q.excludeOfferingId &&
            m.roomId === r.id &&
            m.day === q.day &&
            overlaps(m, q),
        ),
    )
    .sort((a, b) => a.capacity - b.capacity || a.code.localeCompare(b.code));
}
function unionMinutes(intervals: { start: string; end: string }[]) {
  let total = 0,
    end = 0;
  for (const i of [...intervals].sort((a, b) =>
    a.start.localeCompare(b.start),
  )) {
    const a = minutes(i.start),
      b = minutes(i.end);
    total += Math.max(0, b - Math.max(end, a));
    end = Math.max(end, b);
  }
  return total;
}
export function utilization(data: Data, roomId: string, semesterId: string) {
  const rule = data.schedulingRules[0];
  let available = 0;
  for (const day of rule.days)
    for (let t = minutes(rule.start); t < minutes(rule.end); t++)
      if (roomOpen(data, roomId, day, clockTime(t), clockTime(t + 1)))
        available++;
  const offered = new Set(
    data.offerings.filter((o) => o.semesterId === semesterId).map((o) => o.id),
  );
  const meetings = data.meetings.filter(
    (m) => m.roomId === roomId && offered.has(m.offeringId),
  );
  const occupied = days.reduce(
    (sum, _, day) => sum + unionMinutes(meetings.filter((m) => m.day === day)),
    0,
  );
  return {
    available,
    occupied,
    percent: available ? (occupied / available) * 100 : 0,
  };
}
export function suggestions(
  data: Data,
  offeringId: string,
  component: "lecture" | "lab",
  duration = 60,
) {
  const o = data.offerings.find((o) => o.id === offeringId),
    s = data.subjects.find((s) => s.id === o?.subjectId),
    section = data.sections.find((s) => s.id === o?.sectionId);
  if (!o || !s || !section) return [];
  const result: Omit<Row<"meetings">, "id">[] = [];
  const rule = data.schedulingRules[0];
  for (const day of rule.days)
    for (
      let t = minutes(rule.start);
      t + duration <= minutes(rule.end);
      t += 30
    ) {
      const start = clockTime(t),
        end = clockTime(t + duration);
      const rooms = availableRooms(data, {
        semesterId: o.semesterId,
        day,
        start,
        end,
        size: section.size,
        type: component === "lab" ? "laboratory" : "",
        equipment: s.equipment,
      });
      for (const room of rooms.slice(0, 3)) {
        const meeting = {
          id: "suggestion",
          offeringId,
          component,
          day,
          start,
          end,
          roomId: room.id,
        };
        const candidate = { ...data, meetings: [...data.meetings, meeting] };
        if (
          !validate(candidate, o.semesterId).some((i) => i.severity === "error")
        )
          result.push(meeting);
        if (result.length >= 4) return result;
      }
    }
  return result;
}
