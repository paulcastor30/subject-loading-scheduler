import { describe, it, expect } from "vitest";
import Dexie from "dexie";
import { sampleData } from "../../tests/fixtures/academicData";
import {
  enableGroups,
  groupCredits,
  loadRows,
  otherLoad,
  preparations,
  splitLab,
  teachingLoad,
} from "./loading";
import { validate, workload } from "./engine";
import {
  backup,
  checkData,
  duplicateSemester,
  readData,
  restore,
  SchedulerDB,
} from "./storage";
import { entities } from "./model";
function grouped() {
  const d = enableGroups(sampleData(), "off1");
  d.meetings = [];
  return d;
}
describe("group loading and validation", () => {
  it("preserves a legacy assignment, meetings and total when enabling groups", () => {
    const d = sampleData(),
      g = enableGroups(d, "off1");
    expect(g.assignments).toHaveLength(2);
    expect(g.teachingGroups).toHaveLength(2);
    expect(g.meetings.every((m) => m.groupId)).toBe(true);
    expect(workload(g, "fac1", "term1")).toBe(workload(d, "fac1", "term1"));
    expect(checkData(g)).toEqual(g);
    expect(d.teachingGroups).toEqual([]);
  });
  it("counts each group once despite repeated weekly meetings", () => {
    const d = grouped(),
      g = d.teachingGroups.find((g) => g.component === "lecture")!;
    d.meetings = [
      {
        id: "a",
        offeringId: "off1",
        groupId: g.id,
        component: "lecture",
        roomId: "room1",
        day: 0,
        start: "08:00",
        end: "09:00",
      },
      {
        id: "b",
        offeringId: "off1",
        groupId: g.id,
        component: "lecture",
        roomId: "room1",
        day: 1,
        start: "08:00",
        end: "09:00",
      },
    ];
    expect(teachingLoad(d, "fac1", "term1")).toBe(5);
    const rows = loadRows(d, "term1", "fac1");
    expect(rows.filter((r) => r[1] === "Lecture").map((r) => r[5])).toEqual([
      2,
      "",
    ]);
  });
  it("splits lab enrollment and counts repeated contact hours per group", () => {
    const d = grouped(),
      lab = d.teachingGroups.find((g) => g.component === "lab")!,
      next = splitLab(d, lab.id);
    expect(
      next.teachingGroups
        .filter((g) => g.component === "lab")
        .map((g) => g.students),
    ).toEqual([15, 15]);
    expect(teachingLoad(next, "fac1", "term1")).toBe(8);
    expect(preparations(next, "fac1", "term1")).toBe(1);
    expect(checkData(next)).toEqual(next);
  });
  it("uses category factors and explicit sourced overrides including zero", () => {
    const d = grouped(),
      g = d.teachingGroups.find((g) => g.component === "lab")!;
    d.loadCategories = [
      {
        id: "cat",
        name: "Reported lab category",
        component: "lab",
        factor: 0.85,
      },
    ];
    g.loadCategoryId = "cat";
    expect(groupCredits(d, g)).toBe(2.55);
    g.creditedLoad = 0;
    g.creditReason = "Recorded supervision adjustment";
    expect(groupCredits(d, g)).toBe(0);
    g.creditReason = "";
    expect(() => checkData(d)).toThrow("reason or source");
  });
  it("adds other duty credits to total without making class meetings", () => {
    const d = grouped();
    d.loadActivities.push({
      id: "duty",
      name: "Advising",
      kind: "advising",
      credits: 2,
      semesterId: "term1",
      facultyId: "fac1",
      reference: "Example order",
    });
    expect(teachingLoad(d, "fac1", "term1")).toBe(5);
    expect(otherLoad(d, "fac1", "term1")).toBe(2);
    expect(workload(d, "fac1", "term1")).toBe(7);
    expect(d.meetings).toHaveLength(0);
  });
  it("enforces group capacity rather than the entire block size", () => {
    const base = grouped(),
      d = splitLab(
        base,
        base.teachingGroups.find((g) => g.component === "lab")!.id,
      ),
      lab = d.teachingGroups.find((g) => g.component === "lab")!;
    d.rooms[1].capacity = 20;
    d.meetings = [
      {
        id: "capacity",
        offeringId: "off1",
        groupId: lab.id,
        component: "lab",
        roomId: "room2",
        day: 0,
        start: "08:00",
        end: "11:00",
      },
    ];
    expect(validate(d).some((i) => i.code === "capacity")).toBe(false);
    d.rooms[1].capacity = 10;
    expect(validate(d).some((i) => i.code === "capacity")).toBe(true);
  });
  it("allows separate lab groups to run in parallel with different faculty and rooms", () => {
    const base = grouped(),
      d = splitLab(
        base,
        base.teachingGroups.find((g) => g.component === "lab")!.id,
      ),
      labs = d.teachingGroups.filter((g) => g.component === "lab");
    d.assignments.find((a) => a.groupId === labs[1].id)!.facultyId = "fac2";
    d.rooms.push({ ...d.rooms[1], id: "lab2", code: "LAB 2", capacity: 20 });
    d.rooms[1].capacity = 20;
    d.meetings = labs.map((g, i) => ({
      id: `m${i}`,
      offeringId: "off1",
      groupId: g.id,
      component: "lab",
      roomId: i ? "lab2" : "room2",
      day: 0,
      start: "08:00",
      end: "11:00",
    }));
    expect(validate(d).filter((i) => i.severity === "error")).toEqual([]);
    d.assignments.find((a) => a.groupId === labs[1].id)!.facultyId = "fac1";
    expect(validate(d).some((i) => i.code === "faculty-overlap")).toBe(true);
  });
  it("still detects lecture-versus-lab and cross-offering student overlaps", () => {
    const d = grouped(),
      lec = d.teachingGroups.find((g) => g.component === "lecture")!,
      lab = d.teachingGroups.find((g) => g.component === "lab")!;
    d.assignments.find((a) => a.groupId === lab.id)!.facultyId = "fac2";
    d.meetings = [
      {
        id: "m1",
        offeringId: "off1",
        groupId: lec.id,
        component: "lecture",
        roomId: "room1",
        day: 0,
        start: "08:00",
        end: "10:00",
      },
      {
        id: "m2",
        offeringId: "off1",
        groupId: lab.id,
        component: "lab",
        roomId: "room2",
        day: 0,
        start: "08:00",
        end: "11:00",
      },
    ];
    expect(validate(d).some((i) => i.code === "section-overlap")).toBe(true);
  });
  it("rejects cross-offering group references and duplicate group assignments", () => {
    const d = grouped();
    d.assignments[0].offeringId = "off2";
    expect(() => checkData(d)).toThrow("does not match");
    const next = grouped();
    next.assignments.push({ ...next.assignments[0], id: "dup" });
    expect(() => checkData(next)).toThrow("only one");
  });
  it("copies group IDs consistently and keeps enrollment on an offerings-only copy", () => {
    const d = grouped(),
      next = duplicateSemester(d, "term1", "term2", true),
      oldIds = new Set(d.teachingGroups.map((g) => g.id)),
      newGroups = next.teachingGroups.filter((g) => !oldIds.has(g.id));
    expect(newGroups).toHaveLength(2);
    expect(
      next.assignments.filter((a) => newGroups.some((g) => g.id === a.groupId)),
    ).toHaveLength(2);
    expect(checkData(next)).toEqual(next);
    const plan = duplicateSemester(d, "term1", "term2", false);
    expect(plan.teachingGroups).toHaveLength(4);
    expect(plan.assignments).toHaveLength(2);
  });
  it("uses a destination-semester overload policy without changing other terms", () => {
    const d = grouped();
    d.faculty[0].maxLoad = 4;
    d.semesters[0].overloadPolicy = "warning";
    expect(
      validate(d, "term1").find((i) => i.code === "load-limit")?.severity,
    ).toBe("warning");
    expect(d.schedulingRules[0].overload).toBe("error");
  });
});
describe("safe version upgrades", () => {
  it("restores version 1 backups with empty new tables", () => {
    const legacy = sampleData() as unknown as Record<string, unknown>;
    delete legacy.teachingGroups;
    delete legacy.loadCategories;
    delete legacy.loadActivities;
    const restored = restore(
      JSON.stringify({ application: "SLSS", schemaVersion: 1, data: legacy }),
    );
    expect(restored.teachingGroups).toEqual([]);
    expect(restored.meetings).toHaveLength(2);
    expect(restore(backup(restored))).toEqual(restored);
  });
  it("upgrades IndexedDB version 1 without rewriting old assignments or meetings", async () => {
    const name = `migration-${crypto.randomUUID()}`,
      old = new Dexie(name);
    const original = sampleData();
    const legacyKeys = entities.filter(
      (e) =>
        !["teachingGroups", "loadCategories", "loadActivities"].includes(e),
    );
    old.version(1).stores({
      ...Object.fromEntries(legacyKeys.map((k) => [k, "id"])),
      history: "id,at",
      meta: "key",
    });
    await old.open();
    for (const key of legacyKeys) await old.table(key).bulkPut(original[key]);
    await old.table("meta").put({ key: "revision", value: "legacy" });
    old.close();
    const updated = new SchedulerDB(name);
    const result = await readData(updated);
    expect(result.data.meetings).toEqual(original.meetings);
    expect(result.data.assignments).toEqual(original.assignments);
    expect(result.data.teachingGroups).toEqual([]);
    expect(result.revision).toBe("legacy");
    await updated.delete();
  });
});

