import { describe, it, expect } from "vitest";
import {
  buildForm3Import,
  parseDays,
  parseForm3,
  parseTimeRange,
  type FormOptions,
  type Grid,
} from "./form3";
import { sampleData } from "./sample";
import { checkData } from "./storage";
import { workload } from "./engine";
const grid: Grid = [
  ["Faculty Loading Summary"],
  ["1st Term, AY 2026-2027"],
  [
    "NAME OF FACULTY",
    "Course No./Section/Adm. Function",
    "SCHEDULE",
    "DAY",
    "Room Assignment",
    "Academic /Adm.Load",
    "OVERLOAD",
    "No. of Students",
  ],
  [
    "Example Instructor (Lecturer)",
    "BCA111-B181",
    "8:00AM - 10:00AM",
    "M",
    "ROOM A",
    2,
    null,
    30,
  ],
  [null, "BCA111-B181 (LAB)", "1:00PM - 4:00PM", "T", "LAB A", 2.55, null, 15],
  [
    null,
    "BCA111-B181.1 (LAB)",
    "1:00PM - 4:00PM",
    "Th",
    "LAB A",
    2.55,
    null,
    15,
  ],
  [null, "Year Level Adviser (Example order)", "-", "-", "-", 2, null, "-"],
  [null, "TOTAL FACULTY LOAD", null, null, null, 9.1],
  [null, "No. of Preparations", null, null, null, 1],
  ["Prepared By:"],
];
function options(): FormOptions {
  return {
    term: "term2",
    program: "program1",
    maxLoad: 18,
    schedules: false,
    overloadsAsWarnings: true,
    confirmed: true,
    courses: {
      BCA111: {
        subjectId: "",
        name: "Fundamentals of Computer Applications 1",
        units: "3",
      },
    },
    rooms: {
      "ROOM A": { roomId: "room1", capacity: "", type: "classroom" },
      "LAB A": { roomId: "room2", capacity: "", type: "laboratory" },
    },
    years: { B181: "1" },
  };
}
describe("reviewed Form 3 import", () => {
  it("reads merged faculty blocks, separate labs and duties without importing totals", () => {
    const source = parseForm3(grid, "Chosen plan");
    expect(source.lines).toHaveLength(4);
    expect(source.faculty).toEqual([
      { name: "Example Instructor", rank: "Lecturer", leave: false },
    ]);
    expect(source.lines.map((l) => l.kind)).toEqual([
      "teaching",
      "teaching",
      "teaching",
      "duty",
    ]);
    expect(source.lines[2].block).toBe("B181.1");
  });
  it("parses longest day tokens and noon correctly", () => {
    expect(parseDays("MTh")).toEqual([0, 3]);
    expect(parseDays("ThF")).toEqual([3, 4]);
    expect(parseDays("WSaSu")).toEqual([2, 5, 6]);
    expect(parseTimeRange("12:00NN - 1:30PM")).toEqual({
      start: "12:00",
      end: "13:30",
    });
  });
  it("rejects ambiguous, reversed and malformed schedules", () => {
    expect(() => parseDays("X")).toThrow();
    expect(() => parseTimeRange("7:30AM - 19:00AM")).toThrow();
    expect(() => parseTimeRange("5:00PM - 7l00PM")).toThrow();
    expect(() => parseTimeRange("5:00PM - 4:00PM")).toThrow();
  });
  it("imports sourced credits, separate lab groups and other duties without inventing room bookings", () => {
    const data = sampleData(),
      source = parseForm3(grid, "Chosen plan"),
      next = buildForm3Import(data, source, options());
    expect(next.meetings).toEqual(data.meetings);
    expect(next.teachingGroups).toHaveLength(3);
    expect(next.loadActivities).toHaveLength(1);
    const person = next.faculty.find((f) => f.name === "Example Instructor")!;
    expect(workload(next, person.id, "term2")).toBe(9.1);
    expect(
      next.teachingGroups.every((g) =>
        g.creditReason.includes("Chosen plan!F"),
      ),
    ).toBe(true);
    expect(next.schedulingRules).toEqual(data.schedulingRules);
    expect(data.teachingGroups).toEqual([]);
    expect(checkData(next)).toEqual(next);
  });
  it("creates all validated meetings when rooms are mapped", () => {
    const next = buildForm3Import(
      sampleData(),
      parseForm3(grid, "Chosen plan"),
      { ...options(), schedules: true },
    );
    expect(next.meetings).toHaveLength(5);
    expect(next.meetings.slice(2).every((m) => m.groupId)).toBe(true);
  });
  it("blocks imports lacking confirmed academic units, block years, student counts, or source selection", () => {
    const source = parseForm3(grid, "Chosen plan");
    expect(() =>
      buildForm3Import(sampleData(), source, {
        ...options(),
        confirmed: false,
      }),
    ).toThrow("Confirm");
    expect(() =>
      buildForm3Import(sampleData(), source, {
        ...options(),
        courses: { BCA111: { subjectId: "", name: "", units: "" } },
      }),
    ).toThrow("cannot be inferred");
    expect(() =>
      buildForm3Import(sampleData(), source, { ...options(), years: {} }),
    ).toThrow("year level");
    source.lines[0].students = undefined;
    expect(() => buildForm3Import(sampleData(), source, options())).toThrow(
      "student count",
    );
  });
  it("does not silently overwrite an existing imported offering", () => {
    const source = parseForm3(grid, "Chosen plan"),
      first = buildForm3Import(sampleData(), source, options()),
      subject = first.subjects.find((s) => s.code === "BCA111")!;
    expect(() =>
      buildForm3Import(first, source, {
        ...options(),
        courses: { BCA111: { subjectId: subject.id, name: "", units: "" } },
      }),
    ).toThrow("already exists");
  });
  it("requires explicit handling of duplicate alternative assignments in the selected sheet", () => {
    const source = parseForm3(grid, "Chosen plan");
    source.lines.push({ ...source.lines[0], row: 99 });
    expect(() => buildForm3Import(sampleData(), source, options())).toThrow(
      "duplicate",
    );
    source.lines.at(-1)!.include = false;
    expect(
      buildForm3Import(sampleData(), source, options()).teachingGroups,
    ).toHaveLength(3);
  });
  it("allows a later course version without overwriting historical catalog values", () => {
    const data = sampleData();
    data.subjects[0].code = "BCA111";
    const next = buildForm3Import(
      data,
      parseForm3(grid, "Chosen plan"),
      options(),
    );
    expect(next.subjects.filter((s) => s.code === "BCA111")).toHaveLength(2);
    expect(next.subjects.find((s) => s.id === "sub1")?.name).toBe(
      data.subjects[0].name,
    );
  });
  it("imports study leave for the selected semester without deactivating other terms", () => {
    const source = parseForm3(
      [
        ...grid.slice(0, 3),
        ["Leave Instructor (Lecturer)", "STUDY LEAVE"],
        ...grid.slice(3),
      ],
      "Chosen plan",
    );
    const next = buildForm3Import(sampleData(), source, options());
    expect(
      next.faculty.find((f) => f.name === "Leave Instructor"),
    ).toMatchObject({ active: true, status: "active" });
    expect(
      next.loadActivities.some(
        (a) =>
          a.kind === "leave" &&
          a.semesterId === "term2" &&
          a.facultyId ===
            next.faculty.find((f) => f.name === "Leave Instructor")?.id,
      ),
    ).toBe(true);
  });
});

it("maps a source faculty alias to an existing roster ID without creating a duplicate", () => {
  const data = sampleData(),
    source = parseForm3(grid, "Chosen plan"),
    next = buildForm3Import(data, source, {
      ...options(),
      faculty: { "Example Instructor": "fac1" },
    });
  expect(next.faculty).toHaveLength(data.faculty.length);
  expect(
    next.assignments
      .filter((a) => next.teachingGroups.some((g) => g.id === a.groupId))
      .every((a) => a.facultyId === "fac1"),
  ).toBe(true);
});
