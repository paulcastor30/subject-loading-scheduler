import { expect, it } from "vitest";
import { timetableLayout } from "./timetable";
import { sampleData } from "../../tests/fixtures/academicData";
it("aligns overlapping meetings into lanes while adjacent meetings remain separate", () => {
  const base = sampleData().meetings[0];
  const result = timetableLayout([
    { ...base, id: "a", day: 0, start: "08:00", end: "10:00" },
    { ...base, id: "b", day: 0, start: "09:00", end: "11:00" },
    { ...base, id: "c", day: 0, start: "11:00", end: "12:00" },
    { ...base, id: "d", day: 1, start: "08:00", end: "10:00" },
  ]);
  expect(result.find((p) => p.meeting.id === "a")).toMatchObject({
    lane: 0,
    lanes: 2,
  });
  expect(result.find((p) => p.meeting.id === "b")).toMatchObject({
    lane: 1,
    lanes: 2,
  });
  expect(result.find((p) => p.meeting.id === "c")).toMatchObject({
    lane: 0,
    lanes: 1,
  });
  expect(result.find((p) => p.meeting.id === "d")).toMatchObject({
    lane: 0,
    lanes: 1,
  });
});
