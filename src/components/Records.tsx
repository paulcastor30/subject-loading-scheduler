import { useDraft } from "../lib/drafts";
import { useRef, useState, type FormEvent } from "react";
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
import { RecordChangeReview } from "./RecordChangeReview";
import {
  applyRecordChange,
  planRecordChange,
  recordDescription,
  type ChangePlan,
  type RecordAction,
} from "../lib/recordChanges";
const fieldNames: Record<string, string> = {
  maxLoad: "Teaching load limit",
  lectureHours: "Lecture hours per week",
  labHours: "Lab hours per week",
  size: "Students in section",
};
const human = (s: string) =>
  fieldNames[s] ??
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
  curriculumId:
    "The approved subject list for a program and curriculum version.",
  programId: "The degree program this record belongs to.",
  size: "Number of students in this section. Used to find rooms with enough seats.",
  yearLevel: "Student year level, such as 1 for first year.",
  capacity: "Maximum number of students who can use this room at once.",
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
  draftKey,
  draftHref,
  allowAddAnother = false,
  preset = {},
}: {
  data: Data;
  entity: Entity;
  initial?: Record<string, unknown>;
  onSave: (
    row: Record<string, unknown>,
    addAnother?: boolean,
  ) => Promise<boolean>;
  onCancel: () => void;
  draftKey?: string;
  draftHref?: string;
  allowAddAnother?: boolean;
  preset?: Record<string, unknown>;
}) {
  const fields = Object.keys(schemas[entity].shape).filter((f) => f !== "id");
  const draft = useDraft<Record<string, unknown>>(
    draftKey ?? `record:${entity}:${initial?.id ?? "new"}`,
    () => {
      const row =
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
                  : (preset[f] ?? defaults[f] ?? ""),
          ]),
        );
      return Object.fromEntries(
        Object.entries(row).map(([field, value]) => {
          const target = refs[entity]?.[field];
          return [
            field,
            target &&
            !["groupId", "loadCategoryId"].includes(field) &&
            (value === "" || value === undefined) &&
            data[target].length === 1
              ? data[target][0].id
              : value,
          ];
        }),
      );
    },
    `${initial ? "Edit" : "Add"} ${labels[entity].toLowerCase()}`,
    draftHref ?? `#settings/${entity}?record=${initial?.id ?? "new"}`,
  );
  const { value, setValue } = draft;
  const [error, setError] = useState(""),
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
      const addAnother =
        (e.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement &&
        ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)
          .value === "another";
      if (await onSave(result.data, addAnother)) draft.clear();
      else
        setError(
          "Your changes were not saved. Review the message above and try again. Your entries are still here.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }
  const optionalFields: Partial<Record<Entity, string[]>> = {
    faculty: ["specialization", "rank", "status", "active"],
    subjects: ["equipment"],
    rooms: ["equipment", "active"],
    sections: [],
  };
  const optional = optionalFields[entity] ?? [];
  const automatic = fields.filter((field) => {
    const target = refs[entity]?.[field];
    return (
      target && data[target].length === 1 && value[field] === data[target][0].id
    );
  });
  const renderField = (field: string) => {
    const target = refs[entity]?.[field];
    const v = value[field];
    if (target)
      return (
        <Reference
          key={field}
          data={data}
          entity={target}
          label={human(field)}
          hint={hints[field]}
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
                : field === "specialization" && entity === "schedulingRules"
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
            autoFocus={field === "name"}
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
  };
  return (
    <form className="record-form" onSubmit={submit}>
      <h3>
        {initial ? "Edit" : "Add"} {labels[entity].toLowerCase()}
      </h3>
      <fieldset className="record-form-fields" disabled={saving}>
        <ErrorMessage message={error} />
        {draft.dirty && (
          <p className="draft-note">
            Unfinished edits kept in this tab. Save this form to update academic
            records.
          </p>
        )}
        {draft.storageError && (
          <ErrorMessage message="This draft could not be kept in browser storage. Save before leaving the page." />
        )}
        {Object.entries(refs[entity] ?? {})
          .filter(
            ([field, target]) =>
              !["groupId", "loadCategoryId"].includes(field) &&
              !data[target].length,
          )
          .map(([, target]) => (
            <p key={target} className="alert warning">
              Add {labels[target].toLowerCase()} first.{" "}
              <a href={`#settings/${target}?record=new`}>Add now →</a> Your
              unfinished form will be kept in this tab.
            </p>
          ))}
        <div className="form-grid">
          {fields
            .filter((f) => !optional.includes(f) && !automatic.includes(f))
            .map(renderField)}
        </div>
        {automatic.length > 0 && (
          <div className="record-context">
            {automatic.map((field) => (
              <p key={field}>
                {human(field)}:{" "}
                {rowName(data, refs[entity]![field], String(value[field]))}{" "}
                <small>(selected for you)</small>
              </p>
            ))}
          </div>
        )}
        {(optional.length > 0 || automatic.length > 0) && (
          <details className="class-advanced">
            <summary>Optional details and record links</summary>
            <div className="form-grid">
              {fields
                .filter((f) => optional.includes(f) || automatic.includes(f))
                .map(renderField)}
            </div>
          </details>
        )}
        {entity === "workloadRules" && (
          <p className="note">
            These are the default credit factors. Separate teaching groups can
            select a named category or record an explicit credit with its
            source. Older whole-offering assignments use planned lecture hours ×
            lecture factor + planned lab hours × lab factor, once per offering.
            Other duties are counted separately.
          </p>
        )}
        <div className="actions">
          <button className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save record"}
          </button>
          {allowAddAnother && !initial && (
            <button type="submit" value="another" disabled={saving}>
              Save and add another
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              draft.clear();
              onCancel();
            }}
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export function Records({
  data,
  commit,
  initialEntity = "faculty",
  initialRecordId = "",
  onEntityChange,
}: {
  data: Data;
  commit: Commit;
  initialEntity?: Entity;
  initialRecordId?: string;
  onEntityChange?: (entity: Entity) => void;
}) {
  const [entity, setEntity] = useState<Entity>(initialEntity),
    [editing, setEditing] = useState<
      Record<string, unknown> | null | undefined
    >(() =>
      initialRecordId === "new"
        ? null
        : initialRecordId
          ? (data[initialEntity].find(
              (r) => r.id === initialRecordId,
            ) as unknown as Record<string, unknown> | undefined)
          : undefined,
    ),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [plan, setPlan] = useState<ChangePlan | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [formSequence, setFormSequence] = useState(0);
  const [preset, setPreset] = useState<Record<string, unknown>>({});
  const returnFocus = useRef<HTMLElement | null>(null);
  const singleton = ["workloadRules", "schedulingRules"].includes(entity);
  const fields = Object.keys(schemas[entity].shape).filter((f) => f !== "id");
  const rows = (data[entity] as unknown as Record<string, unknown>[]).filter(
    (r) =>
      Object.values(r).some((v) =>
        String(v).toLowerCase().includes(search.toLowerCase()),
      ),
  );
  function chooseEntity(next: Entity) {
    setEntity(next);
    setEditing(undefined);
    setSearch("");
    setSelected([]);
    setPlan(null);
    setMessage("");
    setError("");
    setPreset({});
    onEntityChange?.(next);
  }
  const tasks = [
    {
      name: "Faculty",
      items: ["faculty", "facultyAvailability", "loadActivities"],
    },
    {
      name: "Subjects & sections",
      items: ["subjects", "sections", "programs", "curricula"],
    },
    { name: "Rooms", items: ["rooms", "roomAvailability"] },
    { name: "Semesters", items: ["semesters", "academicYears"] },
  ];
  const task = tasks.find((t) => t.items.includes(entity));
  async function save(row: Record<string, unknown>, addAnother = false) {
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
      if (addAnother) {
        setPreset(
          Object.fromEntries(
            Object.entries(row).filter(([key]) =>
              [
                "curriculumId",
                "programId",
                "yearLevel",
                "academicYearId",
                "semesterId",
              ].includes(key),
            ),
          ),
        );
        setEditing(null);
        setFormSequence((n) => n + 1);
        setMessage(
          `Saved ${String(row.name ?? row.code ?? "record")}. Add the next record below.`,
        );
      } else setEditing(undefined);
      return true;
    }
    return false;
  }
  function review(action: RecordAction, ids: string[]) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setError("");
    setMessage("");
    setEditing(undefined);
    setPlan(planRecordChange(data, { action, entity, ids }));
  }
  function closeReview() {
    setPlan(null);
    returnFocus.current?.focus();
  }
  async function applyChange() {
    if (!plan || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = applyRecordChange(data, plan);
      const count =
        plan.request.action === "delete"
          ? plan.removed.length
          : plan.changed.length;
      if (
        await commit(
          next,
          `${plan.request.action === "delete" ? "Deleted" : plan.request.action === "reset" ? "Reset" : plan.request.action === "deactivate" ? "Deactivated" : "Activated"} ${count} records · ${labels[entity]}`,
        )
      ) {
        setMessage(
          `${plan.request.action === "delete" ? "Deleted" : plan.request.action === "reset" ? "Reset" : plan.request.action === "deactivate" ? "Deactivated" : "Activated"} ${count} ${count === 1 ? "record" : "records"}. You can undo this change during this session.`,
        );
        setSelected([]);
        setPlan(null);
        setEditing(undefined);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save these changes.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <nav className="task-nav" aria-label="Academic record tasks">
        {tasks.map((t) => (
          <button
            key={t.name}
            aria-pressed={task?.name === t.name}
            className={task?.name === t.name ? "active" : ""}
            onClick={() => chooseEntity(t.items[0] as Entity)}
          >
            {t.name}
          </button>
        ))}
      </nav>
      {task && (
        <div className="tabs record-subtabs">
          {task.items.map((key) => (
            <button
              key={key}
              aria-pressed={entity === key}
              className={entity === key ? "active" : ""}
              onClick={() => chooseEntity(key as Entity)}
            >
              {key === "faculty"
                ? "Profiles"
                : key === "rooms"
                  ? "Room details"
                  : key === "subjects"
                    ? "Subject catalog"
                    : key === "semesters"
                      ? "Terms"
                      : labels[key as Entity]}
            </button>
          ))}
        </div>
      )}
      <details className="advanced-record-tools" open={!task || undefined}>
        <summary>Advanced records and department rules</summary>
        <div className="toolbar">
          <Field label="Record type">
            <select
              value={entity}
              disabled={busy}
              onChange={(e) => chooseEntity(e.target.value as Entity)}
            >
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </details>
      <div className="toolbar">
        <Field label="Search records">
          <input
            type="search"
            disabled={busy}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search any field…"
          />
        </Field>
        {!singleton && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              setPlan(null);
              setEditing(null);
            }}
          >
            + Add record
          </button>
        )}
      </div>
      {!singleton && selected.length > 0 && (
        <div className="toolbar wrap selection-toolbar">
          <strong>{selected.length} selected</strong>
          <button
            disabled={busy}
            className="danger-text"
            onClick={() => review("delete", selected)}
          >
            Delete selected
          </button>
          {(entity === "faculty" || entity === "rooms") && (
            <button
              disabled={busy}
              onClick={() => review("deactivate", selected)}
            >
              Deactivate selected
            </button>
          )}
          <button disabled={busy} onClick={() => setSelected([])}>
            Clear selection
          </button>
        </div>
      )}
      <ErrorMessage message={error} />
      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}
      {plan && (
        <RecordChangeReview
          plan={plan}
          data={data}
          busy={busy}
          onApply={() => void applyChange()}
          onCancel={closeReview}
          onRefresh={() => setPlan(planRecordChange(data, plan.request))}
        />
      )}
      {editing !== undefined && (
        <RecordForm
          key={`${entity}-${editing?.id ?? "new"}-${formSequence}`}
          data={data}
          entity={entity}
          initial={editing ?? undefined}
          allowAddAnother={!singleton}
          preset={preset}
          onSave={save}
          onCancel={() => setEditing(undefined)}
        />
      )}
      <p className="note">
        {task
          ? `Manage ${task.name.toLowerCase()} here. Select a tab above, search, or add a record.`
          : "Advanced controls for linked records and department calculation rules."}{" "}
        Deletion shows a preview first. Deactivate faculty or rooms when you
        want to keep their history.
      </p>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {!singleton && (
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all visible records"
                      disabled={busy}
                      checked={
                        rows.length > 0 &&
                        rows.every((r) => selected.includes(String(r.id)))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [
                                ...new Set([
                                  ...selected,
                                  ...rows.map((r) => String(r.id)),
                                ]),
                              ]
                            : selected.filter(
                                (id) => !rows.some((r) => r.id === id),
                              ),
                        )
                      }
                    />
                  </th>
                )}
                {fields.map((f) => (
                  <th key={f}>{human(f)}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  {!singleton && (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${recordDescription(data, entity, String(r.id))}`}
                        disabled={busy}
                        checked={selected.includes(String(r.id))}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, String(r.id)]
                              : selected.filter((id) => id !== r.id),
                          )
                        }
                      />
                    </td>
                  )}
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
                    <button
                      disabled={busy}
                      onClick={() => {
                        setPlan(null);
                        setEditing(r);
                      }}
                    >
                      Edit
                    </button>
                    {singleton && (
                      <button
                        disabled={busy}
                        onClick={() => review("reset", [String(r.id)])}
                      >
                        Reset to defaults
                      </button>
                    )}
                    {(entity === "faculty" || entity === "rooms") && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          review(r.active ? "deactivate" : "activate", [
                            String(r.id),
                          ])
                        }
                      >
                        {r.active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                    {!singleton && (
                      <button
                        className="danger-text"
                        disabled={busy}
                        onClick={() => review("delete", [String(r.id)])}
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
