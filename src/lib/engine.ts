import { meetingAssignment, teachingLoad, otherLoad } from "./loading";
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
  return (
    Math.round(
      (teachingLoad(data, facultyId, semesterId) +
        otherLoad(data, facultyId, semesterId)) *
        10000,
    ) / 10000
  );
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
  const assignmentMap = new Map(
    data.assignments.map((a) => [`${a.offeringId}|${a.groupId ?? ""}`, a]),
  );
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
    const groups = data.teachingGroups.filter((g) => g.offeringId === o.id);
    const assignments = data.assignments.filter((a) => a.offeringId === o.id);
    const assignment = assignments[0];
    if (!assignment)
      add(
        "warning",
        "unassigned",
        `${offeringName(data, o.id)} needs a faculty assignment.`,
        undefined,
        o.id,
      );
    for (const assignment of assignments) {
      const faculty = data.faculty.find((f) => f.id === assignment.facultyId);
      if (!faculty?.active)
        add(
          "warning",
          "inactive-faculty",
          `${offeringName(data, o.id)} retains inactive faculty ${faculty?.name ?? ""}. Historical records are preserved; activate or reassign before new scheduling.`,
          undefined,
          o.id,
        );
      if (
        faculty &&
        data.loadActivities.some(
          (a) =>
            a.semesterId === o.semesterId &&
            a.facultyId === faculty.id &&
            a.kind === "leave",
        )
      )
        add(
          "error",
          "faculty-leave",
          `${faculty.name} is on leave in this semester. Reassign the class or review the leave record.`,
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
    const targets = groups.length
      ? groups.map((g) => ({
          component: g.component,
          expected: g.contactHours,
          groupId: g.id,
          name: g.name,
        }))
      : (["lecture", "lab"] as const).map((component) => ({
          component,
          expected:
            subject?.[component === "lecture" ? "lectureHours" : "labHours"] ??
            0,
          groupId: undefined,
          name: component,
        }));
    for (const target of targets) {
      if (
        groups.length &&
        !data.assignments.some((a) => a.groupId === target.groupId)
      )
        add(
          "warning",
          "unassigned",
          `${offeringName(data, o.id)} · ${target.name} needs a faculty assignment.`,
          undefined,
          o.id,
        );
      const scheduled =
        data.meetings
          .filter(
            (m) =>
              m.offeringId === o.id &&
              m.component === target.component &&
              m.groupId === target.groupId,
          )
          .reduce((sum, m) => sum + minutes(m.end) - minutes(m.start), 0) / 60;
      if (Math.abs(scheduled - target.expected) > 0.001)
        add(
          "warning",
          "contact-hours",
          `${offeringName(data, o.id)} · ${target.name}: ${scheduled} of ${target.expected} weekly contact hours scheduled.`,
          undefined,
          o.id,
        );
    }
    for (const component of ["lecture", "lab"] as const) {
      if (
        groups.length &&
        subject &&
        subject[component === "lecture" ? "lectureHours" : "labHours"] > 0 &&
        !groups.some((g) => g.component === component)
      )
        add(
          "warning",
          "missing-component",
          `${offeringName(data, o.id)} has no ${component} group. Review its component requirements.`,
          undefined,
          o.id,
        );
      const componentGroups = groups.filter((g) => g.component === component);
      const section = data.sections.find((s) => s.id === o.sectionId);
      if (
        componentGroups.length &&
        componentGroups.reduce((sum, g) => sum + g.students, 0) !==
          section?.size
      )
        add(
          "warning",
          "group-enrollment",
          `${offeringName(data, o.id)}: ${component} group enrollments do not total the section size. Review group membership.`,
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
    const assignment = meetingAssignment(data, m);
    const group = data.teachingGroups.find((g) => g.id === m.groupId);
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
      add(
        "warning",
        "inactive-room",
        `${context}: ${room?.code ?? "Room"} is inactive. Existing bookings are preserved; activate or move the booking before editing it.`,
        m,
      );
    if (room && section && room.capacity < (group?.students ?? section.size))
      add(
        "error",
        "capacity",
        `${room.code} seats ${room.capacity}; ${section.name} needs ${group?.students ?? section.size} seats. Choose a larger room.`,
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
      !group &&
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
      const otherAssignment = assignmentMap.get(
        `${n.offeringId}|${n.groupId ?? ""}`,
      );
      const pair = `${context} overlaps ${offeringName(data, n.offeringId)} (${n.start}–${n.end}).`;
      if (m.roomId === n.roomId)
        add(
          "error",
          "room-overlap",
          `${room?.code} is already occupied. ${pair} Choose another room or time.`,
          m,
        );
      if (
        o.sectionId === other.sectionId &&
        !(
          o.id === other.id &&
          m.groupId &&
          n.groupId &&
          m.groupId !== n.groupId &&
          group?.component === "lab" &&
          data.teachingGroups.find((g) => g.id === n.groupId)?.component ===
            "lab"
        )
      )
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
          data.semesters.find((s) => s.id === term)?.overloadPolicy ??
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
  groupId?: string,
) {
  const o = data.offerings.find((o) => o.id === offeringId),
    s = data.subjects.find((s) => s.id === o?.subjectId),
    section = data.sections.find((s) => s.id === o?.sectionId);
  if (!o || !s || !section) return [];
  const result: Omit<Row<"meetings">, "id">[] = [];
  const rule = data.schedulingRules[0];
  const faculty = data.assignments.find(
    (a) => a.offeringId === offeringId && a.groupId === groupId,
  )?.facultyId;
  if (faculty && !data.faculty.some((f) => f.id === faculty && f.active))
    return [];
  const relevant = data.meetings.filter(
    (m) =>
      data.offerings.find((o) => o.id === m.offeringId)?.semesterId ===
        o.semesterId &&
      (data.offerings.find((o) => o.id === m.offeringId)?.sectionId ===
        o.sectionId ||
        (faculty && meetingAssignment(data, m)?.facultyId === faculty)),
  );
  for (const day of rule.days)
    for (
      let t = minutes(rule.start);
      t + duration <= minutes(rule.end);
      t += 30
    ) {
      const start = clockTime(t),
        end = clockTime(t + duration);
      if (relevant.some((m) => m.day === day && overlaps(m, { start, end })))
        continue;
      const rooms = availableRooms(data, {
        semesterId: o.semesterId,
        day,
        start,
        end,
        size:
          data.teachingGroups.find((g) => g.id === groupId)?.students ??
          section.size,
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
          ...(groupId ? { groupId } : {}),
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

// Inactive resources may remain in historical records, but cannot receive new work.
export function checkActiveResourceChanges(before: Data, next: Data) {
  const offeringChanged = (id: string) =>
    JSON.stringify(before.offerings.find((o) => o.id === id)) !==
    JSON.stringify(next.offerings.find((o) => o.id === id));
  const activeFaculty = (id?: string) =>
    next.faculty.some((f) => f.id === id && f.active);
  for (const a of next.assignments) {
    const old = before.assignments.find((v) => v.id === a.id);
    if (
      (!old ||
        old.facultyId !== a.facultyId ||
        old.offeringId !== a.offeringId ||
        old.groupId !== a.groupId ||
        offeringChanged(a.offeringId)) &&
      !activeFaculty(a.facultyId)
    )
      throw new Error(
        "Choose an active faculty member for a new or changed assignment. Existing historical assignments may remain inactive.",
      );
  }
  for (const m of next.meetings) {
    const old = before.meetings.find((v) => v.id === m.id);
    if (
      old &&
      JSON.stringify(old) === JSON.stringify(m) &&
      !offeringChanged(m.offeringId)
    )
      continue;
    if (!next.rooms.some((r) => r.id === m.roomId && r.active))
      throw new Error(
        "Choose an active room for a new or changed meeting. Existing historical bookings may remain inactive.",
      );
    const assignment = meetingAssignment(next, m);
    if (assignment && !activeFaculty(assignment.facultyId))
      throw new Error(
        "Activate or reassign this faculty member before adding or changing a meeting.",
      );
  }
}
