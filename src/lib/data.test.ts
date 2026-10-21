import { describe, expect, it } from "vitest";
import {
  backup,
  checkData,
  duplicateSemester,
  readData,
  restore,
  SchedulerDB,
  writeData,
} from "./storage";
import { sampleData } from "./sample";
import { parseCSV, previewImport, templateCSV } from "./imports";
import { buildReport, reportTypes } from "./reports";
describe("backups and persistence", () => {
  it("roundtrips a full versioned backup", () =>
    expect(restore(backup(sampleData()))).toEqual(sampleData()));
  it("rejects damaged, future, and orphaned backups before replacing anything", () => {
    expect(() => restore("{")).toThrow();
    expect(() => restore('{"application":"SLSS","schemaVersion":3}')).toThrow(
      "Unsupported",
    );
    const d = sampleData();
    d.rooms = [];
    expect(() => restore(backup(d))).toThrow();
  });
  it("saves normalized IndexedDB records and reads after reopening", async () => {
    const name = `test-${crypto.randomUUID()}`;
    const database = new SchedulerDB(name);
    const d = sampleData();
    const revision = await writeData(d, "", database);
    database.close();
    const reopened = new SchedulerDB(name);
    const result = await readData(reopened);
    expect(result.data).toEqual(d);
    expect(result.revision).toBe(revision);
    await reopened.delete();
  });
  it("atomically rejects stale writes from another tab", async () => {
    const database = new SchedulerDB(`test-${crypto.randomUUID()}`);
    await writeData(sampleData(), "", database);
    await expect(writeData(sampleData(), "", database)).rejects.toThrow(
      "another tab",
    );
    await database.delete();
  });
  it("never persists invalid data", async () => {
    const database = new SchedulerDB(`test-${crypto.randomUUID()}`);
    const d = sampleData();
    d.meetings[0].end = "07:00";
    await expect(writeData(d, "", database)).rejects.toThrow();
    expect((await readData(database)).revision).toBe("");
    await database.delete();
  });
});
describe("semester copy", () => {
  it("copies offerings with fresh IDs and optional meetings", () => {
    const d = sampleData();
    const next = duplicateSemester(d, "term1", "term2", true);
    expect(next.offerings).toHaveLength(6);
    expect(next.meetings).toHaveLength(4);
    expect(next.assignments).toHaveLength(2);
    expect(next.offerings[3].id).not.toBe(d.offerings[0].id);
    expect(next.meetings[2].offeringId).toBe(next.offerings[3].id);
    expect(d.offerings).toHaveLength(3);
  });
  it("copies only offerings when requested", () => {
    const next = duplicateSemester(sampleData(), "term1", "term2", false);
    expect(next.offerings).toHaveLength(6);
    expect(next.assignments).toHaveLength(1);
  });
  it("rejects duplicate offerings, same semesters, and finalized destinations", () => {
    const d = duplicateSemester(sampleData(), "term1", "term2", false);
    expect(() => duplicateSemester(d, "term1", "term2", true)).toThrow(
      "duplicate",
    );
    expect(() => duplicateSemester(d, "term1", "term1", false)).toThrow();
    d.semesters[1].finalized = true;
    expect(() => duplicateSemester(d, "term1", "term2", false)).toThrow(
      "Reopen",
    );
  });
});
describe("reviewed import", () => {
  it("parses quoted CSV, CRLF, escaped quotes and embedded newlines", () =>
    expect(
      parseCSV(
        'name,specialization\r\n"Rivera, Alex","Data ""structures""\nComputing"\r\n',
      ),
    ).toEqual([
      { name: "Rivera, Alex", specialization: 'Data "structures"\nComputing' },
    ]));
  it("rejects malformed rows and duplicate headers", () => {
    expect(() => parseCSV("name,name\na,b")).toThrow();
    expect(() => parseCSV("name,id\na")).toThrow("cells");
    expect(() => parseCSV('name\n"broken')).toThrow("quote");
  });
  it("previews valid rows and flags errors without mutating source", () => {
    const d = sampleData();
    const result = previewImport(
      d,
      "faculty",
      [
        { name: "New faculty", maxLoad: "12", active: "true" },
        { name: "Invalid", maxLoad: "-1", active: "true" },
      ],
      { name: "name", maxLoad: "maxLoad", active: "active" },
    );
    expect(result.added).toBe(1);
    expect(result.errors[0].row).toBe(3);
    expect(d.faculty).toHaveLength(2);
    expect(result.data.faculty).toHaveLength(3);
  });
  it("detects duplicate IDs and codes", () => {
    const d = sampleData();
    const result = previewImport(
      d,
      "programs",
      [{ code: "BSCS", name: "Duplicate" }],
      { code: "code", name: "name" },
    );
    expect(result.added).toBe(0);
    expect(result.errors[0].message).toContain("Duplicate");
  });
  it("validates imported references", () => {
    const result = previewImport(
      sampleData(),
      "offerings",
      [{ semesterId: "bad", subjectId: "sub1", sectionId: "sec1" }],
      {
        semesterId: "semesterId",
        subjectId: "subjectId",
        sectionId: "sectionId",
      },
    );
    expect(result.errors).toHaveLength(1);
  });
  it("offers stable relation columns in templates", () =>
    expect(templateCSV("meetings")).toContain(
      "offeringId,component,roomId,day,start,end",
    ));
});
describe("reports", () => {
  it("generates all nine report formats", () => {
    for (const type of reportTypes) {
      const r = buildReport(sampleData(), "term1", type);
      expect(r.headers.length).toBeGreaterThan(2);
      expect(r.rows.every((row) => row.length === r.headers.length)).toBe(true);
    }
  });
  it("filters unassigned and faculty records", () => {
    expect(
      buildReport(sampleData(), "term1", "Unassigned Subject Report").rows,
    ).toHaveLength(2);
    expect(
      buildReport(sampleData(), "term1", "Faculty Weekly Schedule", "fac1")
        .rows,
    ).toHaveLength(2);
  });
  it("validates default data integrity", () =>
    expect(checkData(sampleData()).faculty).toHaveLength(2));
});

it("loads recent history by timestamp rather than UUID key order", async () => {
  const database = new SchedulerDB(`test-${crypto.randomUUID()}`),
    data = sampleData();
  data.history = [
    { id: "a", at: "2026-10-21T01:00:00.000Z", description: "Older" },
    { id: "z", at: "2026-10-21T02:00:00.000Z", description: "Newer" },
  ];
  await writeData(data, "", database);
  expect(
    (await readData(database)).data.history.map((h) => h.description),
  ).toEqual(["Newer", "Older"]);
  await database.delete();
});
it("rejects non-boolean import values rather than silently coercing them", () => {
  const p = previewImport(
    sampleData(),
    "faculty",
    [{ name: "Invalid", maxLoad: "18", active: "yes" }],
    { name: "name", maxLoad: "maxLoad", active: "active" },
  );
  expect(p.added).toBe(0);
  expect(p.errors[0].message).toContain("true or false");
});
