import readXlsxFile, { readSheetNames } from "read-excel-file";
import { uid, type Data, type Row } from "./model";
import { checkData } from "./storage";
export type Grid = unknown[][];
export type FormLine = {
  row: number;
  faculty: string;
  rank: string;
  kind: "teaching" | "duty";
  label: string;
  course: string;
  block: string;
  component: "lecture" | "lab";
  time: string;
  day: string;
  room: string;
  students: number | undefined;
  credit: number;
  include: boolean;
  problem?: string;
};
export type FormSource = {
  sheet: string;
  header: string;
  lines: FormLine[];
  faculty: { name: string; rank: string; leave: boolean }[];
};
const text = (v: unknown) => String(v ?? "").trim();
export const normalizeRoom = (v: string) => v.toUpperCase().replace(/\s+/g, "");
export function parseDays(source: string): number[] {
  const tokens: { [key: string]: number } = {
    M: 0,
    T: 1,
    W: 2,
    Th: 3,
    F: 4,
    Sa: 5,
    Su: 6,
  };
  const normalized = source.trim().replace(/[, /&+]/g, "");
  const parts = normalized.match(/Th|Sa|Su|M|T|W|F/g);
  if (!parts || parts.join("") !== normalized)
    throw new Error(
      `Unrecognized day “${source}”. Use M, T, W, Th, F, Sa, Su or a combination.`,
    );
  return [...new Set(parts.map((p) => tokens[p]))];
}
function parseClock(source: string) {
  const match = source
    .replace(/\s+/g, "")
    .toUpperCase()
    .match(/^(\d{1,2}):(\d{2})(AM|PM|NN)$/);
  if (!match)
    throw new Error(`Review time “${source}”; use an explicit AM/PM time.`);
  let h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 1 || h > 12 || m > 59) throw new Error(`Invalid time “${source}”.`);
  h = (h % 12) + (match[3] === "AM" ? 0 : 12);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export function parseTimeRange(source: string) {
  const parts = source.split(/\s*[-–—]\s*/);
  if (parts.length !== 2) throw new Error(`Review time range “${source}”.`);
  const start = parseClock(parts[0]),
    end = parseClock(parts[1]);
  if (start >= end) throw new Error("The meeting must end after it starts.");
  return { start, end };
}
export function parseForm3(grid: Grid, sheet: string): FormSource {
  const headerIndex = grid.findIndex(
    (row) =>
      text(row[0]).toUpperCase().includes("NAME OF FACULTY") &&
      text(row[1]).toUpperCase().includes("COURSE"),
  );
  if (headerIndex < 0)
    throw new Error(
      "This sheet is not a supported Form 3 faculty loading table. Select the worksheet containing Name of Faculty, Course/Section, Schedule, Day, Room, Load and Students in columns A–H.",
    );
  const faculty: FormSource["faculty"] = [],
    lines: FormLine[] = [];
  let current = "",
    rank = "";
  const header =
    grid
      .slice(0, headerIndex)
      .flat()
      .map(text)
      .find((t) => /\bAY\b|academic year/i.test(t)) ?? "";
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i],
      a = text(row[0]),
      label = text(row[1]);
    if (/prepared by|certified correct|approved by/i.test(a)) break;
    if (/[A-Za-z]{2}/.test(a) && !/total|preparation|preperation/i.test(a)) {
      current = a
        .replace(/\([^)]*\)/g, "")
        .replace(/\*/g, "")
        .replace(/\s+/g, " ")
        .trim();
      rank = a.match(/\(([^)]+)\)/)?.[1].trim() ?? "";
      if (!faculty.some((f) => f.name === current))
        faculty.push({ name: current, rank, leave: false });
    }
    if (
      !current ||
      !label ||
      /total faculty|preperation|preparation/i.test(label)
    )
      continue;
    if (/study leave/i.test(label)) {
      const f = faculty.find((f) => f.name === current);
      if (f) f.leave = true;
      continue;
    }
    const rawCredit = row[5];
    if (
      typeof rawCredit !== "number" ||
      !Number.isFinite(rawCredit) ||
      rawCredit < 0
    )
      continue;
    const code = label.match(/^([A-Z]{2,6})\s*(\d{3}[A-Z]?)/i),
      time = text(row[2]),
      day = text(row[3]),
      room = text(row[4]);
    const hasSchedule =
      time !== "" && time !== "-" && day !== "" && day !== "-";
    const course = code ? `${code[1]}${code[2]}`.toUpperCase() : "";
    const suffix = code
      ? label
          .slice(code[0].length)
          .replace(/^\s*-\s*/, "")
          .replace(/\(?LAB\)?/gi, "")
          .trim()
      : "";
    const block =
      suffix.match(/^[A-Z]+\d+(?:\.\d+)?/i)?.[0] ??
      suffix.match(/^[A-Z]+/i)?.[0] ??
      "";
    const kind =
      code && (hasSchedule || /^[A-Z]+\d+/.test(block)) ? "teaching" : "duty";
    let problem: string | undefined;
    if (kind === "teaching" && hasSchedule) {
      try {
        parseTimeRange(time);
        parseDays(day);
      } catch (e) {
        problem = e instanceof Error ? e.message : "Invalid schedule.";
      }
    }
    lines.push({
      row: i + 1,
      faculty: current,
      rank,
      kind,
      label,
      course,
      block,
      component: /LAB/i.test(label) ? "lab" : "lecture",
      time,
      day,
      room,
      students: typeof row[7] === "number" && row[7] > 0 ? row[7] : undefined,
      credit: rawCredit,
      include: true,
      problem,
    });
  }
  if (!lines.length)
    throw new Error(
      "No loading rows found. Choose a faculty loading worksheet rather than a plotted timetable.",
    );
  return { sheet, header, lines, faculty };
}
export async function formSheetNames(file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Use a workbook smaller than 10 MB.");
  return readSheetNames(file);
}
export async function readForm3(file: File, sheet: string) {
  return parseForm3(await readXlsxFile(file, { sheet }), sheet);
}
export type CourseMap = { subjectId: string; name: string; units: string };
export type RoomMap = {
  roomId: string;
  capacity: string;
  type: "classroom" | "laboratory";
};
export type FormOptions = {
  term: string;
  program: string;
  maxLoad: number;
  schedules: boolean;
  overloadsAsWarnings: boolean;
  confirmed: boolean;
  courses: Record<string, CourseMap>;
  rooms: Record<string, RoomMap>;
  years: Record<string, string>;
  faculty?: Record<string, string>;
};
const rootBlock = (block: string) => block.split(".")[0];
export function buildForm3Import(
  data: Data,
  source: FormSource,
  options: FormOptions,
): Data {
  if (!options.confirmed)
    throw new Error(
      "Confirm the selected worksheet and target semester before importing.",
    );
  const term = data.semesters.find((t) => t.id === options.term);
  if (!term || term.finalized)
    throw new Error("Choose an open destination semester.");
  if (!data.programs.some((p) => p.id === options.program))
    throw new Error("Choose the academic program for these classes.");
  if (!Number.isFinite(options.maxLoad) || options.maxLoad < 0)
    throw new Error("Enter a valid default load limit for new faculty.");
  const selected = source.lines.filter((l) => l.include);
  if (!selected.length) throw new Error("Select at least one row to import.");
  const next = structuredClone(data),
    facultyIds = new Map<string, string>(),
    subjectIds = new Map<string, string>(),
    sectionIds = new Map<string, string>(),
    roomIds = new Map<string, string>();
  const curriculumId = uid();
  let newCurriculum = false;
  for (const person of source.faculty.filter(
    (f) => f.leave || selected.some((l) => l.faculty === f.name),
  )) {
    const chosen = options.faculty?.[person.name];
    let existing = chosen
      ? next.faculty.find((f) => f.id === chosen)
      : next.faculty.find(
          (f) => f.name.trim().toUpperCase() === person.name.toUpperCase(),
        );
    if (chosen && !existing)
      throw new Error(`Choose an existing faculty record for ${person.name}.`);
    if (!existing) {
      existing = {
        id: uid(),
        name: person.name,
        rank: person.rank,
        maxLoad: options.maxLoad,
        active: true,
        status: /new faculty|new staff/i.test(person.name)
          ? "proposed"
          : "active",
        specialization: "",
      };
      next.faculty.push(existing);
    }
    facultyIds.set(person.name, existing.id);
    if (
      person.leave &&
      !next.loadActivities.some(
        (a) =>
          a.semesterId === term.id &&
          a.facultyId === existing!.id &&
          a.kind === "leave",
      )
    )
      next.loadActivities.push({
        id: uid(),
        semesterId: term.id,
        facultyId: existing.id,
        name: "Study leave",
        kind: "leave",
        credits: 0,
        reference: `Reported status · ${source.sheet}`,
      });
  }
  for (const course of [
    ...new Set(
      selected.filter((l) => l.kind === "teaching").map((l) => l.course),
    ),
  ]) {
    const map = options.courses[course];
    if (!map)
      throw new Error(
        `${course}: select a catalog subject or enter its title and course units.`,
      );
    if (map.subjectId) {
      const s = next.subjects.find((s) => s.id === map.subjectId);
      const c = next.curricula.find((c) => c.id === s?.curriculumId);
      if (!s || c?.programId !== options.program)
        throw new Error(
          `${course}: choose a subject from the selected program.`,
        );
      subjectIds.set(course, s.id);
    } else {
      if (
        !map.name.trim() ||
        map.units === "" ||
        !Number.isFinite(Number(map.units)) ||
        Number(map.units) < 0
      )
        throw new Error(
          `${course}: enter its course title and nonnegative course units. These cannot be inferred from faculty load.`,
        );
      const own = selected.filter((l) => l.course === course),
        hours = (component: "lecture" | "lab") =>
          Math.max(
            0,
            ...own
              .filter((l) => l.component === component)
              .map((l) => {
                try {
                  const t = parseTimeRange(l.time);
                  return (
                    ((Number(t.end.slice(0, 2)) * 60 +
                      Number(t.end.slice(3)) -
                      (Number(t.start.slice(0, 2)) * 60 +
                        Number(t.start.slice(3)))) /
                      60) *
                    parseDays(l.day).length
                  );
                } catch {
                  return 0;
                }
              }),
          );
      const id = uid();
      next.subjects.push({
        id,
        code: course,
        name: map.name.trim(),
        curriculumId,
        courseUnits: Number(map.units),
        lectureHours: hours("lecture"),
        labHours: hours("lab"),
        equipment: "",
      });
      subjectIds.set(course, id);
      newCurriculum = true;
    }
  }
  if (newCurriculum)
    next.curricula.push({
      id: curriculumId,
      programId: options.program,
      name: `Imported loading snapshot · ${term.name}`,
    });
  for (const block of [
    ...new Set(
      selected
        .filter((l) => l.kind === "teaching")
        .map((l) => rootBlock(l.block)),
    ),
  ]) {
    if (!block)
      throw new Error(
        "A teaching row has no section identifier. Exclude it or correct its block.",
      );
    const existing = next.sections.find(
      (s) =>
        s.name.toUpperCase() === block.toUpperCase() &&
        s.programId === options.program,
    );
    if (existing) {
      sectionIds.set(block, existing.id);
      continue;
    }
    const year = Number(options.years[block]);
    if (!Number.isInteger(year) || year < 1 || year > 10)
      throw new Error(`${block}: confirm its year level.`);
    const own = selected.filter((l) => rootBlock(l.block) === block),
      size = Math.max(
        0,
        ...own
          .filter((l) => l.component === "lecture")
          .map((l) => l.students ?? 0),
        ...own.map((l) => l.students ?? 0),
      );
    if (!size)
      throw new Error(
        `${block}: enter student counts on the included teaching rows.`,
      );
    const id = uid();
    next.sections.push({
      id,
      name: block,
      programId: options.program,
      yearLevel: year,
      size,
    });
    sectionIds.set(block, id);
  }
  if (options.schedules)
    for (const name of [
      ...new Set(
        selected
          .filter(
            (l) =>
              l.kind === "teaching" &&
              l.time &&
              l.time !== "-" &&
              l.room &&
              l.room !== "-" &&
              l.room.toUpperCase() !== "TBA",
          )
          .map((l) => l.room),
      ),
    ]) {
      const map = options.rooms[name];
      if (!map)
        throw new Error(`${name}: choose a room or enter its capacity.`);
      if (map.roomId) {
        if (!next.rooms.some((r) => r.id === map.roomId))
          throw new Error(`${name}: choose an existing room.`);
        roomIds.set(name, map.roomId);
      } else {
        const capacity = Number(map.capacity);
        if (!Number.isInteger(capacity) || capacity < 1)
          throw new Error(
            `${name}: confirm its seating capacity. Enrollment is not proof of room capacity.`,
          );
        const match = next.rooms.find(
          (r) => normalizeRoom(r.code) === normalizeRoom(name),
        );
        if (match) {
          roomIds.set(name, match.id);
          continue;
        }
        const id = uid();
        next.rooms.push({
          id,
          code: name.trim().toUpperCase(),
          name: name.trim(),
          building: "Location to confirm",
          capacity,
          type: map.type,
          equipment: "",
          active: true,
        });
        roomIds.set(name, id);
      }
    }
  const groupKeys = new Set<string>();
  for (const line of selected) {
    if (!Number.isFinite(line.credit) || line.credit < 0)
      throw new Error(
        `Row ${line.row}: enter a nonnegative credited load, including an explicit 0 if intended.`,
      );
    const facultyId = facultyIds.get(line.faculty)!;
    const sourceRef = `${source.sheet}!F${line.row}`;
    if (line.kind === "duty") {
      const kind: Row<"loadActivities">["kind"] = /research/i.test(line.label)
        ? "research"
        : /extension/i.test(line.label)
          ? "extension"
          : /advis/i.test(line.label)
            ? "advising"
            : /BCA19[79]|ICT\s*399|thesis|ojt/i.test(line.label)
              ? "supervision"
              : "administration";
      if (
        next.loadActivities.some(
          (a) =>
            a.facultyId === facultyId &&
            a.semesterId === term.id &&
            a.name === line.label,
        )
      )
        throw new Error(
          `Row ${line.row}: this faculty duty already exists. No rows were imported.`,
        );
      next.loadActivities.push({
        id: uid(),
        facultyId,
        semesterId: term.id,
        name: line.label,
        kind,
        credits: line.credit,
        reference: `Reported credit · ${sourceRef}`,
      });
      continue;
    }
    if (!line.students || !Number.isInteger(line.students))
      throw new Error(`Row ${line.row}: enter a positive student count.`);
    const subjectId = subjectIds.get(line.course)!,
      sectionId = sectionIds.get(rootBlock(line.block))!;
    let offering = next.offerings.find(
      (o) =>
        o.semesterId === term.id &&
        o.subjectId === subjectId &&
        o.sectionId === sectionId,
    );
    if (offering && data.offerings.some((o) => o.id === offering!.id))
      throw new Error(
        `Row ${line.row}: this offering already exists in the target semester. Choose an empty draft semester or exclude the duplicate.`,
      );
    if (!offering) {
      offering = { id: uid(), semesterId: term.id, subjectId, sectionId };
      next.offerings.push(offering);
    }
    const key = `${offering.id}|${line.component}|${line.block}`;
    if (groupKeys.has(key))
      throw new Error(
        `Row ${line.row}: duplicate ${line.course} ${line.block} ${line.component}. Select one version of this assignment.`,
      );
    groupKeys.add(key);
    let times: { start: string; end: string } | undefined,
      weekdays: number[] = [];
    if (line.time && line.time !== "-") {
      try {
        times = parseTimeRange(line.time);
        weekdays = parseDays(line.day);
      } catch (e) {
        if (options.schedules)
          throw new Error(
            `Row ${line.row}: ${e instanceof Error ? e.message : "Invalid schedule."}`,
          );
      }
    }
    const subject = next.subjects.find((s) => s.id === subjectId)!;
    const contactHours = times
      ? ((Number(times.end.slice(0, 2)) * 60 +
          Number(times.end.slice(3)) -
          (Number(times.start.slice(0, 2)) * 60 +
            Number(times.start.slice(3)))) /
          60) *
        weekdays.length
      : line.component === "lecture"
        ? subject.lectureHours
        : subject.labHours;
    const groupId = uid();
    next.teachingGroups.push({
      id: groupId,
      offeringId: offering.id,
      name: line.component === "lecture" ? "Lecture" : `Lab ${line.block}`,
      component: line.component,
      students: line.students,
      contactHours,
      creditedLoad: line.credit,
      creditReason: `Reported credit · ${sourceRef}`,
      sourceNote: `${source.sheet} row ${line.row}: ${line.label}; ${line.time || "Unscheduled"} ${line.day}; room ${line.room || "Unassigned"}.`,
    });
    next.assignments.push({
      id: uid(),
      offeringId: offering.id,
      groupId,
      facultyId,
    });
    if (options.schedules && times) {
      const roomId = roomIds.get(line.room);
      if (!roomId)
        throw new Error(
          `Row ${line.row}: room is missing or TBA. Map a real room, exclude the row, or choose “Load records only”.`,
        );
      for (const day of weekdays)
        next.meetings.push({
          id: uid(),
          offeringId: offering.id,
          groupId,
          component: line.component,
          roomId,
          day,
          ...times,
        });
    }
  }
  if (options.overloadsAsWarnings)
    next.semesters = next.semesters.map((t) =>
      t.id === term.id ? { ...t, overloadPolicy: "warning" } : t,
    );
  return checkData(next);
}
