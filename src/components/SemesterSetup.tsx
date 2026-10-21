import { useState, type FormEvent } from "react";
import { uid, type Data } from "../lib/model";
import { duplicateSemester } from "../lib/storage";
import type { Commit } from "../lib/useStore";
import { ErrorMessage, Field, Panel, Reference } from "./UI";
export function SemesterSetup({
  data,
  commit,
  onDone,
}: {
  data: Data;
  commit: Commit;
  onDone: (id: string) => void;
}) {
  const [year, setYear] = useState(
      () => `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`,
    ),
    [name, setName] = useState("First semester"),
    [copy, setCopy] = useState(""),
    [code, setCode] = useState("BSCA"),
    [program, setProgram] = useState(
      "Bachelor of Science in Computer Applications",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let next = structuredClone(data);
      let academicYear = next.academicYears.find(
        (y) => y.name.toLowerCase() === year.trim().toLowerCase(),
      );
      if (!academicYear) {
        academicYear = { id: uid(), name: year.trim() };
        next.academicYears.push(academicYear);
      }
      const semesterId = uid();
      next.semesters.push({
        id: semesterId,
        name: name.trim(),
        academicYearId: academicYear.id,
        finalized: false,
      });
      if (!next.programs.length)
        next.programs.push({
          id: uid(),
          code: code.trim(),
          name: program.trim(),
        });
      if (!next.curricula.length && next.programs.length)
        next.curricula.push({
          id: uid(),
          programId: next.programs[0].id,
          name: `Curriculum · ${year.trim()} (confirm version)`,
        });
      if (copy) next = duplicateSemester(next, copy, semesterId, false);
      if (await commit(next, "Started a new semester planning workspace"))
        onDone(semesterId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start semester.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Start a semester or a separate draft">
      <form className="padded" onSubmit={save}>
        <p className="note">
          Create a fresh term, or copy offerings and group structure from a
          previous term. Existing faculty assignments and schedules are left out
          so you can prepare a new plan safely.
        </p>
        <div className="form-grid">
          <Field label="Academic year">
            <input
              required
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </Field>
          <Field label="Semester or draft name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Second semester · draft 1"
            />
          </Field>
          <Reference
            data={data}
            entity="semesters"
            label="Copy offerings from"
            value={copy}
            onChange={setCopy}
            empty="Start with no offerings"
          />
          {!data.programs.length && (
            <>
              <Field label="Program code">
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              <Field label="Program name">
                <input
                  required
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                />
              </Field>
            </>
          )}
        </div>
        <ErrorMessage message={error} />
        <button className="primary" disabled={busy}>
          {busy ? "Creating…" : "Create semester workspace"}
        </button>
      </form>
    </Panel>
  );
}
