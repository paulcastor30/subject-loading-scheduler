import { describe, expect, it } from "vitest";
import {
  availableRooms,
  overlaps,
  suggestions,
  utilization,
  validate,
  workload,
} from "./engine";
import { sampleData } from "./sample";
import { checkData } from "./storage";
function collision() {
  const d = sampleData();
  d.assignments.push({ id: "a2", offeringId: "off2", facultyId: "fac1" });
  d.meetings.push({
    id: "m3",
    offeringId: "off2",
    component: "lecture",
    roomId: "room1",
    day: 0,
    start: "09:00",
    end: "11:00",
  });
  return d;
}
describe("central scheduling engine", () => {
  it("accepts the sample with no blocking conflicts", () =>
    expect(
      validate(sampleData()).filter((i) => i.severity === "error"),
    ).toEqual([]));
  it("finds faculty and room overlaps", () => {
    const issues = validate(collision());
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["faculty-overlap", "room-overlap"]),
    );
  });
  it("finds student section overlaps even with different rooms and faculty", () => {
    const d = sampleData();
    d.assignments.push({ id: "a3", offeringId: "off3", facultyId: "fac2" });
    d.meetings.push({
      id: "m3",
      offeringId: "off3",
      component: "lecture",
      roomId: "room3",
      day: 0,
      start: "09:00",
      end: "11:00",
    });
    expect(validate(d).some((i) => i.code === "section-overlap")).toBe(true);
  });
  it("allows adjacent intervals", () => {
    const d = collision();
    d.meetings[2].start = "10:00";
    expect(validate(d).filter((i) => i.code.endsWith("overlap"))).toEqual([]);
    expect(
      overlaps(
        { start: "08:00", end: "09:00" },
        { start: "09:00", end: "10:00" },
      ),
    ).toBe(false);
  });
  it("handles containment and identical intervals", () => {
    expect(
      overlaps(
        { start: "08:00", end: "12:00" },
        { start: "09:00", end: "10:00" },
      ),
    ).toBe(true);
    expect(
      overlaps(
        { start: "09:00", end: "10:00" },
        { start: "09:00", end: "10:00" },
      ),
    ).toBe(true);
  });
  it("isolates academic semesters", () => {
    const d = collision();
    d.offerings.find((o) => o.id === "off2")!.semesterId = "term2";
    expect(validate(d).filter((i) => i.code.endsWith("overlap"))).toEqual([]);
  });
  it("supports multiple weekly lecture and lab meetings per offering", () => {
    const d = sampleData();
    d.meetings[0].end = "09:00";
    d.meetings.push({ ...d.meetings[0], id: "m4", day: 1 });
    expect(
      validate(d).filter(
        (i) => i.code === "contact-hours" && i.offeringId === "off1",
      ),
    ).toEqual([]);
  });
  it("rejects insufficient room capacity", () => {
    const d = sampleData();
    d.rooms[0].capacity = 20;
    expect(validate(d).some((i) => i.code === "capacity")).toBe(true);
  });
  it("checks room type and equipment", () => {
    const d = sampleData();
    d.meetings[1].roomId = "room1";
    d.subjects[0].equipment = "Microscope";
    expect(validate(d).map((i) => i.code)).toEqual(
      expect.arrayContaining(["room-type", "equipment"]),
    );
  });
  it("checks blocked room periods", () => {
    const d = sampleData();
    d.roomAvailability.push({
      id: "b2",
      roomId: "room1",
      day: 0,
      start: "09:00",
      end: "10:00",
      kind: "blocked",
      reason: "Maintenance",
    });
    expect(validate(d).some((i) => i.code === "room-availability")).toBe(true);
  });
  it("enforces available room windows and excludes other days", () => {
    const d = sampleData();
    d.roomAvailability.push({
      id: "b2",
      roomId: "room1",
      day: 1,
      start: "08:00",
      end: "18:00",
      kind: "available",
      reason: "",
    });
    expect(validate(d).some((i) => i.code === "room-availability")).toBe(true);
  });
  it("merges adjacent faculty availability windows", () => {
    const d = sampleData();
    d.facultyAvailability = [
      { id: "f1", facultyId: "fac1", day: 0, start: "08:00", end: "09:00" },
      { id: "f2", facultyId: "fac1", day: 0, start: "09:00", end: "10:00" },
      { id: "f3", facultyId: "fac1", day: 2, start: "08:00", end: "11:00" },
    ];
    expect(validate(d).some((i) => i.code === "faculty-availability")).toBe(
      false,
    );
    d.facultyAvailability[1].start = "09:30";
    expect(validate(d).some((i) => i.code === "faculty-availability")).toBe(
      true,
    );
  });
  it("keeps workload factors independent from course units and scheduled hours", () => {
    const d = sampleData();
    d.workloadRules[0].labFactor = 0.75;
    expect(workload(d, "fac1", "term1")).toBe(4.25);
    d.subjects[0].courseUnits = 20;
    d.meetings = [];
    expect(workload(d, "fac1", "term1")).toBe(4.25);
  });
  it("supports blocking or advisory load limits", () => {
    const d = sampleData();
    d.faculty[0].maxLoad = 4;
    expect(validate(d).find((i) => i.code === "load-limit")?.severity).toBe(
      "error",
    );
    d.schedulingRules[0].overload = "warning";
    expect(validate(d).find((i) => i.code === "load-limit")?.severity).toBe(
      "warning",
    );
  });
  it("rejects backwards meetings and disabled days", () => {
    const d = sampleData();
    d.meetings[0].end = "07:00";
    expect(validate(d).some((i) => i.code === "invalid-time")).toBe(true);
    d.meetings[0].day = 6;
    expect(() => checkData(d)).toThrow();
  });
  it("rejects duplicate assignments and missing relationships", () => {
    const d = sampleData();
    d.assignments.push({ ...d.assignments[0], id: "a2" });
    expect(() => checkData(d)).toThrow("only one");
    d.assignments.pop();
    d.meetings[0].roomId = "missing";
    expect(() => checkData(d)).toThrow("reference");
  });
  it("rejects mismatched curriculum and program", () => {
    const d = sampleData();
    d.programs.push({ id: "p2", name: "Other", code: "OTH" });
    d.sections[0].programId = "p2";
    expect(() => checkData(d)).toThrow("same program");
  });
  it("sorts available rooms by capacity fit and excludes booked rooms", () => {
    const d = sampleData();
    const query = {
      semesterId: "term1",
      day: 0,
      start: "08:00",
      end: "09:00",
      size: 30,
      type: "classroom",
    };
    expect(availableRooms(d, query).map((r) => r.code)).toEqual(["CL 202"]);
    expect(
      availableRooms(d, { ...query, start: "10:00", end: "11:00" }).map(
        (r) => r.code,
      ),
    ).toEqual(["CL 202", "CL 201"]);
  });
  it("suggests only valid schedules", () => {
    const d = sampleData();
    const result = suggestions(d, "off1", "lecture", 60);
    expect(result.length).toBeGreaterThan(0);
    for (const m of result) {
      expect(
        validate({
          ...d,
          meetings: [...d.meetings, { ...m, id: "suggestion" }],
        }).filter((i) => i.severity === "error"),
      ).toEqual([]);
    }
  });
  it("excludes blocked minutes from utilization denominator", () => {
    const d = sampleData();
    const s = utilization(d, "room2", "term1");
    expect(s.occupied).toBe(180);
    expect(s.available).toBe(6 * 12 * 60 - 180);
    expect(s.percent).toBeCloseTo((180 / (6 * 12 * 60 - 180)) * 100);
  });
  it("counts overlapping occupied time only once", () => {
    const d = sampleData();
    d.meetings.push({ ...d.meetings[0], id: "overlap" });
    expect(utilization(d, "room1", "term1").occupied).toBe(120);
  });
});
