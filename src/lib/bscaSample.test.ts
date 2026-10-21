import { expect, it } from "vitest";
import {
  addBscaSample,
  bscaCourses,
  bscaElectives,
  bscaSampleData,
  BSCA_CURRICULUM_ID,
} from "./bscaSample";
import { emptyData } from "./model";
import { backup, checkData, restore } from "./storage";
import { sampleData } from "./sample";
it("transcribes all eight semester lists and eight suggested electives", () => {
  expect(bscaCourses).toHaveLength(51);
  expect(bscaElectives).toHaveLength(8);
  expect(
    [1, 2, 3, 4].map((y) =>
      [1, 2].map(
        (s) =>
          bscaCourses.filter((c) => c.yearLevel === y && c.semester === s)
            .length,
      ),
    ),
  ).toEqual([
    [8, 8],
    [7, 7],
    [7, 7],
    [6, 1],
  ]);
  expect(bscaCourses.reduce((total, c) => total + c.units, 0)).toBe(159);
  expect(bscaCourses.filter((c) => c.code.startsWith("Elective"))).toHaveLength(
    4,
  );
});
it("preserves separate units and source hours, including exceptional rows", () => {
  const data = bscaSampleData();
  expect(data.subjects.find((c) => c.code === "BCA141")).toMatchObject({
    courseUnits: 4,
    lectureHours: 3,
    labHours: 3,
  });
  expect(data.subjects.find((c) => c.code === "NST001")).toMatchObject({
    courseUnits: 3,
    lectureHours: 3,
    labHours: 0,
  });
  expect(data.subjects.find((c) => c.code === "BCA197")).toMatchObject({
    courseUnits: 6,
    lectureHours: 0,
    labHours: 40,
  });
  expect(bscaCourses.find((c) => c.code === "NST001")?.unitNotation).toBe(
    "(3)",
  );
});
it("creates a valid unassigned plan without invented faculty, rooms or schedules", () => {
  const data = checkData(bscaSampleData());
  expect(data.subjects).toHaveLength(59);
  expect(data.offerings).toHaveLength(51);
  expect(data.sections).toHaveLength(4);
  expect(data.semesters).toHaveLength(2);
  expect(data.assignments).toEqual([]);
  expect(data.meetings).toEqual([]);
  expect(data.faculty).toEqual([]);
  expect(data.rooms).toEqual([]);
  for (const c of bscaElectives)
    expect(
      data.offerings.some(
        (o) => o.subjectId === data.subjects.find((s) => s.code === c.code)!.id,
      ),
    ).toBe(false);
  expect(restore(backup(data))).toEqual(data);
});
it("adds alongside existing records and preserves custom rules and history", () => {
  const current = sampleData();
  current.workloadRules[0].labFactor = 0.5;
  const before = structuredClone(current),
    next = addBscaSample(current);
  expect(current).toEqual(before);
  expect(next.subjects).toHaveLength(62);
  expect(next.offerings).toHaveLength(54);
  expect(next.meetings).toEqual(current.meetings);
  expect(next.workloadRules).toEqual(current.workloadRules);
  expect(next.schedulingRules).toEqual(current.schedulingRules);
  expect(next.history).toEqual(current.history);
  expect(() => addBscaSample(next)).toThrow("already been added");
});
it("reuses matching BSCA program and compatible catalog records", () => {
  const existing = emptyData();
  existing.programs = [
    { id: "existing-program", code: "BSCA", name: "Existing BSCA" },
  ];
  existing.curricula = [
    {
      id: "existing-curriculum",
      programId: "existing-program",
      name: "Existing curriculum",
    },
  ];
  existing.subjects = [
    {
      id: "existing-gec",
      code: "GEC101",
      name: "Understanding The Self",
      curriculumId: "existing-curriculum",
      courseUnits: 3,
      lectureHours: 3,
      labHours: 0,
      equipment: "",
    },
  ];
  const next = addBscaSample(existing);
  expect(next.programs).toHaveLength(1);
  expect(next.subjects).toHaveLength(59);
  expect(
    next.curricula.find((c) => c.id === BSCA_CURRICULUM_ID)?.programId,
  ).toBe("existing-program");
  expect(next.offerings.some((o) => o.subjectId === "existing-gec")).toBe(true);
  expect(checkData(next)).toEqual(next);
});
it("rejects mismatched codes or sample IDs without changing any existing records", () => {
  const current = sampleData();
  current.subjects[0].code = "GEC101";
  const before = structuredClone(current);
  expect(() => addBscaSample(current)).toThrow("different curriculum data");
  expect(current).toEqual(before);
  const other = emptyData();
  other.academicYears = [
    { id: "bsca-2018-sample-year", name: "Existing year" },
  ];
  expect(() => addBscaSample(other)).toThrow("sample ID");
});
