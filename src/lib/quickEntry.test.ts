import { expect, it } from "vitest";
import { sampleData } from "../../tests/fixtures/academicData";
import { checkData } from "./storage";
import {
  inspectQuickEntry,
  parseQuickPaste,
  type QuickRow,
} from "./quickEntry";
const row = (id: string, values: Record<string, string>): QuickRow => ({
  id,
  values,
});
const defaults = {
  curriculumId: "curr1",
  courseUnits: "3",
  lectureHours: "3",
  labHours: "0",
};

it("parses Excel headers, quoted multiline cells and escaped quotes", () => {
  const parsed = parseQuickPaste(
    "subjects",
    'Code\tTitle\tUnits\tLecture hours\tLab hours\r\nCS 301\t"Algorithms\nwith applications"\t3\t2\t3\r\nCS 302\t"Networks and ""Security"""\t3\t3\t0\r\n',
  );
  expect(parsed.map((r) => r.values)).toEqual([
    {
      code: "CS 301",
      name: "Algorithms\nwith applications",
      courseUnits: "3",
      lectureHours: "2",
      labHours: "3",
    },
    {
      code: "CS 302",
      name: 'Networks and "Security"',
      courseUnits: "3",
      lectureHours: "3",
      labHours: "0",
    },
  ]);
  expect(new Set(parsed.map((r) => r.id)).size).toBe(2);
});

it("accepts a faculty-name list without splitting commas in names", () => {
  expect(
    parseQuickPaste("faculty", "Cruz, Sam\r\nReyes, Ada\n\n").map(
      (r) => r.values,
    ),
  ).toEqual([{ name: "Cruz, Sam" }, { name: "Reyes, Ada" }]);
});

it("rejects malformed quotes, excess columns and paste size limits", () => {
  expect(() => parseQuickPaste("faculty", '"Unfinished')).toThrow(/quote/i);
  expect(() => parseQuickPaste("faculty", '"Name"junk')).toThrow(/quote/i);
  expect(() => parseQuickPaste("faculty", "a\tb\tc\td\te")).toThrow(/columns/i);
  expect(() =>
    parseQuickPaste(
      "faculty",
      Array.from({ length: 501 }, (_, i) => `Person ${i}`).join("\n"),
    ),
  ).toThrow(/500/);
  expect(() => parseQuickPaste("faculty", "a".repeat(1_000_001))).toThrow(
    /1,000,000/,
  );
});

it("uses shared defaults, keeps explicit zero hours and ignores completely blank rows", () => {
  const data = sampleData();
  const result = inspectQuickEntry(
    data,
    "subjects",
    [
      row("new1", {
        code: " CS 301 ",
        name: "Algorithms",
        lectureHours: "0",
        labHours: "3",
      }),
      row("blank", {}),
      row("new2", { code: "CS 302", name: "Networks" }),
    ],
    defaults,
  );
  expect(result.valid).toBe(true);
  expect(result.count).toBe(2);
  expect(result.records[0]).toMatchObject({
    id: "new1",
    code: "CS 301",
    curriculumId: "curr1",
    courseUnits: 3,
    lectureHours: 0,
    labHours: 3,
  });
  expect(result.records[1]).toMatchObject({ lectureHours: 3, labHours: 0 });
  expect(
    checkData({ ...data, subjects: [...data.subjects, ...result.records] })
      .subjects,
  ).toHaveLength(5);
});

it("does not coerce a missing required numeric value to zero", () => {
  const result = inspectQuickEntry(
    sampleData(),
    "subjects",
    [row("new", { code: "CS301", name: "Algorithms" })],
    { ...defaults, courseUnits: "" },
  );
  expect(result.valid).toBe(false);
  expect(result.errors.new.courseUnits).toMatch(/enter/i);
});

it("flags all duplicate subject codes in a curriculum, while permitting another curriculum", () => {
  const data = sampleData();
  const result = inspectQuickEntry(
    data,
    "subjects",
    [
      row("a", { code: " cs 101 ", name: "Existing" }),
      row("b", { code: "CS301", name: "One" }),
      row("c", { code: " cs301 ", name: "Two" }),
    ],
    defaults,
  );
  expect(result.valid).toBe(false);
  for (const id of ["a", "b", "c"])
    expect(result.errors[id].code).toMatch(/already|duplicate/i);
  data.curricula.push({ id: "curr2", name: "Revised", programId: "program1" });
  expect(
    inspectQuickEntry(
      data,
      "subjects",
      [row("a", { code: "CS 101", name: "New version" })],
      { ...defaults, curriculumId: "curr2" },
    ).valid,
  ).toBe(true);
});

it("requires a valid curriculum and identifies reused draft identities", () => {
  const data = sampleData();
  expect(
    inspectQuickEntry(
      data,
      "subjects",
      [row("a", { code: "NEW", name: "Title" })],
      { ...defaults, curriculumId: "gone" },
    ).errors.a.curriculumId,
  ).toBeTruthy();
  expect(
    inspectQuickEntry(
      data,
      "faculty",
      [row("fac1", { name: "Different name" })],
      { maxLoad: "18" },
    ).errors.fac1.id,
  ).toBeTruthy();
});

it("blocks duplicate faculty names and room codes without modifying existing records", () => {
  const data = sampleData(),
    before = structuredClone(data);
  expect(
    inspectQuickEntry(
      data,
      "faculty",
      [row("a", { name: " alex rivera (sample) " })],
      { maxLoad: "18" },
    ).errors.a.name,
  ).toMatch(/already/i);
  const rooms = inspectQuickEntry(
    data,
    "rooms",
    [row("a", { code: " cl 201 ", name: "Other room" })],
    { building: "Main", type: "classroom", capacity: "30" },
  );
  expect(rooms.errors.a.code).toMatch(/already/i);
  expect(data).toEqual(before);
});

it("reports invalid room capacity and room type beside their fields", () => {
  const result = inspectQuickEntry(
    sampleData(),
    "rooms",
    [
      row("a", {
        code: "NEW",
        name: "New room",
        capacity: "0",
        type: "auditorium",
      }),
    ],
    { building: "Main", type: "classroom", capacity: "30" },
  );
  expect(result.errors.a.capacity).toBeTruthy();
  expect(result.errors.a.type).toBeTruthy();
});

it("accepts human-readable room type capitalization from pasted rows", () => {
  const parsed = parseQuickPaste(
    "rooms",
    "Code\tName\tType\nLAB NEW\tNew laboratory\tLaboratory",
  );
  const inspected = inspectQuickEntry(sampleData(), "rooms", parsed, {
    building: "Main",
    capacity: "40",
    type: "classroom",
  });
  expect(inspected.valid).toBe(true);
  expect(inspected.records[0]).toMatchObject({
    type: "laboratory",
    capacity: 40,
  });
});

it("enforces the batch size even for manually supplied rows", () => {
  const result = inspectQuickEntry(
    sampleData(),
    "faculty",
    Array.from({ length: 501 }, (_, i) =>
      row(String(i), { name: `Person ${i}` }),
    ),
    { maxLoad: "18" },
  );
  expect(result.valid).toBe(false);
  expect(result.error).toMatch(/500/);
});
