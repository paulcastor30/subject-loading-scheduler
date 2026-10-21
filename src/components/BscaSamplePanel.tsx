import { useState } from "react";
import {
  addBscaSample,
  bscaCourses,
  bscaElectives,
  bscaSourceNotes,
  BSCA_CURRICULUM_ID,
  BSCA_SOURCE,
} from "../lib/bscaSample";
import type { Data } from "../lib/model";
import type { Commit } from "../lib/useStore";
import { Badge, ErrorMessage, Field, Panel } from "./UI";

export function BscaSamplePanel({
  data,
  commit,
}: {
  data: Data;
  commit: Commit;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState("all");
  const loaded = data.curricula.some((c) => c.id === BSCA_CURRICULUM_ID);
  const courses = [...bscaCourses, ...bscaElectives].filter(
    (c) =>
      filter === "all" ||
      (filter === "electives" ? !!c.track : c.yearLevel === Number(filter)),
  );
  async function load() {
    setBusy(true);
    setError("");
    try {
      const next = addBscaSample(data);
      if (
        await commit(
          next,
          "Added BSCA prospectus sample curriculum and offerings",
        )
      )
        setMessage(
          "BSCA prospectus sample added. Select BSCA sample planning year in the Academic term header to review its offerings. Faculty and meetings are unassigned.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add the sample.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="BSCA prospectus sample"
      action={
        <Badge tone={loaded ? "green" : "neutral"}>
          {loaded ? "Added to this browser" : "Optional curriculum sample"}
        </Badge>
      }
    >
      <div className="padded">
        <p>
          <strong>{BSCA_SOURCE}</strong>
        </p>
        <p className="note">
          Add the supplied four-year curriculum as a planning example: 51
          curriculum rows (including four elective slots), eight suggested
          elective options, four illustrative blocks of 30 students, and two
          planning semesters. All 51 offerings start unassigned and unscheduled.
        </p>
        <div className="alert warning">
          The prospectus contains inconsistent printed totals. This sample
          preserves individual course units and separate lecture/lab hours.
          Review the source notes below, especially NST, elective choices and
          internship hours, before faculty loading.
        </div>
        <details className="sample-reference">
          <summary>Review course list and source notes</summary>
          <ul>
            {bscaSourceNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <Field label="Preview year or electives">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All 59 catalog records</option>
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
              <option value="electives">
                Suggested technical electives only
              </option>
            </select>
          </Field>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Placement / track</th>
                  <th>Code</th>
                  <th>Course title</th>
                  <th>Units</th>
                  <th>Lecture h/week</th>
                  <th>Lab h/week</th>
                  <th>Prerequisites</th>
                  <th>Corequisites</th>
                  <th>PDF page</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.code}>
                    <td>
                      {c.track ??
                        `Year ${c.yearLevel} · Semester ${c.semester}`}
                    </td>
                    <td>{c.code}</td>
                    <td>{c.title}</td>
                    <td>{c.unitNotation ?? c.units}</td>
                    <td>{c.lectureHours}</td>
                    <td>{c.labHours}</td>
                    <td>{c.prerequisites}</td>
                    <td>{c.corequisites}</td>
                    <td>{c.page}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="note">
          Adds records alongside your existing data, without overwriting it or
          changing your workload rules. Conflicting course codes stop the
          operation. You can undo adding the sample in this session.
        </p>
        <ErrorMessage message={error} />
        <button
          className="primary"
          disabled={busy || loaded}
          onClick={() => void load()}
        >
          {busy
            ? "Adding BSCA sample…"
            : loaded
              ? "BSCA prospectus sample added"
              : "Add BSCA prospectus sample"}
        </button>
        {message && (
          <div className="alert success" role="status">
            {message}
          </div>
        )}
      </div>
    </Panel>
  );
}
