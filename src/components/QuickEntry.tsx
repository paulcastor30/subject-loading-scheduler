import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { labels, type Data } from "../lib/model";
import { useDraft } from "../lib/drafts";
import { checkData } from "../lib/storage";
import type { Commit } from "../lib/useStore";
import {
  blankQuickRow,
  inspectQuickEntry,
  MAX_QUICK_ROWS,
  parseQuickPaste,
  quickColumns,
  quickDefaults,
  quickRowEmpty,
  type QuickEntity,
  type QuickRecord,
  type QuickRow,
} from "../lib/quickEntry";
import { ErrorMessage, Field, Select } from "./UI";

type BatchDraft = {
  defaults: Record<string, string>;
  rows: QuickRow[];
  paste: string;
};
export function QuickEntry({
  data,
  entity,
  commit,
  onClose,
}: {
  data: Data;
  entity: QuickEntity;
  commit: Commit;
  onClose: () => void;
}) {
  const [initial, setInitial] = useState<BatchDraft>(() => ({
    defaults: quickDefaults(data, entity),
    rows: [blankQuickRow()],
    paste: "",
  }));
  const form = useDraft(
    `quick-entry:${entity}`,
    initial,
    `Quick entry · ${labels[entity].toLowerCase()}`,
    `#settings/${entity}?record=quick`,
  );
  const { rows, defaults, paste } = form.value;
  const allColumns = quickColumns[entity];
  const [showOptional, setShowOptional] = useState(() =>
    rows.some((r) =>
      allColumns.some((c) => c.optional && r.values[c.key]?.trim()),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pasteError, setPasteError] = useState(""),
    [message, setMessage] = useState("");
  const cells = useRef(new Map<string, HTMLInputElement | HTMLSelectElement>());
  const pendingFocus = useRef("");
  const inspection = useMemo(
    () => inspectQuickEntry(data, entity, rows, defaults),
    [data, entity, rows, defaults],
  );
  const columns = allColumns.filter((c) => showOptional || !c.optional);
  const noun =
    entity === "subjects" ? "subject" : entity === "rooms" ? "room" : "faculty";
  const countLabel = `${inspection.count} ${noun} ${inspection.count === 1 ? "record" : "records"}`;
  useEffect(() => {
    if (pendingFocus.current) {
      cells.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = "";
    }
  }, [rows]);
  function setDefault(key: string, value: string) {
    setMessage("");
    form.setValue((old) => ({
      ...old,
      defaults: { ...old.defaults, [key]: value },
    }));
  }
  function setCell(id: string, key: string, value: string) {
    setMessage("");
    form.setValue((old) => ({
      ...old,
      rows: old.rows.map((r) =>
        r.id === id ? { ...r, values: { ...r.values, [key]: value } } : r,
      ),
    }));
  }
  function addRow(after?: number, copy?: QuickRow) {
    if (rows.length >= MAX_QUICK_ROWS) return;
    const next = { ...blankQuickRow(), values: copy ? { ...copy.values } : {} };
    pendingFocus.current = `${next.id}:${columns[0].key}`;
    const at = after === undefined ? rows.length : after + 1;
    form.setValue((old) => ({
      ...old,
      rows: [...old.rows.slice(0, at), next, ...old.rows.slice(at)],
    }));
    setMessage("");
  }
  function removeRow(id: string) {
    const remaining = rows.filter((r) => r.id !== id);
    if (!remaining.length) remaining.push(blankQuickRow());
    pendingFocus.current = `${remaining[0].id}:${columns[0].key}`;
    form.setValue((old) => ({ ...old, rows: remaining }));
    setMessage("");
  }
  function addPaste() {
    setPasteError("");
    setMessage("");
    try {
      const added = parseQuickPaste(entity, paste);
      if (!added.length) throw new Error("Paste at least one record first.");
      const entered = rows.filter((r) => !quickRowEmpty(r));
      if (entered.length + added.length > MAX_QUICK_ROWS)
        throw new Error(
          "Use at most 500 rows in one batch. Your current rows and pasted text are kept.",
        );
      if (
        added.some((r) =>
          allColumns.some((c) => c.optional && r.values[c.key]?.trim()),
        )
      )
        setShowOptional(true);
      pendingFocus.current = `${added[0].id}:${columns[0].key}`;
      form.setValue((old) => ({
        ...old,
        rows: [...entered, ...added],
        paste: "",
      }));
      setMessage(
        `Added ${added.length} pasted ${added.length === 1 ? "row" : "rows"} to this draft. Review them before saving.`,
      );
    } catch (e) {
      setPasteError(
        e instanceof Error ? e.message : "Unable to read pasted rows.",
      );
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !inspection.valid || paste.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = structuredClone(data);
      const collection: QuickRecord[] = next[entity];
      collection.push(...inspection.records);
      const checked = checkData(next);
      if (await commit(checked, `Quick entry: added ${countLabel}`)) {
        const fresh = {
          defaults: { ...defaults },
          rows: [blankQuickRow()],
          paste,
        };
        pendingFocus.current = `${fresh.rows[0].id}:${columns[0].key}`;
        setInitial(fresh);
        form.clear(fresh);
        setMessage(
          `Saved ${countLabel}. Enter another batch or return to records. Undo is available in the header.`,
        );
      } else
        setError(
          "This batch was not saved. Review the message above and try again. All your entries are still here.",
        );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The batch was not saved. Your entries are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="quick-entry" aria-label={`Quick entry for ${entity}`}>
      <div className="quick-entry-heading">
        <div>
          <h2>Quick entry · {labels[entity]}</h2>
          <p>
            Enter several records here, then save them together. Press Enter in
            a cell to continue on the next row.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={onClose}>
          Back to records
        </button>
      </div>
      {message && (
        <p role="status" className="alert success">
          {message}
        </p>
      )}
      <ErrorMessage message={inspection.error} />
      {form.storageError && (
        <ErrorMessage message="This draft could not be kept in browser storage. Save before leaving this screen." />
      )}
      <form onSubmit={save} noValidate>
        <fieldset disabled={busy} className="quick-entry-fields">
          <section className="quick-defaults" aria-label="Shared defaults">
            <h3>Shared defaults</h3>
            <p className="note">
              Blank cells use these values. Enter a different value in a row to
              override it. Review the example numbers against your department's
              rules.
            </p>
            <p className="note">
              {entity === "subjects"
                ? "Lecture and lab hours are weekly contact hours. Course units are separate from faculty load credits."
                : entity === "faculty"
                  ? "Load limits are credited units per semester."
                  : "Capacity is the number of students the room can accommodate."}
            </p>
            <div className="form-grid">
              {entity === "subjects" && (
                <Select
                  label="Curriculum for this batch"
                  value={defaults.curriculumId ?? ""}
                  onChange={(v) => setDefault("curriculumId", v)}
                  required
                  options={data.curricula.map((c) => ({
                    id: c.id,
                    name: `${c.name} · ${data.programs.find((p) => p.id === c.programId)?.code ?? ""}`,
                  }))}
                />
              )}
              {Object.keys(defaults)
                .filter((key) => key !== "curriculumId")
                .map((key) => {
                  const column = allColumns.find((c) => c.key === key)!;
                  return (
                    <Field
                      label={`Default ${column.label.toLowerCase()}`}
                      key={key}
                    >
                      {key === "type" ? (
                        <select
                          value={defaults[key]}
                          onChange={(e) => setDefault(key, e.target.value)}
                        >
                          <option value="classroom">Classroom</option>
                          <option value="laboratory">Laboratory</option>
                        </select>
                      ) : (
                        <input
                          type={column.numeric ? "number" : "text"}
                          step="any"
                          value={defaults[key]}
                          onChange={(e) => setDefault(key, e.target.value)}
                        />
                      )}
                    </Field>
                  );
                })}
            </div>
            {entity === "subjects" && !data.curricula.length && (
              <p className="alert warning">
                Add a curriculum before saving subjects.{" "}
                <a href="#settings/curricula?record=new">Add curriculum →</a>{" "}
                Your unfinished rows stay in this tab.
              </p>
            )}
            {entity === "subjects" &&
              inspection.count > 0 &&
              data.curricula.length > 0 &&
              !data.curricula.some((c) => c.id === defaults.curriculumId) && (
                <ErrorMessage message="Choose a curriculum for this batch before saving subjects." />
              )}
          </section>
          <div className="quick-entry-tools">
            <button
              type="button"
              disabled={rows.length >= MAX_QUICK_ROWS}
              onClick={() => addRow()}
            >
              Add row
            </button>
            <label className="check">
              <input
                type="checkbox"
                checked={showOptional}
                onChange={(e) => setShowOptional(e.target.checked)}
              />
              Show optional columns
            </label>
            <span>
              {rows.length} / {MAX_QUICK_ROWS} rows
            </span>
          </div>
          <p className="note">
            On smaller screens, scroll inside the table to see the remaining
            columns and row actions.
          </p>
          <div
            className="table-wrap quick-entry-scroll"
            role="region"
            aria-label="Editable entry table"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  {columns.map((c) => (
                    <th scope="col" key={c.key}>
                      {c.label}
                    </th>
                  ))}
                  <th scope="col">Row actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <th scope="row">{index + 1}</th>
                    {columns.map((c) => {
                      const fieldError = inspection.errors[row.id]?.[c.key];
                      const errorId = `quick-${row.id}-${c.key}-error`;
                      const common = {
                        "aria-label": `${c.label} row ${index + 1}`,
                        "aria-invalid": fieldError ? true : undefined,
                        "aria-describedby": fieldError ? errorId : undefined,
                        value:
                          c.key === "type"
                            ? (row.values[c.key] ?? "").toLowerCase()
                            : (row.values[c.key] ?? ""),
                        onChange: (
                          e: React.ChangeEvent<
                            HTMLInputElement | HTMLSelectElement
                          >,
                        ) => setCell(row.id, c.key, e.target.value),
                        onKeyDown: (
                          e: React.KeyboardEvent<
                            HTMLInputElement | HTMLSelectElement
                          >,
                        ) => {
                          if (e.key !== "Enter" || e.nativeEvent.isComposing)
                            return;
                          e.preventDefault();
                          const next = rows[index + 1];
                          if (next)
                            cells.current
                              .get(`${next.id}:${columns[0].key}`)
                              ?.focus();
                          else addRow();
                        },
                        ref: (
                          node: HTMLInputElement | HTMLSelectElement | null,
                        ) => {
                          if (node)
                            cells.current.set(`${row.id}:${c.key}`, node);
                          else cells.current.delete(`${row.id}:${c.key}`);
                        },
                      };
                      return (
                        <td
                          key={c.key}
                          className={`quick-cell-${c.key}${c.numeric ? " quick-cell-number" : ""}`}
                        >
                          {c.key === "type" ? (
                            <select {...common}>
                              <option value="">
                                Use default ({defaults.type})
                              </option>
                              <option value="classroom">Classroom</option>
                              <option value="laboratory">Laboratory</option>
                              {row.values.type &&
                                !["classroom", "laboratory"].includes(
                                  row.values.type.toLowerCase(),
                                ) && (
                                  <option value={row.values.type.toLowerCase()}>
                                    Check: {row.values.type}
                                  </option>
                                )}
                            </select>
                          ) : (
                            <input
                              {...common}
                              autoFocus={
                                index === 0 && c.key === columns[0].key
                              }
                              type="text"
                              inputMode={c.numeric ? "decimal" : undefined}
                              placeholder={
                                defaults[c.key]
                                  ? `${defaults[c.key]} (default)`
                                  : ""
                              }
                            />
                          )}
                          {fieldError && (
                            <small className="quick-field-error" id={errorId}>
                              {fieldError}
                            </small>
                          )}
                        </td>
                      );
                    })}
                    <td className="quick-row-actions">
                      <div>
                        <button
                          type="button"
                          aria-label={`Duplicate row ${index + 1}`}
                          disabled={rows.length >= MAX_QUICK_ROWS}
                          onClick={() => addRow(index, row)}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove row ${index + 1}`}
                          onClick={() => removeRow(row.id)}
                        >
                          Remove
                        </button>
                      </div>
                      {inspection.errors[row.id]?.curriculumId && (
                        <small className="quick-field-error">
                          {inspection.errors[row.id].curriculumId}
                        </small>
                      )}
                      {inspection.errors[row.id]?.id && (
                        <small className="quick-field-error">
                          {inspection.errors[row.id].id}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="quick-paste" open={!!paste || undefined}>
            <summary>Paste rows from Excel or a list</summary>
            <p className="note">
              Copy cells from Excel, or enter one faculty name per line. Columns
              without a recognized header use this order:{" "}
              <strong>{allColumns.map((c) => c.label).join(" → ")}</strong>.
              Later columns can be left out to use shared defaults. Rows append
              below your entered records.
            </p>
            <Field label="Pasted rows">
              <textarea
                rows={4}
                value={paste}
                onChange={(e) => {
                  setPasteError("");
                  form.setValue((old) => ({ ...old, paste: e.target.value }));
                }}
              />
            </Field>
            <ErrorMessage message={pasteError} />
            <button type="button" disabled={!paste.trim()} onClick={addPaste}>
              Add pasted rows
            </button>
          </details>
          <ErrorMessage message={error} />
          <div className="quick-save-bar">
            <p role="status">
              {inspection.count
                ? `${countLabel} in this batch`
                : "Enter a record to get started"}
              {Object.keys(inspection.errors).length
                ? ` · ${Object.keys(inspection.errors).length} rows need attention`
                : inspection.valid
                  ? " · Ready to save"
                  : ""}
              . Blank rows are ignored.
            </p>
            <button
              className="primary"
              disabled={!inspection.valid || !!paste.trim()}
            >
              {busy ? "Saving…" : `Save ${countLabel}`}
            </button>
          </div>
          {paste.trim() && (
            <p className="note">
              Add the pasted rows to the table, or clear the paste box, before
              saving.
            </p>
          )}
          {form.dirty && (
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Discard this unfinished batch? Saved records will be kept.",
                  )
                ) {
                  form.clear(initial);
                  setError("");
                  setPasteError("");
                  setMessage("");
                }
              }}
            >
              Discard unfinished batch
            </button>
          )}
        </fieldset>
      </form>
    </section>
  );
}
