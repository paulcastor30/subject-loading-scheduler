import { useDraft } from "../lib/drafts";
import { useState, type FormEvent } from "react";
import { uid, type Data, type Row } from "../lib/model";
import { workload } from "../lib/engine";
import { otherLoad, preparations, teachingLoad } from "../lib/loading";
import type { Commit } from "../lib/useStore";
import { Badge, Empty, Field, Panel, Reference } from "./UI";
function FacultyLoadWorkspace({
  data,
  term,
  commit,
  faculty,
  onChooseFaculty,
}: {
  data: Data;
  term: string;
  commit: Commit;
  faculty: string;
  onChooseFaculty: (id: string) => void;
}) {
  const form = useDraft<{
    editing: Row<"loadActivities"> | null;
    name: string;
    kind: Row<"loadActivities">["kind"];
    credits: number;
    reference: string;
  }>(
    `duty:${term}:${faculty}`,
    () => ({
      editing: null,
      name: "",
      kind: "administration",
      credits: 0,
      reference: "",
    }),
    `Other duties · ${data.faculty.find((f) => f.id === faculty)?.name ?? "Faculty"}`,
    `#loads/${faculty}`,
  );
  const { editing, name, kind, credits, reference } = form.value;
  const setEditing = (editing: Row<"loadActivities"> | null) =>
      form.setValue((v) => ({ ...v, editing })),
    setName = (name: string) => form.setValue((v) => ({ ...v, name })),
    setKind = (kind: Row<"loadActivities">["kind"]) =>
      form.setValue((v) => ({ ...v, kind })),
    setCredits = (credits: number) => form.setValue((v) => ({ ...v, credits })),
    setReference = (reference: string) =>
      form.setValue((v) => ({ ...v, reference }));
  const [busy, setBusy] = useState(false);
  const teacher = data.faculty.find((f) => f.id === faculty),
    activities = data.loadActivities.filter(
      (a) => a.semesterId === term && a.facultyId === faculty,
    );
  function clearDraft() {
    form.clear({
      editing: null,
      name: "",
      kind: "administration",
      credits: 0,
      reference: "",
    });
  }
  function chooseFaculty(id: string) {
    onChooseFaculty(id);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const row = {
      id: editing?.id ?? uid(),
      semesterId: term,
      facultyId: faculty,
      name,
      kind,
      credits,
      reference,
    };
    try {
      if (
        await commit(
          {
            ...data,
            loadActivities: [
              ...data.loadActivities.filter((a) => a.id !== row.id),
              row,
            ],
          },
          `${editing ? "Updated" : "Added"} faculty duty`,
        )
      ) {
        clearDraft();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Panel title="Faculty loads at a glance">
        <div className="padded">
          <p className="note">
            Teaching and other duties are separate. Preparations count distinct
            course codes, so repeated sections and lab groups do not inflate the
            count.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Faculty</th>
                <th>Teaching</th>
                <th>Other duties</th>
                <th>Total / limit</th>
                <th>Preparations</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {data.faculty.map((f) => {
                const total = workload(data, f.id, term);
                return (
                  <tr key={f.id}>
                    <td>
                      <button
                        disabled={busy}
                        onClick={() => chooseFaculty(f.id)}
                      >
                        {f.name}
                      </button>
                      <small className="block">
                        {f.rank}
                        {f.status &&
                          ` · ${f.status === "studyLeave" ? "Study leave" : f.status}`}
                      </small>
                    </td>
                    <td>{teachingLoad(data, f.id, term).toFixed(2)}</td>
                    <td>{otherLoad(data, f.id, term).toFixed(2)}</td>
                    <td>
                      {total.toFixed(2)} / {f.maxLoad}
                    </td>
                    <td>{preparations(data, f.id, term)}</td>
                    <td>
                      <Badge
                        tone={
                          total > f.maxLoad ||
                          data.loadActivities.some(
                            (a) =>
                              a.semesterId === term &&
                              a.facultyId === f.id &&
                              a.kind === "leave",
                          )
                            ? "amber"
                            : "green"
                        }
                      >
                        {data.loadActivities.some(
                          (a) =>
                            a.semesterId === term &&
                            a.facultyId === f.id &&
                            a.kind === "leave",
                        )
                          ? "On leave"
                          : total > f.maxLoad
                            ? `${(total - f.maxLoad).toFixed(2)} over limit`
                            : `${(f.maxLoad - total).toFixed(2)} remaining`}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Other duties and credited activities">
        <div className="padded">
          <Reference
            data={data}
            entity="faculty"
            label="Faculty member"
            value={faculty}
            onChange={chooseFaculty}
          />
          {teacher && term ? (
            <>
              <p className="note">
                Record administration, research, extension, advising,
                supervision and other approved or reported credits. These do not
                reserve a room or create teaching meetings.
              </p>
              {activities.map((a) => (
                <div className="meeting-row" key={a.id}>
                  <span>
                    <strong>
                      {a.name} · {a.credits.toFixed(2)} units
                    </strong>
                    <small>
                      {a.kind} · {a.reference || "No reference recorded"}
                    </small>
                  </span>
                  <div className="actions">
                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditing(a);
                        setName(a.name);
                        setKind(a.kind);
                        setCredits(a.credits);
                        setReference(a.reference);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="danger-text"
                      disabled={busy}
                      onClick={async () => {
                        if (!confirm("Remove this duty and its credits?"))
                          return;
                        setBusy(true);
                        try {
                          if (
                            await commit(
                              {
                                ...data,
                                loadActivities: data.loadActivities.filter(
                                  (n) => n.id !== a.id,
                                ),
                              },
                              "Removed faculty duty",
                            )
                          ) {
                            if (editing?.id === a.id) clearDraft();
                          }
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <form onSubmit={save} className="record-form">
                {form.dirty && (
                  <p className="draft-note">
                    Unfinished duty kept in this tab. Choose Save duty to record
                    these credits.
                  </p>
                )}
                <fieldset disabled={busy} className="duty-fields">
                  <legend>{editing ? "Edit duty" : "Add duty"}</legend>
                  <div className="form-grid">
                    <Field label="Duty or activity">
                      <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </Field>
                    <Field label="Category">
                      <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value as typeof kind)}
                      >
                        {[
                          "administration",
                          "research",
                          "extension",
                          "advising",
                          "supervision",
                          "leave",
                          "other",
                        ].map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Credited units">
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={credits}
                        onChange={(e) => setCredits(Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Order, approval or source reference">
                      <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="actions">
                    <button className="primary">
                      {busy ? "Saving…" : "Save duty"}
                    </button>
                    {editing && (
                      <button type="button" onClick={clearDraft}>
                        Cancel edit
                      </button>
                    )}
                  </div>
                </fieldset>
              </form>
            </>
          ) : (
            <Empty title="Select a faculty member and semester">
              Add faculty and a term in Settings first, or use the setup
              checklist on Overview.
            </Empty>
          )}
        </div>
      </Panel>
    </>
  );
}

export function FacultyLoads({
  data,
  term,
  commit,
  initialFaculty = "",
}: {
  data: Data;
  term: string;
  commit: Commit;
  initialFaculty?: string;
}) {
  const [faculty, setFaculty] = useState(() =>
    data.faculty.some((f) => f.id === initialFaculty)
      ? initialFaculty
      : (data.faculty[0]?.id ?? ""),
  );
  return (
    <FacultyLoadWorkspace
      key={faculty}
      data={data}
      term={term}
      commit={commit}
      faculty={faculty}
      onChooseFaculty={setFaculty}
    />
  );
}
