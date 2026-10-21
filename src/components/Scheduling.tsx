import { GroupWorkspace } from "./GroupWorkspace";
import {
  assignOfferingFaculty,
  enableGroups,
  meetingAssignment,
  offeringComplete,
  groupLabel,
} from "../lib/loading";
import { useEffect, useMemo, useState } from "react";
import { days, offeringName, uid, type Data, type Row } from "../lib/model";
import { suggestions, validate, workload } from "../lib/engine";
import type { Commit } from "../lib/useStore";
import { Badge, Empty, Field, Panel, Reference } from "./UI";
import { RecordForm } from "./Records";
export function Timetable({
  data,
  meetings,
  onEdit,
}: {
  data: Data;
  meetings: Row<"meetings">[];
  onEdit?: (meeting: Row<"meetings">) => void;
}) {
  const enabled = [
    ...new Set([
      ...data.schedulingRules[0].days,
      ...meetings.map((m) => m.day),
    ]),
  ].sort();
  return (
    <div
      className="timetable"
      style={{
        gridTemplateColumns: `repeat(${enabled.length},minmax(145px,1fr))`,
      }}
    >
      {enabled.map((day) => (
        <section className="timetable-day" key={day}>
          <h3>{days[day]}</h3>
          <div className="day-entries">
            {meetings
              .filter((m) => m.day === day)
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((m) => {
                const faculty = data.faculty.find(
                  (f) => f.id === meetingAssignment(data, m)?.facultyId,
                );
                const content = (
                  <>
                    <span className="meeting-time">
                      {m.start} – {m.end}
                    </span>
                    <strong>{offeringName(data, m.offeringId)}</strong>
                    <span>
                      {groupLabel(data, m.groupId)} ·{" "}
                      {m.component === "lab" ? "Laboratory" : "Lecture"} ·{" "}
                      {data.rooms.find((r) => r.id === m.roomId)?.code}
                    </span>
                    <small>{faculty?.name ?? "Faculty unassigned"}</small>
                  </>
                );
                return onEdit ? (
                  <button
                    key={m.id}
                    className={`meeting ${m.component}`}
                    onClick={() => onEdit(m)}
                    aria-label={`Edit ${offeringName(data, m.offeringId)} ${days[day]} ${m.start}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={m.id} className={`meeting ${m.component}`}>
                    {content}
                  </div>
                );
              })}
            {!meetings.some((m) => m.day === day) && (
              <p className="quiet">No classes</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
function QuickRow({
  data,
  meeting,
  commit,
  selected,
  onSelect,
}: {
  data: Data;
  meeting: Row<"meetings">;
  commit: Commit;
  selected: boolean;
  onSelect: () => void;
}) {
  const [draft, setDraft] = useState(meeting);
  const assignment = meetingAssignment(data, meeting);
  const [faculty, setFaculty] = useState(assignment?.facultyId ?? "");
  const changed =
    JSON.stringify(draft) !== JSON.stringify(meeting) ||
    faculty !== (assignment?.facultyId ?? "");
  const set = (field: string, value: unknown) =>
    setDraft((d) => ({ ...d, [field]: value }));
  async function save() {
    const next = {
      ...data,
      meetings: data.meetings.map((m) => (m.id === meeting.id ? draft : m)),
    };
    if (faculty !== (assignment?.facultyId ?? "")) {
      next.assignments = next.assignments.filter(
        (a) =>
          !(
            a.offeringId === meeting.offeringId && a.groupId === meeting.groupId
          ),
      );
      if (faculty)
        next.assignments.push({
          id: assignment?.id ?? uid(),
          offeringId: meeting.offeringId,
          groupId: meeting.groupId,
          facultyId: faculty,
        });
    }
    await commit(
      next,
      `Quick edited ${offeringName(data, meeting.offeringId)}`,
    );
  }
  return (
    <tr
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void save();
        }
        if (e.key === "Escape") {
          setDraft(meeting);
          setFaculty(assignment?.facultyId ?? "");
        }
      }}
    >
      <td>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${offeringName(data, meeting.offeringId)} ${meeting.start}`}
        />
      </td>
      <td>
        <strong>{offeringName(data, meeting.offeringId)}</strong>
        <small className="block">
          {meeting.component} · {groupLabel(data, meeting.groupId)}
        </small>
      </td>
      <td>
        <select
          aria-label="Meeting faculty"
          value={faculty}
          onChange={(e) => setFaculty(e.target.value)}
        >
          <option value="">Unassigned</option>
          {data.faculty.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          aria-label="Meeting day"
          value={draft.day}
          onChange={(e) => set("day", Number(e.target.value))}
        >
          {days.map((d, i) => (
            <option value={i} key={d}>
              {d}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="time"
          aria-label="Meeting start"
          value={draft.start}
          onChange={(e) => set("start", e.target.value)}
        />
      </td>
      <td>
        <input
          type="time"
          aria-label="Meeting end"
          value={draft.end}
          onChange={(e) => set("end", e.target.value)}
        />
      </td>
      <td>
        <select
          aria-label="Meeting room"
          value={draft.roomId}
          onChange={(e) => set("roomId", e.target.value)}
        >
          {data.rooms
            .filter((r) => r.active || r.id === draft.roomId)
            .map((r) => (
              <option value={r.id} key={r.id}>
                {r.code}
              </option>
            ))}
        </select>
      </td>
      <td>
        <button disabled={!changed} onClick={() => void save()}>
          Save row
        </button>
        {changed && <small className="block">Unsaved</small>}
      </td>
    </tr>
  );
}
export function Scheduling({
  data,
  term,
  commit,
  initialMode = "guided",
}: {
  data: Data;
  term: string;
  commit: Commit;
  initialMode?: string;
}) {
  const [mode, setMode] = useState(
      initialMode === "new" ? "guided" : initialMode,
    ),
    [offeringId, setOfferingId] = useState(""),
    [facultyId, setFacultyId] = useState(""),
    [search, setSearch] = useState(""),
    [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [program, setProgram] = useState(""),
    [faculty, setFaculty] = useState(""),
    [section, setSection] = useState(""),
    [room, setRoom] = useState(""),
    [subject, setSubject] = useState("");
  const [meeting, setMeeting] = useState<
      Record<string, unknown> | null | undefined
    >(),
    [addingOffering, setAddingOffering] = useState(initialMode === "new"),
    [selected, setSelected] = useState<string[]>([]),
    [bulkFaculty, setBulkFaculty] = useState(""),
    [bulkRoom, setBulkRoom] = useState(""),
    [bulkDay, setBulkDay] = useState("");
  const [fillUnassigned, setFillUnassigned] = useState(true);
  const [component, setComponent] = useState<"lecture" | "lab">("lecture"),
    [duration, setDuration] = useState(60),
    [showSuggestions, setShowSuggestions] = useState(false);
  useEffect(() => {
    if (meeting !== undefined || addingOffering)
      document
        .querySelector(".editor-panel")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [meeting, addingOffering]);
  const offerings = useMemo(
    () =>
      data.offerings.filter(
        (o) =>
          o.semesterId === term &&
          (!program ||
            data.sections.find((s) => s.id === o.sectionId)?.programId ===
              program) &&
          (!faculty ||
            data.assignments.some(
              (a) => a.offeringId === o.id && a.facultyId === faculty,
            )) &&
          (!section || o.sectionId === section) &&
          (!subject || o.subjectId === subject) &&
          (!room ||
            data.meetings.some(
              (m) => m.offeringId === o.id && m.roomId === room,
            )) &&
          (!onlyUnassigned || !offeringComplete(data, o.id)) &&
          offeringName(data, o.id).toLowerCase().includes(search.toLowerCase()),
      ),
    [
      data,
      term,
      program,
      faculty,
      section,
      subject,
      room,
      onlyUnassigned,
      search,
    ],
  );
  const ids = new Set(offerings.map((o) => o.id));
  const meetings = data.meetings.filter(
    (m) =>
      ids.has(m.offeringId) &&
      (!room || m.roomId === room) &&
      (!faculty || meetingAssignment(data, m)?.facultyId === faculty),
  );
  const activeOffering = data.offerings.find(
    (o) => o.id === offeringId && o.semesterId === term,
  );
  const assigned = data.assignments.find((a) => a.offeringId === offeringId);
  const issues = useMemo(() => validate(data, term), [data, term]);
  async function assign(
    ids: string[],
    facultyId: string,
    onlyUnassigned = false,
  ) {
    if (!ids.length || !facultyId) return;
    await commit(
      assignOfferingFaculty(data, ids, facultyId, onlyUnassigned),
      `Assigned faculty to ${ids.length} filtered offering(s)`,
    );
  }
  const bulkTargetCount = offerings.reduce((sum, o) => {
    const groups = data.teachingGroups.filter((g) => g.offeringId === o.id);
    return (
      sum +
      (groups.length
        ? groups.filter(
            (g) =>
              !fillUnassigned ||
              !data.assignments.some((a) => a.groupId === g.id),
          ).length
        : !fillUnassigned ||
            !data.assignments.some((a) => a.offeringId === o.id)
          ? 1
          : 0)
    );
  }, 0);
  async function saveMeeting(row: Record<string, unknown>) {
    const next = structuredClone(data),
      m = row as unknown as Row<"meetings">;
    const index = next.meetings.findIndex((n) => n.id === m.id);
    if (index < 0) next.meetings.push(m);
    else next.meetings[index] = m;
    if (
      await commit(
        next,
        `Saved meeting for ${offeringName(data, m.offeringId)}`,
      )
    ) {
      setMeeting(undefined);
      setShowSuggestions(false);
      return true;
    }
    return false;
  }
  async function removeMeeting(id: string) {
    if (!confirm("Remove this class meeting? You can undo this change."))
      return;
    await commit(
      { ...data, meetings: data.meetings.filter((m) => m.id !== id) },
      "Removed class meeting",
    );
  }
  const recommendations = useMemo(
    () =>
      showSuggestions ? suggestions(data, offeringId, component, duration) : [],
    [data, offeringId, component, duration, showSuggestions],
  );
  return (
    <>
      <div className="tabs" role="group" aria-label="Scheduling workflow">
        {[
          ["guided", "Guided assignment"],
          ["quick", "Quick edit"],
          ["timetable", "Weekly timetable"],
          ["issues", "Review & conflicts"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={mode === key ? "active" : ""}
            onClick={() => setMode(key)}
            aria-pressed={mode === key}
          >
            {label}
            {key === "issues" && <span className="count">{issues.length}</span>}
          </button>
        ))}
      </div>
      <div className="toolbar wrap">
        <Field label="Search offerings">
          <input
            type="search"
            placeholder="Subject or section…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <details className="filter-disclosure">
          <summary>More filters</summary>
          <div className="toolbar wrap">
            {" "}
            <Reference
              data={data}
              entity="programs"
              label="Program"
              value={program}
              onChange={setProgram}
              empty="All programs"
            />
            <Reference
              data={data}
              entity="faculty"
              label="Faculty"
              value={faculty}
              onChange={setFaculty}
              empty="All faculty"
            />
            <Reference
              data={data}
              entity="sections"
              label="Section"
              value={section}
              onChange={setSection}
              empty="All sections"
            />
            <Reference
              data={data}
              entity="subjects"
              label="Subject"
              value={subject}
              onChange={setSubject}
              empty="All subjects"
            />
            <Reference
              data={data}
              entity="rooms"
              label="Room"
              value={room}
              onChange={setRoom}
              empty="All rooms"
            />
          </div>
        </details>
      </div>
      {mode === "guided" && (
        <>
          <div className="split scheduling-split">
            <Panel
              title={`Subject offerings (${offerings.length})`}
              action={
                <button
                  className="primary"
                  onClick={() => setAddingOffering(true)}
                >
                  + Add offering
                </button>
              }
            >
              <label className="check padded">
                <input
                  type="checkbox"
                  checked={onlyUnassigned}
                  onChange={(e) => setOnlyUnassigned(e.target.checked)}
                />
                Unassigned only
              </label>
              <div className="offering-list">
                {offerings.map((o) => {
                  const a = data.assignments.find((a) => a.offeringId === o.id),
                    f = data.faculty.find((f) => f.id === a?.facultyId);
                  return (
                    <button
                      className={`offering-item ${o.id === offeringId ? "selected" : ""}`}
                      key={o.id}
                      onClick={() => {
                        setOfferingId(o.id);
                        setFacultyId(a?.facultyId ?? "");
                        setShowSuggestions(false);
                      }}
                    >
                      <span>
                        <strong>{offeringName(data, o.id)}</strong>
                        <small>
                          {
                            data.subjects.find((s) => s.id === o.subjectId)
                              ?.name
                          }
                        </small>
                      </span>
                      <Badge
                        tone={offeringComplete(data, o.id) ? "green" : "amber"}
                      >
                        {offeringComplete(data, o.id)
                          ? data.teachingGroups.some(
                              (g) => g.offeringId === o.id,
                            )
                            ? "Groups assigned"
                            : f?.name
                          : "Needs faculty"}
                      </Badge>
                    </button>
                  );
                })}
                {!offerings.length && (
                  <Empty title="No offerings found">
                    Add an offering or adjust your filters.
                  </Empty>
                )}
              </div>
            </Panel>
            <Panel
              title={
                activeOffering
                  ? offeringName(data, offeringId)
                  : "Assignment workspace"
              }
              action={
                activeOffering && (
                  <button
                    disabled={
                      !offerings.some(
                        (o) =>
                          o.id !== offeringId &&
                          (!offeringComplete(data, o.id) ||
                            issues.some(
                              (i) =>
                                i.offeringId === o.id &&
                                i.code === "contact-hours",
                            )),
                      )
                    }
                    onClick={() => {
                      const next = offerings.find(
                        (o) =>
                          o.id !== offeringId &&
                          (!offeringComplete(data, o.id) ||
                            issues.some(
                              (i) =>
                                i.offeringId === o.id &&
                                i.code === "contact-hours",
                            )),
                      );
                      if (next) {
                        setOfferingId(next.id);
                        setFacultyId(
                          data.assignments.find((a) => a.offeringId === next.id)
                            ?.facultyId ?? "",
                        );
                        setShowSuggestions(false);
                      }
                    }}
                  >
                    Next offering needing work →
                  </button>
                )
              }
            >
              {activeOffering ? (
                data.teachingGroups.some((g) => g.offeringId === offeringId) ? (
                  <GroupWorkspace
                    data={data}
                    offeringId={offeringId}
                    commit={commit}
                  />
                ) : (
                  <div className="padded">
                    <button
                      className="setup-groups"
                      onClick={() =>
                        void commit(
                          enableGroups(data, offeringId),
                          "Set up separate lecture and lab groups",
                        )
                      }
                    >
                      Set up lecture & lab groups →
                    </button>
                    <p className="note">
                      Choose faculty, then add one or more lecture and
                      laboratory meetings. Valid changes save locally.
                    </p>
                    <Reference
                      data={data}
                      entity="faculty"
                      label="Faculty member"
                      value={facultyId}
                      onChange={setFacultyId}
                      empty="Choose faculty"
                    />
                    <div className="faculty-hints">
                      {data.faculty
                        .filter((f) => f.active)
                        .map((f) => (
                          <span key={f.id}>
                            {f.name}:{" "}
                            <strong>
                              {workload(data, f.id, term)} / {f.maxLoad}
                            </strong>{" "}
                            units
                          </span>
                        ))}
                    </div>
                    <div className="actions">
                      <button
                        className="primary"
                        disabled={!facultyId}
                        onClick={() => void assign([offeringId], facultyId)}
                      >
                        {assigned ? "Update faculty" : "Assign faculty"}
                      </button>
                      {assigned && (
                        <button
                          onClick={() =>
                            void commit(
                              {
                                ...data,
                                assignments: data.assignments.filter(
                                  (a) => a.offeringId !== offeringId,
                                ),
                              },
                              `Unassigned ${offeringName(data, offeringId)}`,
                            )
                          }
                        >
                          Unassign
                        </button>
                      )}
                    </div>
                    <hr />
                    <div className="panel-heading">
                      <h3>Weekly meetings</h3>
                      <button
                        onClick={() =>
                          setMeeting({
                            id: uid(),
                            offeringId,
                            component: "lecture",
                            day: 0,
                            start: "08:00",
                            end: "09:00",
                            roomId: "",
                          })
                        }
                      >
                        + Add meeting
                      </button>
                    </div>
                    {data.meetings
                      .filter((m) => m.offeringId === offeringId)
                      .map((m) => (
                        <div className="meeting-row" key={m.id}>
                          <span>
                            <strong>
                              {days[m.day]} {m.start}–{m.end}
                            </strong>
                            <small>
                              {m.component} ·{" "}
                              {data.rooms.find((r) => r.id === m.roomId)?.code}
                            </small>
                          </span>
                          <div className="actions">
                            <button onClick={() => setMeeting({ ...m })}>
                              Edit
                            </button>
                            <button
                              onClick={() => setMeeting({ ...m, id: uid() })}
                            >
                              Duplicate
                            </button>
                            <button
                              className="danger-text"
                              onClick={() => void removeMeeting(m.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    <hr />
                    <h3>Find a suitable schedule</h3>
                    <div className="toolbar">
                      <Field label="Component">
                        <select
                          value={component}
                          onChange={(e) => {
                            setComponent(e.target.value as "lecture" | "lab");
                            setShowSuggestions(false);
                          }}
                        >
                          <option value="lecture">Lecture</option>
                          <option value="lab">Laboratory</option>
                        </select>
                      </Field>
                      <Field label="Duration (minutes)">
                        <input
                          type="number"
                          min="15"
                          max="720"
                          step="15"
                          value={duration}
                          onChange={(e) => {
                            setDuration(Number(e.target.value));
                            setShowSuggestions(false);
                          }}
                        />
                      </Field>
                      <button
                        disabled={duration < 15 || duration > 720}
                        onClick={() => setShowSuggestions(true)}
                      >
                        Suggest times
                      </button>
                    </div>
                    {showSuggestions &&
                      (recommendations.length ? (
                        recommendations.map((m, i) => (
                          <button
                            className="suggestion"
                            key={i}
                            onClick={() => setMeeting({ ...m, id: uid() })}
                          >
                            {days[m.day]} {m.start}–{m.end} ·{" "}
                            {data.rooms.find((r) => r.id === m.roomId)?.code}
                            <span>Review →</span>
                          </button>
                        ))
                      ) : (
                        <p className="note">
                          No valid slots found. Review availability, faculty
                          load, or try a shorter meeting.
                        </p>
                      ))}
                  </div>
                )
              ) : (
                <Empty title="Select an offering">
                  Choose a subject and section on the left to assign faculty and
                  schedule classes.
                </Empty>
              )}
            </Panel>
          </div>
        </>
      )}
      {mode === "quick" && (
        <>
          <Panel title="Bulk faculty assignment">
            <div className="padded">
              <p>
                {bulkTargetCount} assignment targets in {offerings.length}{" "}
                filtered offerings. Fill missing assignments first, or
                explicitly choose to replace existing ones.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={fillUnassigned}
                  onChange={(e) => setFillUnassigned(e.target.checked)}
                />
                Fill unassigned groups only
              </label>
              <div className="toolbar">
                <Reference
                  data={data}
                  entity="faculty"
                  label="Assign faculty"
                  value={bulkFaculty}
                  onChange={setBulkFaculty}
                />
                <button
                  className="primary"
                  disabled={!bulkFaculty || !bulkTargetCount}
                  onClick={() => {
                    if (
                      confirm(
                        `Assign this faculty member to ${bulkTargetCount} ${fillUnassigned ? "unassigned" : "selected"} groups or whole offerings?`,
                      )
                    )
                      void assign(
                        offerings.map((o) => o.id),
                        bulkFaculty,
                        fillUnassigned,
                      );
                  }}
                >
                  Apply to filtered offerings
                </button>
              </div>
            </div>
          </Panel>
          <Panel title="Meeting quick edit">
            <div className="padded">
              <p className="note">
                Tab between cells. Save each row or press Ctrl/⌘ + Enter. Escape
                resets the row. Each save is validated before it is stored.
                Faculty changes apply to all meetings for the same group.
              </p>
              <div className="toolbar wrap">
                <Badge>
                  {
                    selected.filter((id) => meetings.some((m) => m.id === id))
                      .length
                  }{" "}
                  selected
                </Badge>
                <Reference
                  data={data}
                  entity="rooms"
                  label="Bulk room"
                  value={bulkRoom}
                  onChange={setBulkRoom}
                  empty="Keep rooms"
                />
                <Field label="Bulk day">
                  <select
                    value={bulkDay}
                    onChange={(e) => setBulkDay(e.target.value)}
                  >
                    <option value="">Keep days</option>
                    {days.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  disabled={!selected.length || (!bulkRoom && bulkDay === "")}
                  onClick={() =>
                    void commit(
                      {
                        ...data,
                        meetings: data.meetings.map((m) =>
                          selected.includes(m.id) &&
                          meetings.some((n) => n.id === m.id)
                            ? {
                                ...m,
                                roomId: bulkRoom || m.roomId,
                                day: bulkDay === "" ? m.day : Number(bulkDay),
                              }
                            : m,
                        ),
                      },
                      "Bulk edited selected meetings",
                    )
                  }
                >
                  Apply changes
                </button>
                <button
                  className="danger-text"
                  disabled={!selected.length}
                  onClick={() => {
                    if (confirm("Delete selected visible meetings?"))
                      void commit(
                        {
                          ...data,
                          meetings: data.meetings.filter(
                            (m) =>
                              !selected.includes(m.id) ||
                              !meetings.some((n) => n.id === m.id),
                          ),
                        },
                        "Removed selected meetings",
                      );
                  }}
                >
                  Delete selected
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        aria-label="Select all visible meetings"
                        type="checkbox"
                        checked={
                          meetings.length > 0 &&
                          meetings.every((m) => selected.includes(m.id))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? meetings.map((m) => m.id) : [],
                          )
                        }
                      />
                    </th>
                    <th>Offering / group</th>
                    <th>Faculty</th>
                    <th>Day</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Room</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((m) => (
                    <QuickRow
                      key={`${m.id}-${JSON.stringify(m)}-${meetingAssignment(data, m)?.facultyId ?? ""}`}
                      data={data}
                      meeting={m}
                      commit={commit}
                      selected={selected.includes(m.id)}
                      onSelect={() =>
                        setSelected((s) =>
                          s.includes(m.id)
                            ? s.filter((id) => id !== m.id)
                            : [...s, m.id],
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {!meetings.length && (
              <Empty title="No scheduled meetings">
                Add meetings using Guided assignment.
              </Empty>
            )}
          </Panel>
        </>
      )}
      {mode === "timetable" && (
        <Panel
          title="Weekly timetable"
          action={<Badge>Lecture · green / Laboratory · blue</Badge>}
        >
          <p className="padded note">
            Select any class to edit. Use the faculty, section, or room filters
            for an individual timetable. Times use the 24-hour clock.
          </p>
          <Timetable
            data={data}
            meetings={meetings}
            onEdit={(m) => setMeeting({ ...m })}
          />
        </Panel>
      )}
      {mode === "issues" && (
        <Panel title="Schedule review">
          {issues.length ? (
            issues.map((issue, i) => (
              <div className={`issue ${issue.severity}`} key={i}>
                <Badge tone={issue.severity === "error" ? "red" : "amber"}>
                  {issue.severity === "error" ? "Blocking" : "Review"}
                </Badge>
                <span>{issue.message}</span>
                {issue.offeringId && (
                  <button
                    onClick={() => {
                      setOfferingId(issue.offeringId!);
                      setFacultyId(
                        data.assignments.find(
                          (a) => a.offeringId === issue.offeringId,
                        )?.facultyId ?? "",
                      );
                      setMode("guided");
                    }}
                  >
                    Resolve
                  </button>
                )}
              </div>
            ))
          ) : (
            <Empty title="All checks passed">
              No conflicts or incomplete assignments in this semester.
            </Empty>
          )}
        </Panel>
      )}
      {meeting !== undefined && (
        <section className="editor-panel" aria-label="Meeting editor">
          <RecordForm
            key={String(meeting?.id ?? "new")}
            data={data}
            entity="meetings"
            initial={meeting ?? undefined}
            onSave={saveMeeting}
            onCancel={() => setMeeting(undefined)}
          />
          <p className="note">
            Need another room or time? Use Find a suitable schedule in Guided
            assignment. Blocking errors appear at the top of the page.
          </p>
        </section>
      )}
      {addingOffering && (
        <section className="editor-panel">
          <RecordForm
            data={data}
            entity="offerings"
            initial={{
              id: uid(),
              semesterId: term,
              subjectId: "",
              sectionId: "",
            }}
            onSave={async (row) => {
              if (
                await commit(
                  {
                    ...data,
                    offerings: [
                      ...data.offerings,
                      row as unknown as Row<"offerings">,
                    ],
                  },
                  "Added subject offering",
                )
              ) {
                setAddingOffering(false);
                setOfferingId(String(row.id));
                return true;
              }
              return false;
            }}
            onCancel={() => setAddingOffering(false)}
          />
        </section>
      )}
    </>
  );
}
