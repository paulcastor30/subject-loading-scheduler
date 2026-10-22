import type { Row } from "./model";
import { minutes } from "./engine";
export function timetableLayout(meetings: Row<"meetings">[]) {
  const output: { meeting: Row<"meetings">; lane: number; lanes: number }[] =
    [];
  for (let day = 0; day < 7; day++) {
    const sorted = meetings
      .filter((m) => m.day === day)
      .sort(
        (a, b) =>
          a.start.localeCompare(b.start) ||
          a.end.localeCompare(b.end) ||
          a.id.localeCompare(b.id),
      );
    let cluster: typeof output = [],
      ends: number[] = [],
      clusterEnd = -1;
    function finish() {
      cluster.forEach((item) => output.push({ ...item, lanes: ends.length }));
      cluster = [];
      ends = [];
      clusterEnd = -1;
    }
    for (const meeting of sorted) {
      const start = minutes(meeting.start),
        end = minutes(meeting.end);
      if (start >= clusterEnd) finish();
      let lane = ends.findIndex((value) => value <= start);
      if (lane < 0) lane = ends.length;
      ends[lane] = end;
      clusterEnd = Math.max(clusterEnd, end);
      cluster.push({ meeting, lane, lanes: 0 });
    }
    finish();
  }
  return output;
}
