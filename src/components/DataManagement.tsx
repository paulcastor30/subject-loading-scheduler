import { BscaSamplePanel } from "./BscaSamplePanel";
import { readPreference, writePreference } from "../lib/preferences";
import { useState } from "react";
import {
  entities,
  labels,
  rowName,
  type Data,
  type Entity,
} from "../lib/model";
import type { Commit } from "../lib/useStore";
import { backup, db, duplicateSemester, restore } from "../lib/storage";
import {
  download,
  exportExcel,
  importEntities,
  previewImport,
  readSpreadsheet,
  referenceExport,
  templateCSV,
  templateFields,
  type ImportPreview,
  type RawRow,
} from "../lib/imports";
import { sampleData } from "../lib/sample";
import { Badge, ErrorMessage, Field, Panel, Reference } from "./UI";
export function DataManagement({
  data,
  commit,
  replace,
  onError,
}: {
  data: Data;
  commit: Commit;
  replace: Commit;
  onError: (s: string) => void;
}) {
  const [entity, setEntity] = useState<Entity>("faculty"),
    [raw, setRaw] = useState<RawRow[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [source, setSource] = useState(""),
    [target, setTarget] = useState(""),
    [copyAssignments, setCopyAssignments] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [lastBackup, setLastBackup] = useState(() =>
      readPreference("slss-last-backup"),
    );
  const fields = templateFields(entity),
    columns = Object.keys(raw[0] ?? {});
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  };
  async function makeBackup() {
    download(
      new Blob([backup(data)], { type: "application/json" }),
      `SLSS-${new Date().toISOString().slice(0, 10)}.backup.json`,
    );
    const at = new Date().toLocaleString();
    await db.meta.put({ key: "lastBackup", value: at });
    writePreference("slss-last-backup", at);
    setLastBackup(at);
    setMessage(
      "Backup download requested. Check your downloads and keep a separate copy.",
    );
  }
  async function loadFile(file: File) {
    const rows = await readSpreadsheet(file);
    if (!rows.length)
      throw new Error("This file has headers but no data rows.");
    setRaw(rows);
    setMapping(
      Object.fromEntries(
        fields.map((f) => [
          f,
          Object.keys(rows[0]).find(
            (k) => k.toLowerCase() === f.toLowerCase(),
          ) ?? "",
        ]),
      ),
    );
    setPreview(null);
  }
  return (
    <>
      <Panel
        title="Backups & local storage"
        action={
          <Badge tone={lastBackup ? "green" : "amber"}>
            {lastBackup ? `Last backup: ${lastBackup}` : "No backup recorded"}
          </Badge>
        }
      >
        <div className="padded">
          <div className="alert warning">
            Records belong to this browser on this device. They do not sync
            across devices. Clearing browser data or a device failure can erase
            records. Keep regular backups outside this browser, especially
            before finalizing a semester.
          </div>
          <div className="actions wrap">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void run(makeBackup)}
            >
              Download full JSON backup
            </button>
            <label className="file-button">
              Restore JSON backup
              <input
                type="file"
                accept=".json"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file)
                    void run(async () => {
                      if (file.size > 20 * 1024 * 1024)
                        throw new Error("Backup must be smaller than 20 MB.");
                      const restored = restore(await file.text());
                      if (
                        confirm(
                          `Replace all local records with this validated backup (${restored.offerings.length} offerings, ${restored.faculty.length} faculty)? Download a current backup first. This can be undone during this session.`,
                        )
                      ) {
                        if (
                          await replace(restored, "Restored full JSON backup")
                        )
                          setMessage("Backup restored successfully.");
                      }
                    });
                }}
              />
            </label>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (!navigator.storage?.persist) {
                    setMessage(
                      "Persistent storage is unavailable in this browser. Keep external backups.",
                    );
                    return;
                  }
                  const granted = await navigator.storage.persist();
                  setMessage(
                    granted
                      ? "Persistent storage granted. This reduces automatic eviction; it does not protect against clearing data or device failure."
                      : "Persistent storage was not granted. Records still save normally; keep external backups.",
                  );
                })
              }
            >
              Request persistent storage
            </button>
          </div>
          <p className="note">
            The last-backup indicator records a requested download, not a
            verified external copy. JSON backups contain all operational
            records; handle them privately.
          </p>
        </div>
      </Panel>
      <Panel title="Import Excel or CSV">
        <div className="padded">
          <p className="note">
            Import one entity at a time in dependency order. Use stable IDs from
            the reference export for relationships. XLSX reads the first
            worksheet; CSV uses UTF-8 and a header row. Maximum 5,000 rows / 10
            MB. Records are added only; duplicates are rejected.
          </p>
          <div className="toolbar wrap">
            <Field label="Import record type">
              <select
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value as Entity);
                  setRaw([]);
                  setPreview(null);
                  setMapping({});
                }}
              >
                {importEntities.map((key) => (
                  <option key={key} value={key}>
                    {labels[key]}
                  </option>
                ))}
              </select>
            </Field>
            <button
              onClick={() =>
                download(
                  new Blob([templateCSV(entity)], {
                    type: "text/csv;charset=utf-8",
                  }),
                  `SLSS-${entity}-template.csv`,
                )
              }
            >
              Download CSV template
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = referenceExport(data, entity);
                  await exportExcel(
                    `${labels[entity]} reference IDs`,
                    r.fields,
                    r.rows,
                    "Use IDs to link imported records",
                  );
                })
              }
            >
              Export records with IDs
            </button>
            <label className="file-button">
              Choose import file
              <input
                type="file"
                accept=".xlsx,.csv"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void run(() => loadFile(file));
                }}
              />
            </label>
          </div>
          {raw.length > 0 && (
            <>
              <h3>1. Map columns</h3>
              <p className="note">
                Blank ID mapping generates a unique ID. Booleans must use true
                or false. Days use 0 = Monday through 6 = Sunday. Time uses
                HH:MM.
              </p>
              <div className="mapping-grid">
                {fields.map((f) => (
                  <Field label={f} key={f}>
                    <select
                      value={mapping[f] ?? ""}
                      onChange={(e) => {
                        setMapping((m) => ({ ...m, [f]: e.target.value }));
                        setPreview(null);
                      }}
                    >
                      <option value="">
                        {f === "id" ? "Generate unique IDs" : "Not mapped"}
                      </option>
                      {columns.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              <button
                className="primary"
                onClick={() =>
                  setPreview(
                    previewImport(
                      data,
                      entity,
                      raw,
                      Object.fromEntries(
                        Object.entries(mapping).filter(([, v]) => v),
                      ),
                    ),
                  )
                }
              >
                Validate and preview {raw.length} rows
              </button>
            </>
          )}
          {preview && (
            <>
              <h3>2. Review proposed changes</h3>
              <p>
                {preview.added} valid new records · {preview.errors.length}{" "}
                rejected rows · no records overwritten
              </p>
              {preview.errors.length > 0 && (
                <div className="import-errors" role="status">
                  {preview.errors.map((e, i) => (
                    <p key={i}>
                      <strong>Row {e.row}:</strong> {e.message}
                    </p>
                  ))}
                </div>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {fields.map((f) => (
                        <th key={f}>{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      preview.data[entity] as unknown as Record<
                        string,
                        unknown
                      >[]
                    )
                      .slice(data[entity].length, data[entity].length + 20)
                      .map((r, i) => (
                        <tr key={i}>
                          {fields.map((f) => (
                            <td key={f}>{String(r[f])}</td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="note">
                Showing up to 20 proposed records. Rejected rows will be skipped
                only if you choose to commit valid rows below.
              </p>
              {preview.source !== data && (
                <ErrorMessage message="Records changed after this preview. Validate and preview again before importing." />
              )}
              <button
                className="primary"
                disabled={busy || !preview.added || preview.source !== data}
                onClick={() =>
                  void run(async () => {
                    if (
                      await commit(
                        preview.data,
                        `Imported ${preview.added} ${labels[entity].toLowerCase()} records`,
                      )
                    ) {
                      setMessage(
                        `Imported ${preview.added} valid records. ${preview.errors.length} rejected rows were skipped.`,
                      );
                      setPreview(null);
                      setRaw([]);
                    }
                  })
                }
              >
                Commit {preview.added} valid rows
                {preview.errors.length ? " (skip rejected rows)" : ""}
              </button>
            </>
          )}
        </div>
      </Panel>
      <Panel title="Copy a semester">
        <div className="padded">
          <p>
            Copy offerings into another semester. Optionally include faculty and
            weekly meetings. Duplicates and conflicts stop the entire operation.
          </p>
          <div className="toolbar wrap">
            <Reference
              data={data}
              entity="semesters"
              label="Source semester"
              value={source}
              onChange={setSource}
            />
            <Reference
              data={data}
              entity="semesters"
              label="Destination semester"
              value={target}
              onChange={setTarget}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={copyAssignments}
                onChange={(e) => setCopyAssignments(e.target.checked)}
              />
              Include assignments and meetings
            </label>
            <button
              className="primary"
              disabled={busy || !source || !target || source === target}
              onClick={() =>
                void run(async () => {
                  const next = duplicateSemester(
                    data,
                    source,
                    target,
                    copyAssignments,
                  );
                  if (
                    confirm(
                      `Copy ${data.offerings.filter((o) => o.semesterId === source).length} offerings to ${rowName(data, "semesters", target)}?`,
                    )
                  )
                    if (await commit(next, "Copied semester offerings"))
                      setMessage("Semester copied successfully.");
                })
              }
            >
              Copy semester
            </button>
          </div>
        </div>
      </Panel>
      <BscaSamplePanel data={data} commit={commit} />
      <Panel title="Optional sample dataset">
        <div className="padded">
          <p>
            Explore a small fictional Computer Science department. Sample
            faculty are explicitly labeled. Loading the sample is available only
            when the database has no academic records.
          </p>
          <button
            disabled={
              busy ||
              entities
                .filter(
                  (e) => !["workloadRules", "schedulingRules"].includes(e),
                )
                .some((e) => data[e].length > 0)
            }
            onClick={() =>
              void run(async () => {
                if (
                  await commit(
                    sampleData(),
                    "Loaded optional fictional sample dataset",
                  )
                )
                  setMessage(
                    "Sample loaded. Select First semester in the header.",
                  );
              })
            }
          >
            Load fictional sample data
          </button>
        </div>
      </Panel>
      {busy && <p role="status">Processing…</p>}
      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}
    </>
  );
}
