import { offeringName, uid, type Data, type Row } from "./model";
export function groupCredits(data: Data, group: Row<"teachingGroups">): number {
  if (group.creditedLoad !== undefined) return group.creditedLoad;
  const category = data.loadCategories.find(
      (c) => c.id === group.loadCategoryId,
    ),
    rule = data.workloadRules[0];
  return (
    Math.round(
      group.contactHours *
        (category?.factor ??
          (group.component === "lecture"
            ? rule.lectureFactor
            : rule.labFactor)) *
        10000,
    ) / 10000
  );
}
export function meetingAssignment(data: Data, meeting: Row<"meetings">) {
  return data.assignments.find(
    (a) => a.offeringId === meeting.offeringId && a.groupId === meeting.groupId,
  );
}
export function offeringComplete(data: Data, offeringId: string) {
  const groups = data.teachingGroups.filter((g) => g.offeringId === offeringId);
  return groups.length
    ? groups.every((g) => data.assignments.some((a) => a.groupId === g.id))
    : data.assignments.some((a) => a.offeringId === offeringId);
}
export function teachingLoad(data: Data, facultyId: string, term: string) {
  return data.assignments
    .filter((a) => a.facultyId === facultyId)
    .reduce((sum, a) => {
      const o = data.offerings.find(
        (o) => o.id === a.offeringId && o.semesterId === term,
      );
      if (!o) return sum;
      const group = data.teachingGroups.find((g) => g.id === a.groupId);
      if (group) return sum + groupCredits(data, group);
      const subject = data.subjects.find((s) => s.id === o.subjectId),
        rule = data.workloadRules[0];
      return (
        sum +
        (subject
          ? subject.lectureHours * rule.lectureFactor +
            subject.labHours * rule.labFactor
          : 0)
      );
    }, 0);
}
export function otherLoad(data: Data, facultyId: string, term: string) {
  return data.loadActivities
    .filter((a) => a.facultyId === facultyId && a.semesterId === term)
    .reduce((s, a) => s + a.credits, 0);
}
export function preparations(data: Data, facultyId: string, term: string) {
  return new Set(
    data.assignments
      .filter((a) => a.facultyId === facultyId)
      .flatMap((a) => {
        const o = data.offerings.find(
          (o) => o.id === a.offeringId && o.semesterId === term,
        );
        const s = data.subjects.find((s) => s.id === o?.subjectId);
        return s ? [s.code.toUpperCase()] : [];
      }),
  ).size;
}
export function enableGroups(
  data: Data,
  offeringId: string,
  ids?: Partial<Record<"lecture" | "lab", string>>,
): Data {
  if (data.teachingGroups.some((g) => g.offeringId === offeringId)) return data;
  const next = structuredClone(data),
    o = next.offerings.find((o) => o.id === offeringId),
    s = next.subjects.find((s) => s.id === o?.subjectId),
    section = next.sections.find((s) => s.id === o?.sectionId);
  if (!o || !s || !section) throw new Error("Choose a valid subject offering.");
  const previous = next.assignments.find((a) => a.offeringId === offeringId);
  next.assignments = next.assignments.filter(
    (a) => a.offeringId !== offeringId,
  );
  for (const component of ["lecture", "lab"] as const) {
    const hours = component === "lecture" ? s.lectureHours : s.labHours;
    if (hours <= 0) continue;
    const group: Row<"teachingGroups"> = {
      id: ids?.[component] ?? uid(),
      name: component === "lecture" ? "Lecture" : "Lab A",
      offeringId,
      component,
      students: section.size,
      contactHours: hours,
      creditReason: "",
      sourceNote: "",
    };
    next.teachingGroups.push(group);
    if (previous)
      next.assignments.push({ ...previous, id: uid(), groupId: group.id });
    next.meetings = next.meetings.map((m) =>
      m.offeringId === offeringId && m.component === component
        ? { ...m, groupId: group.id }
        : m,
    );
  }
  return next;
}
export function splitLab(data: Data, groupId: string): Data {
  const next = structuredClone(data),
    group = next.teachingGroups.find((g) => g.id === groupId);
  if (!group || group.component !== "lab" || group.students < 2)
    throw new Error("A laboratory group needs at least two students to split.");
  if (next.meetings.some((m) => m.groupId === groupId))
    throw new Error(
      "Remove or move this group’s meetings before splitting it.",
    );
  const count = Math.ceil(group.students / 2);
  group.students = count;
  const second = {
    ...group,
    id: uid(),
    name: `Lab ${next.teachingGroups.filter((g) => g.offeringId === group.offeringId && g.component === "lab").length + 1}`,
    students: Math.floor(
      data.teachingGroups.find((g) => g.id === groupId)!.students / 2,
    ),
  };
  next.teachingGroups.push(second);
  const assigned = next.assignments.find((a) => a.groupId === groupId);
  if (assigned)
    next.assignments.push({ ...assigned, id: uid(), groupId: second.id });
  return next;
}
export function groupLabel(data: Data, groupId?: string) {
  return (
    data.teachingGroups.find((g) => g.id === groupId)?.name ?? "Whole offering"
  );
}
export function loadRows(
  data: Data,
  term: string,
  facultyId: string,
  program = "",
) {
  const rows: (string | number)[][] = [];
  for (const a of data.assignments.filter((a) => a.facultyId === facultyId)) {
    const o = data.offerings.find(
      (o) => o.id === a.offeringId && o.semesterId === term,
    );
    if (
      !o ||
      (program &&
        data.sections.find((s) => s.id === o.sectionId)?.programId !== program)
    )
      continue;
    const group = data.teachingGroups.find((g) => g.id === a.groupId),
      subject = data.subjects.find((s) => s.id === o.subjectId)!;
    const ms = data.meetings.filter(
      (m) => m.offeringId === o.id && m.groupId === a.groupId,
    );
    const creditSource =
      group?.creditedLoad !== undefined
        ? group.creditReason
        : group?.loadCategoryId
          ? (data.loadCategories.find((c) => c.id === group.loadCategoryId)
              ?.name ?? "Configured factor")
          : "Department factors";
    const credit = group
      ? groupCredits(data, group)
      : subject.lectureHours * data.workloadRules[0].lectureFactor +
        subject.labHours * data.workloadRules[0].labFactor;
    if (!ms.length)
      rows.push([
        offeringName(data, o.id),
        group?.name ?? "Whole offering",
        "Unscheduled",
        "",
        "",
        credit,
        group?.students ??
          data.sections.find((s) => s.id === o.sectionId)?.size ??
          "",
        creditSource,
      ]);
    ms.forEach((m, i) =>
      rows.push([
        offeringName(data, o.id),
        group?.name ?? m.component,
        `${m.start}–${m.end}`,
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][m.day],
        data.rooms.find((r) => r.id === m.roomId)?.code ?? "",
        i === 0 ? credit : "",
        group?.students ??
          data.sections.find((s) => s.id === o.sectionId)?.size ??
          "",
        creditSource,
      ]),
    );
  }
  for (const a of data.loadActivities.filter(
    (a) => a.semesterId === term && a.facultyId === facultyId,
  ))
    rows.push([a.name, a.kind, "—", "—", "—", a.credits, "—", a.reference]);
  return rows;
}

export function assignOfferingFaculty(
  data: Data,
  offeringIds: string[],
  facultyId: string,
  onlyUnassigned = false,
): Data {
  const next = structuredClone(data);
  for (const offeringId of offeringIds) {
    const groups = next.teachingGroups.filter(
        (g) => g.offeringId === offeringId,
      ),
      targets: (string | undefined)[] = groups.length
        ? groups.map((g) => g.id)
        : [undefined];
    for (const groupId of targets) {
      if (
        onlyUnassigned &&
        next.assignments.some(
          (a) => a.offeringId === offeringId && a.groupId === groupId,
        )
      )
        continue;
      next.assignments = next.assignments.filter(
        (a) => !(a.offeringId === offeringId && a.groupId === groupId),
      );
      next.assignments.push({
        id: uid(),
        offeringId,
        facultyId,
        ...(groupId ? { groupId } : {}),
      });
    }
  }
  return next;
}