it("blocks teaching during semester-specific leave without blocking a later term", () => {
  const d = grouped();
  d.loadActivities.push({
    id: "leave",
    semesterId: "term1",
    facultyId: "fac1",
    name: "Study leave",
    kind: "leave",
    credits: 0,
    reference: "Example status",
  });
  expect(validate(d, "term1").some((i) => i.code === "faculty-leave")).toBe(
    true,
  );
  d.loadActivities[0].semesterId = "term2";
  expect(validate(d, "term1").some((i) => i.code === "faculty-leave")).toBe(
    false,
  );
});

it("bulk assignment fills missing groups without replacing existing instructors", async () => {
  const { assignOfferingFaculty } = await import("./loading");
  const d = grouped();
  const lab = d.teachingGroups.find((g) => g.component === "lab")!;
  d.assignments = d.assignments.filter((a) => a.groupId !== lab.id);
  const next = assignOfferingFaculty(d, ["off1"], "fac2", true);
  expect(next.assignments.find((a) => a.groupId === lab.id)?.facultyId).toBe(
    "fac2",
  );
  expect(next.assignments.find((a) => a.groupId !== lab.id)?.facultyId).toBe(
    "fac1",
  );
  expect(d.assignments).toHaveLength(1);
});
it("filters a faculty schedule by group instead of including other instructors in the offering", async () => {
  const { buildReport } = await import("./reports");
  const d = enableGroups(sampleData(), "off1");
  const lab = d.teachingGroups.find((g) => g.component === "lab")!;
  d.assignments.find((a) => a.groupId === lab.id)!.facultyId = "fac2";
  expect(
    buildReport(d, "term1", "Faculty Weekly Schedule", "fac1").rows,
  ).toHaveLength(1);
  expect(
    buildReport(d, "term1", "Faculty Weekly Schedule", "fac2").rows,
  ).toHaveLength(1);
});
