import { useDraft } from "../lib/drafts";
import { useState } from "react";
import type { Data } from "../lib/model";
import type { Commit } from "../lib/useStore";
import {
  buildForm3Import,
  formSheetNames,
  normalizeRoom,
  readForm3,
  type CourseMap,
  type FormOptions,
  type FormSource,
  type RoomMap,
} from "../lib/form3";
import { Badge, ErrorMessage, Field, Panel, Reference } from "./UI";
export function Form3Import({
  data,
  term,
  commit,
}: {
  data: Data;
  term: string;
  commit: Commit;
}) {
  const [file, setFile] = useState<File | null>(null),
    [sheets, setSheets] = useState<string[]>([]),
    [sheet, setSheet] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState<Data | null>(null),
    [base, setBase] = useState<Data | null>(null);
  const importDraft = useDraft<{
    source: FormSource | null;
    options: FormOptions;
    filename: string;
  }>(
    "form3-import",
    () => ({
      source: null,
      filename: "",
      options: {
        term,
        program: data.programs[0]?.id ?? "",
        maxLoad: 18,
        schedules: false,
        overloadsAsWarnings: true,
        confirmed: false,
        courses: {},
        rooms: {},
        years: {},
      },
    }),
    "Previous loading import",
    "#settings/import",
  );
  const { source, options } = importDraft.value;
  const setSource = (
    value: FormSource | null | ((old: FormSource | null) => FormSource | null),
  ) =>
    importDraft.setValue((old) => ({
      ...old,
      source: typeof value === "function" ? value(old.source) : value,
    }));
  const setOptions = (
    value: FormOptions | ((old: FormOptions) => FormOptions),
  ) =>
    importDraft.setValue((old) => ({
      ...old,
      options: typeof value === "function" ? value(old.options) : value,
    }));
  const [allCourses, setAllCourses] = useState(false),
    [allRows, setAllRows] = useState(false);
  function change(patch: Partial<FormOptions>) {
    setOptions((o) => ({ ...o, ...patch }));
    setPreview(null);
    setError("");
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to read this workbook.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function chooseSheet(value: string) {
    setSheet(value);
    setSource(null);
    setPreview(null);
    if (!file) return;
    await run(async () => {
      const parsed = await readForm3(file, value),
        courses: Record<string, CourseMap> = {},
        rooms: Record<string, RoomMap> = {},
        years: Record<string, string> = {};
      for (const line of parsed.lines.filter((l) => l.kind === "teaching")) {
        const matching = data.subjects.filter(
          (s) =>
            s.code.replaceAll(" ", "").toUpperCase() === line.course &&
            data.curricula.find((c) => c.id === s.curriculumId)?.programId ===
              options.program,
        );
        courses[line.course] = {
          subjectId: matching.length === 1 ? matching[0].id : "",
          name: "",
          units: "",
        };
        const room = data.rooms.find(
          (r) => normalizeRoom(r.code) === normalizeRoom(line.room),
        );
        if (line.room && line.room !== "-" && line.room.toUpperCase() !== "TBA")
          rooms[line.room] = {
            roomId: room?.id ?? "",
            capacity: room ? String(room.capacity) : "",
            type: line.component === "lab" ? "laboratory" : "classroom",
          };
        const block = line.block.split(".")[0],
          section = data.sections.find(
            (s) =>
              s.name.toUpperCase() === block.toUpperCase() &&
              s.programId === options.program,
          );
        years[block] = section ? String(section.yearLevel) : "";
      }
      setOptions((o) => ({ ...o, confirmed: false, courses, rooms, years }));
      setSource(parsed);
      importDraft.setValue((old) => ({ ...old, filename: file.name }));
    });
  }
  const selected = source?.lines.filter((l) => l.include) ?? [],
    codes = [
      ...new Set(
        selected.filter((l) => l.kind === "teaching").map((l) => l.course),
      ),
    ],
    blocks = [
      ...new Set(
        selected
          .filter((l) => l.kind === "teaching")
          .map((l) => l.block.split(".")[0]),
      ),
    ];
  const roomNames = [
    ...new Set(
      selected
        .filter(
          (l) =>
            l.kind === "teaching" &&
            l.room &&
            l.room !== "-" &&
            l.room.toUpperCase() !== "TBA",
        )
        .map((l) => l.room),
    ),
  ];
  const roomMaps: Record<string, RoomMap> = Object.fromEntries(
    roomNames.map((name) => {
      const existing = data.rooms.find(
        (r) => normalizeRoom(r.code) === normalizeRoom(name),
      );
      return [
        name,
        options.rooms[name] ?? {
          roomId: existing?.id ?? "",
          capacity: existing ? String(existing.capacity) : "",
          type:
            existing?.type ??
            (selected.some((l) => l.room === name && l.component === "lab")
              ? "laboratory"
              : "classroom"),
        },
      ];
    }),
  );
  const courseSubjects = data.subjects.filter(
    (s) =>
      data.curricula.find((c) => c.id === s.curriculumId)?.programId ===
      options.program,
  );
  function rowChange(index: number, key: string, value: unknown) {
    setSource((s) =>
      s
        ? {
            ...s,
            lines: s.lines.map((l, i) =>
              i === index ? { ...l, [key]: value } : l,
            ),
          }
        : s,
    );
    setPreview(null);
  }
  const target = data.semesters.find((t) => t.id === options.term),
    year = data.academicYears.find((y) => y.id === target?.academicYearId);
  return (
    <Panel
      title="Import your OVCAA Form 3 loading"
      action={<Badge>Private, on this browser</Badge>}
    >
      <div className="padded">
        <p className="note">
          Use your existing faculty loading form without retyping it. Choose one
          authoritative worksheet; plotting, hiring and copied alternatives are
          kept separate. Nothing is uploaded.
        </p>
        <div className="toolbar wrap">
          <label className="file-button">
            Choose Form 3 workbook
            <input
              type="file"
              accept=".xlsx"
              disabled={busy}
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                e.target.value = "";
                if (chosen)
                  void run(async () => {
                    setFile(chosen);
                    setSheet("");
                    setSource(null);
                    setPreview(null);
                    setSheets(await formSheetNames(chosen));
                  });
              }}
            />
          </label>
          {sheets.length > 0 && (
            <Field label="Loading worksheet">
              <select
                value={sheet || source?.sheet || ""}
                disabled={!file || busy}
                onChange={(e) => void chooseSheet(e.target.value)}
              >
                <option value="">Choose the version to import</option>
                {sheets.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <ErrorMessage message={error} />
        {busy && <p role="status">Reading and checking the workbook…</p>}
        {source && (
          <p className="draft-note">
            Import review kept in this tab. No records are added until you
            validate and choose Import reviewed loading.{" "}
            {importDraft.storageError &&
              "Draft storage is unavailable; finish before leaving this page."}
          </p>
        )}
        {source && (
          <>
            <div className="import-step">
              <h3>1. Confirm where this loading belongs</h3>
              <p className="note">
                File: {file?.name ?? importDraft.value.filename}
                <br />
                Worksheet: {source.sheet}
                <br />
                Printed term label:{" "}
                <strong>{source.header || "Not found"}</strong>. File names and
                printed labels can disagree; choose the destination
                deliberately.
              </p>
              <div className="form-grid">
                <Reference
                  data={data}
                  entity="semesters"
                  label="Destination semester"
                  value={options.term}
                  onChange={(v) => change({ term: v, confirmed: false })}
                />
                <Reference
                  data={data}
                  entity="programs"
                  label="Program for these offerings"
                  value={options.program}
                  onChange={(v) =>
                    change({
                      program: v,
                      confirmed: false,
                      courses: Object.fromEntries(
                        codes.map((code) => {
                          const matches = data.subjects.filter(
                            (s) =>
                              s.code.replaceAll(" ", "").toUpperCase() ===
                                code &&
                              data.curricula.find(
                                (c) => c.id === s.curriculumId,
                              )?.programId === v,
                          );
                          return [
                            code,
                            {
                              subjectId:
                                matches.length === 1 ? matches[0].id : "",
                              name: "",
                              units: "",
                            },
                          ];
                        }),
                      ),
                    })
                  }
                />
                <Field label="Default limit for newly imported faculty">
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={options.maxLoad}
                    onChange={(e) =>
                      change({ maxLoad: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <details>
                <summary>Match faculty names and initials</summary>
                <p className="note">
                  Exact existing names are reused. Match short names or aliases
                  to your existing roster to avoid duplicate faculty records.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source faculty</th>
                        <th>Rank in source</th>
                        <th>Existing roster match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {source.faculty.map((person) => (
                        <tr key={person.name}>
                          <td>{person.name}</td>
                          <td>{person.rank}</td>
                          <td>
                            <select
                              aria-label={`Faculty match ${person.name}`}
                              value={options.faculty?.[person.name] ?? ""}
                              onChange={(e) =>
                                change({
                                  faculty: {
                                    ...options.faculty,
                                    [person.name]: e.target.value,
                                  },
                                })
                              }
                            >
                              <option value="">
                                Reuse exact name or create source name
                              </option>
                              {data.faculty.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <label className="check">
                <input
                  type="checkbox"
                  checked={options.schedules}
                  onChange={(e) => change({ schedules: e.target.checked })}
                />
                Import room bookings and meeting times now
              </label>
              <p className="note">
                Unchecked: import load records only, retaining the original
                times/rooms as source notes for later scheduling. Checked: every
                included time, room and conflict must pass validation.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={options.overloadsAsWarnings}
                  onChange={(e) =>
                    change({ overloadsAsWarnings: e.target.checked })
                  }
                />
                Keep overloads as warnings in this destination semester
              </label>
              <p className="note">
                This retains reported loads for review and does not change the
                department’s default policy for other semesters.
              </p>
            </div>
            <div className="import-step">
              <h3>2. Match courses and confirm blocks</h3>
              <p className="note">
                Import teaching rows for one selected program at a time; exclude
                other-program rows and import those separately. Include shared
                faculty duties only once. Course units are not present in Form
                3. Match an existing catalog course, or enter its title and
                academic units. Imported group contact hours and reported
                credits are stored separately.
              </p>
              <p className="import-summary">
                {
                  codes.filter((code) => options.courses[code]?.subjectId)
                    .length
                }{" "}
                courses matched automatically ·{" "}
                {
                  codes.filter((code) => !options.courses[code]?.subjectId)
                    .length
                }{" "}
                need confirmed details.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={allCourses}
                  onChange={(e) => setAllCourses(e.target.checked)}
                />
                Show all courses, including automatic matches
              </label>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Catalog match</th>
                      <th>New course title</th>
                      <th>Course units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes
                      .filter(
                        (code) =>
                          allCourses || !options.courses[code]?.subjectId,
                      )
                      .map((code) => {
                        const map = options.courses[code] ?? {
                          subjectId: "",
                          name: "",
                          units: "",
                        };
                        return (
                          <tr key={code}>
                            <td>{code}</td>
                            <td>
                              <select
                                aria-label={`Catalog match ${code}`}
                                value={map.subjectId}
                                onChange={(e) =>
                                  change({
                                    courses: {
                                      ...options.courses,
                                      [code]: {
                                        ...map,
                                        subjectId: e.target.value,
                                      },
                                    },
                                  })
                                }
                              >
                                <option value="">
                                  Create from confirmed details
                                </option>
                                {courseSubjects
                                  .filter(
                                    (s) =>
                                      s.code
                                        .replaceAll(" ", "")
                                        .toUpperCase() === code,
                                  )
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.code} · {s.name} (
                                      {
                                        data.curricula.find(
                                          (c) => c.id === s.curriculumId,
                                        )?.name
                                      }
                                      )
                                    </option>
                                  ))}
                              </select>
                            </td>
                            <td>
                              {!map.subjectId && (
                                <input
                                  aria-label={`Course title ${code}`}
                                  value={map.name}
                                  onChange={(e) =>
                                    change({
                                      courses: {
                                        ...options.courses,
                                        [code]: {
                                          ...map,
                                          name: e.target.value,
                                        },
                                      },
                                    })
                                  }
                                />
                              )}
                            </td>
                            <td>
                              {!map.subjectId && (
                                <input
                                  aria-label={`Course units ${code}`}
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={map.units}
                                  onChange={(e) =>
                                    change({
                                      courses: {
                                        ...options.courses,
                                        [code]: {
                                          ...map,
                                          units: e.target.value,
                                        },
                                      },
                                    })
                                  }
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <div className="toolbar wrap">
                {blocks
                  .filter(
                    (b) =>
                      !data.sections.some(
                        (s) =>
                          s.programId === options.program &&
                          s.name.toUpperCase() === b.toUpperCase(),
                      ),
                  )
                  .map((b) => (
                    <Field
                      key={b}
                      label={`Year level for ${b || "missing block"}`}
                    >
                      <select
                        value={options.years[b] ?? ""}
                        onChange={(e) =>
                          change({
                            years: { ...options.years, [b]: e.target.value },
                          })
                        }
                      >
                        <option value="">Confirm year</option>
                        {[1, 2, 3, 4, 5, 6].map((y) => (
                          <option key={y}>{y}</option>
                        ))}
                      </select>
                    </Field>
                  ))}
              </div>
            </div>
            {options.schedules && (
              <div className="import-step">
                <h3>3. Confirm room details</h3>
                <p className="note">
                  Match spelling variations to the same room. Confirm actual
                  seating capacity and room type; student enrollment is not used
                  to guess room capacity. Review building/equipment later in
                  Rooms/Settings.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source room</th>
                        <th>Existing room</th>
                        <th>New room seats</th>
                        <th>New room type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(roomMaps).map(([name, map]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>
                            <select
                              aria-label={`Existing room ${name}`}
                              value={map.roomId}
                              onChange={(e) =>
                                change({
                                  rooms: {
                                    ...options.rooms,
                                    [name]: { ...map, roomId: e.target.value },
                                  },
                                })
                              }
                            >
                              <option value="">Create a room</option>
                              {data.rooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.code}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {!map.roomId && (
                              <input
                                aria-label={`Room capacity ${name}`}
                                type="number"
                                min="1"
                                value={map.capacity}
                                onChange={(e) =>
                                  change({
                                    rooms: {
                                      ...options.rooms,
                                      [name]: {
                                        ...map,
                                        capacity: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            )}
                          </td>
                          <td>
                            {!map.roomId && (
                              <select
                                aria-label={`Room type ${name}`}
                                value={map.type}
                                onChange={(e) =>
                                  change({
                                    rooms: {
                                      ...options.rooms,
                                      [name]: {
                                        ...map,
                                        type: e.target.value as RoomMap["type"],
                                      },
                                    },
                                  })
                                }
                              >
                                <option value="classroom">Classroom</option>
                                <option value="laboratory">Laboratory</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="import-step">
              <h3>{options.schedules ? "4" : "3"}. Review included rows</h3>
              <p className="note">
                {selected.length} of {source.lines.length} rows included.
                Correct values here or exclude rows from another plan. Credits
                remain marked as reported source values. Each separate
                laboratory group receives its own enrollment and instructor.
              </p>
              {!source.lines.some(
                (l) =>
                  !l.include ||
                  Boolean(l.problem) ||
                  !Number.isFinite(l.credit) ||
                  (l.kind === "teaching" && !l.students),
              ) && (
                <p className="alert success">
                  No row-level corrections flagged. Confirm course details and
                  the destination below; validation will still check the entire
                  import.
                </p>
              )}
              <p className="import-summary">
                Start with rows flagged for attention. Validation still checks
                every included row, including those hidden below.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={allRows}
                  onChange={(e) => setAllRows(e.target.checked)}
                />
                Show all source rows
              </label>
              <div className="table-wrap source-review">
                <table>
                  <thead>
                    <tr>
                      <th>Include</th>
                      <th>Row / faculty</th>
                      <th>Course or duty</th>
                      <th>Time</th>
                      <th>Days</th>
                      <th>Room</th>
                      <th>Students</th>
                      <th>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {source.lines
                      .map((l, i) => ({ l, i }))
                      .filter(
                        ({ l }) =>
                          allRows ||
                          !l.include ||
                          Boolean(l.problem) ||
                          !Number.isFinite(l.credit) ||
                          (l.kind === "teaching" && !l.students),
                      )
                      .map(({ l, i }) => (
                        <tr key={l.row}>
                          <td>
                            <input
                              aria-label={`Include source row ${l.row}`}
                              type="checkbox"
                              checked={l.include}
                              onChange={(e) =>
                                rowChange(i, "include", e.target.checked)
                              }
                            />
                          </td>
                          <td>
                            {l.row} · {l.faculty}
                          </td>
                          <td>
                            {l.label}
                            {l.problem && (
                              <small className="block danger-text">
                                Review original time/day: {l.problem}
                              </small>
                            )}
                          </td>
                          <td>
                            <input
                              aria-label={`Time row ${l.row}`}
                              value={l.time}
                              onChange={(e) =>
                                rowChange(i, "time", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Days row ${l.row}`}
                              value={l.day}
                              onChange={(e) =>
                                rowChange(i, "day", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Room row ${l.row}`}
                              value={l.room}
                              onChange={(e) =>
                                rowChange(i, "room", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            {l.kind === "teaching" && (
                              <input
                                aria-label={`Students row ${l.row}`}
                                type="number"
                                min="1"
                                value={l.students ?? ""}
                                onChange={(e) =>
                                  rowChange(
                                    i,
                                    "students",
                                    e.target.value
                                      ? Number(e.target.value)
                                      : undefined,
                                  )
                                }
                              />
                            )}
                          </td>
                          <td>
                            <input
                              aria-label={`Credit row ${l.row}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={!Number.isFinite(l.credit) ? "" : l.credit}
                              onChange={(e) =>
                                rowChange(
                                  i,
                                  "credit",
                                  e.target.value === ""
                                    ? NaN
                                    : Number(e.target.value),
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={options.confirmed}
                onChange={(e) => change({ confirmed: e.target.checked })}
              />
              I reviewed this worksheet and confirm the destination:{" "}
              {year?.name} · {target?.name}
            </label>
            <div className="actions wrap">
              <button
                className="primary"
                disabled={busy || !options.confirmed || !selected.length}
                onClick={() => {
                  try {
                    setError("");
                    setPreview(
                      buildForm3Import(data, source, {
                        ...options,
                        rooms: roomMaps,
                      }),
                    );
                    setBase(data);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Review the proposed records.",
                    );
                  }
                }}
              >
                Validate and preview loading
              </button>
            </div>
            {preview && (
              <div className="alert success">
                <strong>Ready to add:</strong>{" "}
                {preview.faculty.length - data.faculty.length} faculty,{" "}
                {preview.offerings.length - data.offerings.length} offerings,{" "}
                {preview.teachingGroups.length - data.teachingGroups.length}{" "}
                teaching groups,{" "}
                {preview.meetings.length - data.meetings.length} meetings and{" "}
                {preview.loadActivities.length - data.loadActivities.length}{" "}
                other duties. Existing records will not be overwritten.
                <div className="actions">
                  <button
                    className="primary"
                    disabled={busy || base !== data}
                    onClick={() =>
                      void run(async () => {
                        if (base !== data)
                          throw new Error(
                            "Records changed. Validate this preview again.",
                          );
                        if (
                          await commit(
                            preview,
                            `Imported reviewed Form 3 loading from ${source.sheet}`,
                          )
                        ) {
                          setPreview(null);
                          importDraft.clear();
                          setMessage(
                            "Loading imported. Open Loading & scheduling or Faculty loads to continue.",
                          );
                        }
                      })
                    }
                  >
                    Import reviewed loading
                  </button>
                </div>
                {base !== data && (
                  <p>
                    Records changed after preview. Validate again before
                    importing.
                  </p>
                )}
              </div>
            )}
          </>
        )}
        {message && (
          <div className="alert success" role="status">
            {message}
          </div>
        )}
      </div>
    </Panel>
  );
}
