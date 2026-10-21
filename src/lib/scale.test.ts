import { expect, it } from "vitest";
import { emptyData, type Data } from "./model";
import { checkData } from "./storage";
import { availableRooms, utilization, validate } from "./engine";
import { buildReport } from "./reports";
it("handles a representative 50 faculty / 300 subjects / 500 offerings / 100 rooms semester", () => {
  const data: Data = {
    ...emptyData(),
    academicYears: [{ id: "ay", name: "Scale year" }],
    semesters: [
      {
        id: "term",
        name: "Scale semester",
        academicYearId: "ay",
        finalized: false,
      },
    ],
    programs: [{ id: "p", code: "P", name: "Scale program" }],
    curricula: [{ id: "c", name: "Scale curriculum", programId: "p" }],
  };
  data.faculty = Array.from({ length: 50 }, (_, i) => ({
    id: `f${i}`,
    name: `Faculty ${i}`,
    specialization: "",
    maxLoad: 18,
    active: true,
  }));
  data.subjects = Array.from({ length: 300 }, (_, i) => ({
    id: `s${i}`,
    name: `Subject ${i}`,
    code: `S${i}`,
    curriculumId: "c",
    courseUnits: 3,
    lectureHours: 1,
    labHours: 0,
    equipment: "",
  }));
  data.rooms = Array.from({ length: 100 }, (_, i) => ({
    id: `r${i}`,
    code: `R${i}`,
    name: `Room ${i}`,
    building: "Academic",
    type: "classroom" as const,
    capacity: 40,
    equipment: "",
    active: true,
  }));
  data.sections = Array.from({ length: 500 }, (_, i) => ({
    id: `sec${i}`,
    name: `Section ${i}`,
    programId: "p",
    yearLevel: 1,
    size: 30,
  }));
  data.offerings = data.sections.map((s, i) => ({
    id: `o${i}`,
    semesterId: "term",
    subjectId: `s${i % 300}`,
    sectionId: s.id,
  }));
  data.assignments = data.offerings.map((o, i) => ({
    id: `a${i}`,
    offeringId: o.id,
    facultyId: `f${i % 50}`,
  }));
  data.meetings = data.offerings.map((o, i) => ({
    id: `m${i}`,
    offeringId: o.id,
    component: "lecture" as const,
    roomId: `r${i % 100}`,
    day: Math.floor(i / 100),
    start: Math.floor(i / 50) % 2 ? "10:00" : "08:00",
    end: Math.floor(i / 50) % 2 ? "11:00" : "09:00",
  }));
  expect(validate(data, "term")).toEqual([]);
  expect(checkData(data).offerings).toHaveLength(500);
  expect(
    availableRooms(data, {
      semesterId: "term",
      day: 0,
      start: "08:00",
      end: "09:00",
      size: 30,
      type: "classroom",
    }),
  ).toHaveLength(50);
  const stats = data.rooms.map((r) => utilization(data, r.id, "term"));
  expect(stats.every((s) => s.occupied === 300)).toBe(true);
  expect(
    buildReport(
      data,
      "term",
      "Departmental Faculty Loading Summary",
    ).rows.every((r) => r[5] === 10),
  ).toBe(true);
}, 10000);
