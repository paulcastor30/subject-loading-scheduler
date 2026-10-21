import { describe, expect, it } from "vitest";
import { emptyData, integrity } from "./model";
import { checkData } from "./storage";
import { enableGroups, teachingLoad } from "./loading";
import { applyRecordChange, planRecordChange } from "./recordChanges";
import { checkActiveResourceChanges, validate } from "./engine";
import { sampleData } from "../../tests/fixtures/academicData";

function populated() {
  const d = enableGroups(sampleData(), "off1");
  d.loadActivities.push({
    id: "duty1",
    semesterId: "term1",
    facultyId: "fac1",
    name: "Research",
    kind: "research",
    credits: 1,
    reference: "Order",
  });
  return d;
}
describe("reviewed record changes", () => {
  it("removes an entire semester atomically while preserving shared catalogs and other terms", () => {
    const d = populated();
    d.offerings.push({
      ...d.offerings[0],
      id: "other-off",
      semesterId: "term2",
    });
    const plan = planRecordChange(d, {
      action: "delete",
      entity: "semesters",
      ids: ["term1"],
    });
    expect(plan.errors).toEqual([]);
    expect(
      plan.removed.filter((r) => r.entity === "semesters").map((r) => r.id),
    ).toEqual(["term1"]);
    expect(
      plan.removed.some(
        (r) => r.entity === "meetings" && r.name.includes("Monday 08:00–10:00"),
      ),
    ).toBe(true);
    const next = applyRecordChange(d, plan);
    expect(next.offerings.map((o) => o.id)).toEqual(["other-off"]);
    expect(next.loadActivities).toHaveLength(0);
    expect(next.teachingGroups).toHaveLength(0);
    for (const entity of [
      "faculty",
      "subjects",
      "rooms",
      "sections",
      "programs",
      "curricula",
    ] as const)
      expect(next[entity]).toEqual(d[entity]);
    expect(integrity(next)).toEqual([]);
    expect(d.semesters).toHaveLength(2);
    expect(d.meetings).toHaveLength(2);
  });
  it("deletes a year transitively and includes finalized semesters in the explicit preview", () => {
    const d = populated();
    d.semesters[0].finalized = true;
    const plan = planRecordChange(d, {
      action: "delete",
      entity: "academicYears",
      ids: ["ay1"],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.finalizedDeleted).toEqual(["2026–2027 · First semester"]);
    expect(applyRecordChange(d, plan).semesters).toHaveLength(0);
    expect(plan.next.faculty).toEqual(d.faculty);
  });
  it("deduplicates dependents when deleting multiple subjects and preserves unrelated work", () => {
    const d = populated();
    const plan = planRecordChange(d, {
      action: "delete",
      entity: "subjects",
      ids: ["sub1", "sub2"],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.next.offerings.map((o) => o.id)).toEqual(["off3"]);
    const keys = plan.removed.map((r) => `${r.entity}:${r.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(plan.next.loadActivities).toEqual(d.loadActivities);
  });
  it("deletes room bookings and availability without deleting faculty assignments or classes", () => {
    const d = populated();
    const plan = planRecordChange(d, {
      action: "delete",
      entity: "rooms",
      ids: ["room2"],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.next.meetings.every((m) => m.roomId !== "room2")).toBe(true);
    expect(plan.next.roomAvailability).toHaveLength(0);
    expect(plan.next.assignments).toEqual(d.assignments);
    expect(plan.next.offerings).toEqual(d.offerings);
  });
  it("deletes faculty dependencies but preserves room bookings for reassignment", () => {
    const d = populated();
    const plan = planRecordChange(d, {
      action: "delete",
      entity: "faculty",
      ids: ["fac1"],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.next.assignments).toHaveLength(0);
    expect(plan.next.loadActivities).toHaveLength(0);
    expect(plan.next.meetings).toEqual(d.meetings);
    expect(plan.next.rooms).toEqual(d.rooms);
  });
  it("shows an actionable blocker before partial deletion affects a finalized semester", () => {
    const d = populated();
    d.semesters[0].finalized = true;
    const plan = planRecordChange(d, {
      action: "delete",
      entity: "subjects",
      ids: ["sub1"],
    });
    expect(plan.errors.join(" ")).toContain(
      "Reopen 2026–2027 · First semester",
    );
    expect(() => applyRecordChange(d, plan)).toThrow("Reopen");
  });
  it("preserves credits when removing an optional load category rather than erasing teaching groups", () => {
    const d = populated();
    d.loadCategories.push({
      id: "cat",
      name: "Lab credit",
      component: "lab",
      factor: 0.85,
    });
    d.teachingGroups.find((g) => g.component === "lab")!.loadCategoryId = "cat";
    const originalLoad = teachingLoad(d, "fac1", "term1");
    const plan = planRecordChange(d, {
      action: "delete",
      entity: "loadCategories",
      ids: ["cat"],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.next.teachingGroups).toHaveLength(2);
    expect(plan.changed).toHaveLength(1);
    expect(teachingLoad(plan.next, "fac1", "term1")).toBe(originalLoad);
    expect(
      plan.next.teachingGroups.find((g) => g.component === "lab"),
    ).toMatchObject({
      creditedLoad: 2.55,
      creditReason: expect.stringContaining("Lab credit"),
    });
    expect(plan.next.meetings).toEqual(d.meetings);
  });
  it("rejects stale previews and missing records without changing original data", () => {
    const d = populated(),
      plan = planRecordChange(d, {
        action: "delete",
        entity: "semesters",
        ids: ["term1"],
      });
    expect(() => applyRecordChange(structuredClone(d), plan)).toThrow(
      "Records changed",
    );
    const missing = planRecordChange(d, {
      action: "delete",
      entity: "faculty",
      ids: ["missing"],
    });
    expect(() => applyRecordChange(d, missing)).toThrow("no longer exist");
  });
  it("resets only the chosen required rule and prevents deleting rules", () => {
    const d = populated();
    d.workloadRules[0].labFactor = 0.5;
    const plan = planRecordChange(d, {
      action: "reset",
      entity: "workloadRules",
      ids: [d.workloadRules[0].id],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.next.workloadRules[0].labFactor).toBe(1);
    expect(plan.next.schedulingRules).toEqual(d.schedulingRules);
    expect(plan.next.meetings).toEqual(d.meetings);
    expect(
      planRecordChange(d, {
        action: "delete",
        entity: "workloadRules",
        ids: [d.workloadRules[0].id],
      }).errors.join(),
    ).toContain("Reset to defaults");
  });
  it("blocks a rule reset in preview if it would invalidate existing meetings", () => {
    const d = populated();
    d.schedulingRules[0].end = "22:00";
    d.meetings[0].start = "20:00";
    d.meetings[0].end = "21:00";
    checkData(d);
    expect(
      planRecordChange(d, {
        action: "reset",
        entity: "schedulingRules",
        ids: [d.schedulingRules[0].id],
      }).errors.join(),
    ).toContain("valid time");
  });
  it("deactivates and reactivates resources without deleting historical records", () => {
    const d = populated();
    d.semesters[0].finalized = true;
    const facultyPlan = planRecordChange(d, {
      action: "deactivate",
      entity: "faculty",
      ids: ["fac1"],
    });
    expect(facultyPlan.errors).toEqual([]);
    expect(facultyPlan.next.assignments).toEqual(d.assignments);
    expect(facultyPlan.next.meetings).toEqual(d.meetings);
    expect(facultyPlan.next.loadActivities).toEqual(d.loadActivities);
    checkActiveResourceChanges(d, facultyPlan.next);
    expect(
      validate(facultyPlan.next).some(
        (i) => i.code === "inactive-faculty" && i.severity === "warning",
      ),
    ).toBe(true);
    const roomPlan = planRecordChange(facultyPlan.next, {
      action: "deactivate",
      entity: "rooms",
      ids: ["room1"],
    });
    expect(roomPlan.errors).toEqual([]);
    expect(roomPlan.next.meetings).toEqual(d.meetings);
    expect(
      planRecordChange(roomPlan.next, {
        action: "activate",
        entity: "rooms",
        ids: ["room1"],
      }).next.rooms.find((r) => r.id === "room1")?.active,
    ).toBe(true);
  });
  it("blocks new assignments and new or changed meetings using inactive resources", () => {
    const d = populated();
    d.faculty[0].active = false;
    d.rooms[0].active = false;
    const changed = structuredClone(d);
    changed.meetings[0].start = "08:30";
    expect(() => checkActiveResourceChanges(d, changed)).toThrow("active room");
    const newAssignment = structuredClone(d);
    newAssignment.assignments.push({
      id: "new",
      offeringId: "off2",
      facultyId: "fac1",
    });
    expect(() => checkActiveResourceChanges(d, newAssignment)).toThrow(
      "active faculty",
    );
    const newMeeting = structuredClone(d);
    newMeeting.rooms[0].active = true;
    newMeeting.meetings[0].start = "08:30";
    expect(() => checkActiveResourceChanges(d, newMeeting)).toThrow(
      "Activate or reassign",
    );
    const moved = structuredClone(d);
    moved.offerings[0].semesterId = "term2";
    expect(() => checkActiveResourceChanges(d, moved)).toThrow(
      "active faculty",
    );
    expect(() =>
      checkActiveResourceChanges(d, structuredClone(d)),
    ).not.toThrow();
  });
  it("validates default rule resets in a fresh operational workspace", () => {
    const d = emptyData();
    for (const entity of ["workloadRules", "schedulingRules"] as const)
      expect(
        planRecordChange(d, { action: "reset", entity, ids: [d[entity][0].id] })
          .errors,
      ).toEqual([]);
  });
});
