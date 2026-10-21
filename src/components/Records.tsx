import { useState, type FormEvent } from "react";
import {
  days,
  labels,
  refs,
  rowName,
  schemas,
  uid,
  type Data,
  type Entity,
} from "../lib/model";
import type { Commit } from "../lib/useStore";
import { Empty, ErrorMessage, Field, Reference } from "./UI";
const human = (s: string) =>
  s
    .replace(/Id$/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase());
const defaults: Record<string, unknown> = {
  active: true,
  finalized: false,
  yearLevel: 1,
  size: 30,
  capacity: 30,
  courseUnits: 3,
  lectureHours: 3,
  labHours: 0,
  maxLoad: 18,
  lectureFactor: 1,
  labFactor: 1,
  day: 0,
  students: 30,
  contactHours: 3,
  factor: 1,
  credits: 0,
  start: "08:00",
  end: "09:00",
  component: "lecture",
  type: "classroom",
  kind: "administration",
  overload: "error",
  specialization: "",
  days: [0, 1, 2, 3, 4, 5],
};
const hints: Record<string, string> = {
  equipment:
    "Comma-separated equipment; subject requirements must match room equipment.",
  specialization: "Comma-separated subject keywords. Advisory only.",
  maxLoad:
    "Maximum total credited load per semester, including teaching and other duties.",
  courseUnits:
    "Student academic credit; independent of contact hours and teaching load.",
  lectureHours: "Required weekly lecture contact hours.",
  labHours: "Required weekly laboratory contact hours.",
  lectureFactor: "Credited units per planned weekly lecture contact hour.",
  labFactor: "Credited units per planned weekly lab contact hour.",
  days: "Enabled days, numbered 0 = Monday through 6 = Sunday.",
  start: "24-hour time. Availability repeats weekly for all semesters.",
  name: "",
  finalized:
    "Back up before finalizing. Reopen to change offerings or schedules.",
};
const numeric = [
  "yearLevel",
  "size",
  "capacity",
  "courseUnits",
  "lectureHours",
  "labHours",
  "maxLoad",
  "lectureFactor",
  "labFactor",
  "day",
  "students",
  "contactHours",
  "factor",
  "credits",
  "creditedLoad",
];
export function RecordForm({
  data,
  entity,
  initial,
  onSave,
  onCancel,
}: {
  data: Data;
  entity: Entity;
  initial?: Record<string, unknown>;
  onSave: (row: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const fields = Object.keys(schemas[entity].shape).filter((f) => f !== "id");
  const [value, setValue] = useState<Record<string, unknown>>(
      () =>
        initial ??
        Object.fromEntries(
          ["id", ...fields].map((f) => [
            f,
            f === "id"
              ? uid()
              : f === "specialization" && entity === "schedulingRules"
                ? "warning"
                : f === "kind" && entity === "roomAvailability"
                  ? "blocked"
                  : (defaults[f] ?? ""),
          ]),
        ),
    ),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const set = (key: string, v: unknown) =>
    setValue((prev) => ({ ...prev, [key]: v }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const cleaned = { ...value };
    for (const key of [
      "groupId",
      "loadCategoryId",
      "creditedLoad",
      "overloadPolicy",
      "status",
    ])
      if (cleaned[key] === "") delete cleaned[key];
    const result = schemas[entity].safeParse(cleaned);
    if (!result.success) {
      setError(
        result.error.issues
          .map((i) => `${human(String(i.path[0]))}: ${i.message}`)
          .join("\n"),
      );
      setSaving(false);
      return;
    }
    try {
      if (
        entity === "semesters" &&
        result.data &&
        "finalized" in result.data &&
        result.data.finalized &&
        !initial?.finalized &&
        !confirm(
          "Finalize this semester? Review all schedule warnings and download a JSON backup first. Offerings and schedules will be locked until you reopen it.",
        )
      )
        return;
      await onSave(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="record-form" onSubmit={submit}>
      <h3>
        {initial ? "Edit" : "Add"} {labels[entity].toLowerCase()}
      </h3>
      <ErrorMessage message={error} />
      <div className="form-grid">
        {fields.map((field) => {
          const target = refs[entity]?.[field];
          const v = value[field];
          if (target)
            return (
              <Reference
                key={field}
                data={data}
                entity={target}
                label={human(field)}
                value={String(v ?? "")}
                onChange={(v) => set(field, v || undefined)}
                required={!["groupId", "loadCategoryId"].includes(field)}
              />
            );
          if (field === "days")
            return (
              <fieldset key={field}>
                <legend>Scheduling days</legend>
                {days.map((d, i) => (
                  <label className="check" key={d}>
                    <input
                      type="checkbox"
                      checked={(v as number[]).includes(i)}
                      onChange={(e) =>
                        set(
                          field,
                          e.target.checked
                            ? [...(v as number[]), i].sort()
                            : (v as number[]).filter((n) => n !== i),
                        )
                      }
                    />
                    {d}
                  </label>
                ))}
              </fieldset>
            );
          const options =
            field === "status"
              ? ["", "active", "studyLeave", "proposed"]
              : field === "type"
                ? ["classroom", "laboratory"]
                : field === "component"
                  ? entity === "loadCategories"
                    ? ["lecture", "lab", "any"]
                    : ["lecture", "lab"]
                  : field === "kind"
                    ? entity === "loadActivities"
                      ? [
                          "administration",
                          "research",
                          "extension",
                          "advising",
                          "supervision",
                          "leave",
                          "other",
                        ]
                      : ["available", "blocked"]
                    : ["overload", "overloadPolicy"].includes(field)
                      ? field === "overloadPolicy"
                        ? ["", "error", "warning"]
                        : ["error", "warning"]
                      : field === "specialization" &&
                          entity === "schedulingRules"
                        ? ["warning", "off"]
                        : null;
          return (
            <Field key={field} label={human(field)} hint={hints[field]}>
              {options ? (
                <select
                  value={String(v)}
                  onChange={(e) =>
                    set(
                      field,
                      field === "overloadPolicy" && !e.target.value
                        ? undefined
                        : e.target.value,
                    )
                  }
                >
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : typeof v === "boolean" ? (
                <input
                  type="checkbox"
                  checked={v}
                  onChange={(e) => set(field, e.target.checked)}
                />
              ) : field === "day" ? (
                <select
                  value={Number(v)}
                  onChange={(e) => set(field, Number(e.target.value))}
                >
                  {days.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={
                    ["start", "end"].includes(field)
                      ? "time"
                      : numeric.includes(field)
                        ? "number"
                        : "text"
                  }
                  step={numeric.includes(field) ? "any" : undefined}
                  min={numeric.includes(field) ? 0 : undefined}
                  value={String(v ?? "")}
                  onChange={(e) =>
                    set(
                      field,
                      e.target.value === "" && field === "creditedLoad"
                        ? undefined
                        : e.target.value,
                    )
                  }
                  required={
                    ![
                      "equipment",
                      "specialization",
                      "reason",
                      "building",
                      "groupId",
                      "loadCategoryId",
                      "creditedLoad",
                      "creditReason",
                      "sourceNote",
                      "reference",
                      "rank",
                      "status",
                      "overloadPolicy",
                    ].includes(field)
                  }
                />
              )}
            </Field>
          );
        })}
      </div>
      {entity === "workloadRules" && (
        <p className="note">
          These are the default credit factors. Separate teaching groups can
          select a named category or record an explicit credit with its source.
          Older whole-offering assignments use planned lecture hours × lecture
          factor + planned lab hours × lab factor, once per offering. Other
          duties are counted separately.
        </p>
      )}
      <div className="actions">
        <button className="primary" disabled={saving}>
          {saving ? "Saving…" : "Save record"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
export function Records({
  data,
  commit,
  initialEntity = "faculty",
}: {
  data: Data;
  commit: Commit;
  initialEntity?: Entity;
}) {
  const [entity, setEntity] = useState<Entity>(initialEntity),
    [editing, setEditing] = useState<
      Record<string, unknown> | null | undefined
    >(),
    [search, setSearch] = useState("");
  const singleton = ["workloadRules", "schedulingRules"].includes(entity);
  const fields = Object.keys(schemas[entity].shape).filter((f) => f !== "id");
  const rows = (data[entity] as unknown as Record<string, unknown>[]).filter(
    (r) =>
      Object.values(r).some((v) =>
        String(v).toLowerCase().includes(search.toLowerCase()),
      ),
  );
  async function save(row: Record<string, unknown>) {
    const next = structuredClone(data);
    const collection = next[entity] as unknown as Record<string, unknown>[];
    const index = collection.findIndex((r) => r.id === row.id);
    if (index < 0) collection.push(row);
    else collection[index] = row;
    if (
      await commit(
        next,
        `${index < 0 ? "Added" : "Updated"} ${labels[entity].toLowerCase()}`,
      )
    ) {
      setEditing(undefined);
      return true;
    }
    return false;
  }
  async function remove(id: unknown) {
    if (
      !confirm(
        "Delete this record? Records referenced elsewhere cannot be deleted. You can undo this change.",
      )
    )
      return;
    const next = structuredClone(data);
    (next[entity] as unknown[]) = next[entity].filter((r) => r.id !== id);
    await commit(next, `Deleted ${labels[entity].toLowerCase()} record`);
  }
  return (
    <>
      <div className="toolbar">
        <Field label="Record type">
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value as Entity);
              setEditing(undefined);
              setSearch("");
            }}
          >
            {Object.entries(labels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search records">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search any field…"
          />
        </Field>
        {!singleton && (
          <button className="primary" onClick={() => setEditing(null)}>
            + Add record
          </button>
        )}
      </div>
      {editing !== undefined && (
        <RecordForm
          key={`${entity}-${editing?.id ?? "new"}`}
          data={data}
          entity={entity}
          initial={editing ?? undefined}
          onSave={save}
          onCancel={() => setEditing(undefined)}
        />
      )}
      <p className="note">
        Create records in order: academic year → semester → program → curriculum
        → subjects and sections → offerings. Availability repeats weekly; no
        faculty windows means unrestricted within scheduling hours. Referenced
        records must be removed from their dependents first.
      </p>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {fields.map((f) => (
                  <th key={f}>{human(f)}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  {fields.map((f) => (
                    <td key={f}>
                      {refs[entity]?.[f]
                        ? rowName(data, refs[entity]![f], String(r[f] ?? "—"))
                        : f === "day"
                          ? days[Number(r[f])]
                          : typeof r[f] === "boolean"
                            ? r[f]
                              ? "Yes"
                              : "No"
                            : Array.isArray(r[f])
                              ? (r[f] as number[])
                                  .map((i) => days[i].slice(0, 3))
                                  .join(", ")
                              : String(r[f] ?? "—")}
                    </td>
                  ))}
                  <td className="row-actions">
                    <button onClick={() => setEditing(r)}>Edit</button>
                    {!singleton && (
                      <button
                        className="danger-text"
                        onClick={() => remove(r.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={`No ${labels[entity].toLowerCase()} yet`}>
          Add a record to get started. Changes save automatically after
          validation.
        </Empty>
      )}
    </>
  );
}
