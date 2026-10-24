import { useState, type FormEvent } from "react";
import { rowName, uid, type Data } from "../lib/model";
import type { Commit } from "../lib/useStore";
import { useDraft } from "../lib/drafts";
import { checkData } from "../lib/storage";
import { ErrorMessage, Field, Reference } from "./UI";

type ClassSelection = {
  sectionId: string;
  subjectIds?: string[];
  subjectId?: string;
  search?: string;
};
export function AddClasses({
  data,
  term,
  commit,
  onDone,
  onCancel,
}: {
  data: Data;
  term: string;
  commit: Commit;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const form = useDraft<ClassSelection>(
    `new-offering:${term}`,
    () => ({
      sectionId: data.sections.length === 1 ? data.sections[0].id : "",
      subjectIds: [],
      search: "",
    }),
    "Add classes",
    `#scheduling/new?term=${encodeURIComponent(term)}`,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const semester = data.semesters.find((s) => s.id === term);
  const section = data.sections.find((s) => s.id === form.value.sectionId);
  const subjects = data.subjects.filter((s) =>
    data.curricula.some(
      (c) => c.id === s.curriculumId && c.programId === section?.programId,
    ),
  );
  const existing = new Set(
    data.offerings
      .filter((o) => o.semesterId === term && o.sectionId === section?.id)
      .map((o) => o.subjectId),
  );
  // Accept unfinished single-subject forms from the previous editor as well.
  const chosen =
    form.value.subjectIds ??
    (form.value.subjectId ? [form.value.subjectId] : []);
  const selected = subjects.filter(
    (s) => chosen.includes(s.id) && !existing.has(s.id),
  );
  const search = form.value.search ?? "";
  const visible = subjects.filter((s) =>
    `${s.code} ${s.name} ${rowName(data, "curricula", s.curriculumId)}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const selectable = visible.filter((s) => !existing.has(s.id));
  const blocked = !semester || semester.finalized;
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || blocked || !section || !selected.length) return;
    setBusy(true);
    setError("");
    try {
      const added = selected.map((subject) => ({
        id: uid(),
        semesterId: term,
        sectionId: section.id,
        subjectId: subject.id,
      }));
      const next = checkData({
        ...data,
        offerings: [...data.offerings, ...added],
      });
      if (
        await commit(next, `Added ${added.length} classes for ${section.name}`)
      ) {
        form.clear({ sectionId: section.id, subjectIds: [], search: "" });
        onDone(added[0].id);
      } else
        setError(
          "Classes were not saved. Review the message above and try again. Your selections are still here.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add classes.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="add-classes" aria-label="Add classes">
      <h2>Add classes for your semester</h2>
      <p className="note">
        Choose a student section, then tick the subjects it will take. You can
        assign instructors and meeting times afterward.
      </p>
      <p className="record-context">
        <strong>Semester:</strong>{" "}
        {semester
          ? `${rowName(data, "academicYears", semester.academicYearId)} · ${semester.name}`
          : "Choose a semester first"}
      </p>
      <ErrorMessage
        message={
          !semester
            ? "Start a semester on Overview before adding classes."
            : semester.finalized
              ? "Reopen this semester in Settings before adding classes."
              : ""
        }
      />
      {!semester && (
        <p>
          <a href="#dashboard/setup">Set up semester →</a>
        </p>
      )}
      <form onSubmit={save}>
        <fieldset disabled={busy || blocked} className="class-selection-fields">
          <Reference
            data={data}
            entity="sections"
            label="Student section"
            value={form.value.sectionId}
            required
            hint="The group of students taking these subjects, such as First Year A."
            onChange={(sectionId) =>
              form.setValue({ sectionId, subjectIds: [], search: "" })
            }
          />
          {!data.sections.length && (
            <p className="alert warning">
              Add a student section first.{" "}
              <a href="#settings/sections?record=new">Add section →</a>
            </p>
          )}
          {section && (
            <>
              <p>
                {rowName(data, "programs", section.programId)} · Year{" "}
                {section.yearLevel} · {section.size} students
              </p>
              <Field label="Find subjects">
                <input
                  type="search"
                  placeholder="Search by code or title…"
                  value={search}
                  onChange={(e) =>
                    form.setValue((v) => ({ ...v, search: e.target.value }))
                  }
                />
              </Field>
              <div className="class-selection-tools">
                <button
                  type="button"
                  disabled={!selectable.length}
                  onClick={() =>
                    form.setValue((v) => ({
                      ...v,
                      subjectIds: [
                        ...new Set([...chosen, ...selectable.map((s) => s.id)]),
                      ],
                    }))
                  }
                >
                  Select visible subjects
                </button>
                <button
                  type="button"
                  disabled={!chosen.length}
                  onClick={() =>
                    form.setValue((v) => ({
                      ...v,
                      subjectId: undefined,
                      subjectIds: [],
                    }))
                  }
                >
                  Clear selection
                </button>
                <span role="status">
                  {selected.length} selected · {existing.size} already added for
                  this section
                </span>
              </div>
              <div className="subject-choices">
                {visible.map((s) => (
                  <label
                    key={s.id}
                    className={
                      existing.has(s.id)
                        ? "subject-choice already-added"
                        : "subject-choice"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={existing.has(s.id) || chosen.includes(s.id)}
                      disabled={existing.has(s.id)}
                      onChange={(e) =>
                        form.setValue((v) => ({
                          ...v,
                          subjectIds: e.target.checked
                            ? [...chosen, s.id]
                            : chosen.filter((id) => id !== s.id),
                        }))
                      }
                    />
                    <span>
                      <strong>
                        {s.code} · {s.name}
                      </strong>
                      <small>
                        {rowName(data, "curricula", s.curriculumId)} ·{" "}
                        {s.lectureHours} lecture + {s.labHours} lab hours/week
                      </small>
                    </span>
                    {existing.has(s.id) && <small>Already added</small>}
                  </label>
                ))}
              </div>
              {!subjects.length ? (
                <p className="alert warning">
                  No subjects for this program yet.{" "}
                  <a href="#settings/subjects?record=new">Add subjects →</a>
                </p>
              ) : (
                !visible.length && (
                  <p>No matching subjects. Try another code or title.</p>
                )
              )}
            </>
          )}
          <ErrorMessage message={error} />
          {form.storageError && (
            <ErrorMessage message="This draft could not be kept in browser storage. Save before leaving this screen." />
          )}
          <div className="actions wrap">
            <button className="primary" disabled={!selected.length || !section}>
              {busy
                ? "Saving…"
                : selected.length
                  ? `Add ${selected.length} ${selected.length === 1 ? "class" : "classes"}`
                  : "Add classes"}
            </button>
          </div>
        </fieldset>
        <div className="actions wrap">
          <button type="button" disabled={busy} onClick={onCancel}>
            Back to classes
          </button>
          {form.dirty && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                form.clear();
                setError("");
              }}
            >
              Discard selections
            </button>
          )}
        </div>
        {form.dirty && (
          <p className="note">
            Unfinished selections stay in this tab. Choose Add classes to save
            them.
          </p>
        )}
      </form>
    </section>
  );
}
