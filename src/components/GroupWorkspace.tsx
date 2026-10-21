import { useState, type FormEvent } from "react";
import { days, uid, type Data, type Row } from "../lib/model";
import { availableRooms, minutes, suggestions, workload } from "../lib/engine";
import { groupCredits, splitLab } from "../lib/loading";
import type { Commit } from "../lib/useStore";
import { Badge, DaySelect, ErrorMessage, Field, Select } from "./UI";

function MeetingPlanner({
  data,
  group,
  commit,
}: {
  data: Data;
  group: Row<"teachingGroups">;
  commit: Commit;
}) {
  const o = data.offerings.find((o) => o.id === group.offeringId)!,
    subject = data.subjects.find((s) => s.id === o.subjectId)!;
  const [day, setDay] = useState(0),
    [start, setStart] = useState("08:00"),
    [end, setEnd] = useState("09:00"),
    [roomId, setRoomId] = useState(""),
    [moreDays, setMoreDays] = useState<number[]>([]),
    [options, setOptions] = useState<Omit<Row<"meetings">, "id">[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rooms = availableRooms(data, {
    semesterId: o.semesterId,
    day,
    start,
    end,
    size: group.students,
    type: group.component === "lab" ? "laboratory" : "",
    equipment: subject.equipment,
  });
  const own = data.meetings.filter((m) => m.groupId === group.id),
    hours = own.reduce(
      (sum, m) => sum + (minutes(m.end) - minutes(m.start)) / 60,
      0,
    );
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!roomId) throw new Error("Choose an available room first.");
      const meetings = [...new Set([day, ...moreDays])].map((day) => ({
        id: uid(),
        offeringId: o.id,
        groupId: group.id,
        component: group.component,
        roomId,
        day,
        start,
        end,
      }));
      if (
        await commit(
          { ...data, meetings: [...data.meetings, ...meetings] },
          `Scheduled ${group.name}`,
        )
      ) {
        setOptions([]);
        setMoreDays([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to schedule.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="group-meetings">
      <div className="group-heading">
        <h3>Weekly meetings</h3>
        <Badge
          tone={
            Math.abs(hours - group.contactHours) < 0.001 ? "green" : "amber"
          }
        >
          {hours} / {group.contactHours} hours
        </Badge>
      </div>
      {own.map((m) => (
        <div className="meeting-row" key={m.id}>
          <span>
            <strong>
              {days[m.day]} {m.start}–{m.end}
            </strong>
            <small>{data.rooms.find((r) => r.id === m.roomId)?.code}</small>
          </span>
          <button
            className="danger-text"
            onClick={() => {
              if (confirm("Remove this meeting? Undo remains available."))
                void commit(
                  {
                    ...data,
                    meetings: data.meetings.filter((n) => n.id !== m.id),
                  },
                  "Removed group meeting",
                );
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <form onSubmit={save}>
        <p className="note">
          Choose a time to see rooms that fit this group. Add several days in
          one save.
        </p>
        <div className="form-grid">
          <DaySelect value={day} onChange={setDay} />
          <Field label="Start time">
            <input
              type="time"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="End time">
            <input
              type="time"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <Field label="Available room">
            <select
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">
                {rooms.length
                  ? "Choose a room"
                  : "No suitable rooms at this time"}
              </option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.capacity} seats
                </option>
              ))}
            </select>
          </Field>
        </div>
        <details>
          <summary>Repeat on other days</summary>
          <div className="day-checks">
            {data.schedulingRules[0].days
              .filter((n) => n !== day)
              .map((n) => (
                <label className="check" key={n}>
                  <input
                    type="checkbox"
                    checked={moreDays.includes(n)}
                    onChange={(e) =>
                      setMoreDays((d) =>
                        e.target.checked ? [...d, n] : d.filter((x) => x !== n),
                      )
                    }
                  />
                  {days[n]}
                </label>
              ))}
          </div>
          <p className="note">
            Every selected day is checked for faculty, student and room
            conflicts when saved.
          </p>
        </details>
        <ErrorMessage message={error} />
        <div className="actions wrap">
          <button
            className="primary"
            disabled={busy || !rooms.some((r) => r.id === roomId)}
          >
            Save meeting{moreDays.length ? "s" : ""}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setOptions(
                suggestions(
                  data,
                  o.id,
                  group.component,
                  Math.max(
                    30,
                    Math.min(
                      180,
                      Math.round((group.contactHours - hours || 1) * 60),
                    ),
                  ),
                  group.id,
                ),
              )
            }
          >
            Suggest available times
          </button>
        </div>
      </form>
      {options.map((m, i) => (
        <button
          className="suggestion"
          key={i}
          onClick={() => {
            setDay(m.day);
            setStart(m.start);
            setEnd(m.end);
            setRoomId(m.roomId);
            setOptions([]);
          }}
        >
          {days[m.day]} {m.start}–{m.end} ·{" "}
          {data.rooms.find((r) => r.id === m.roomId)?.code}
          <span>Use this time</span>
        </button>
      ))}
    </div>
  );
}
function GroupCard({
  data,
  group,
  commit,
}: {
  data: Data;
  group: Row<"teachingGroups">;
  commit: Commit;
}) {
  const assignment = data.assignments.find((a) => a.groupId === group.id),
    term = data.offerings.find((o) => o.id === group.offeringId)!.semesterId;
  const [draft, setDraft] = useState(group),
    [faculty, setFaculty] = useState(assignment?.facultyId ?? ""),
    [override, setOverride] = useState(group.creditedLoad !== undefined),
    [showTimes, setShowTimes] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const proposed = {
      ...draft,
      creditedLoad: override ? (draft.creditedLoad ?? 0) : undefined,
    },
    credit = groupCredits(data, proposed);
  const dirty =
    JSON.stringify(proposed) !== JSON.stringify(group) ||
    faculty !== (assignment?.facultyId ?? "");
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const next = structuredClone(data);
      next.teachingGroups = next.teachingGroups.map((g) =>
        g.id === group.id ? proposed : g,
      );
      next.assignments = next.assignments.filter((a) => a.groupId !== group.id);
      if (faculty)
        next.assignments.push({
          id: assignment?.id ?? uid(),
          offeringId: group.offeringId,
          groupId: group.id,
          facultyId: faculty,
        });
      await commit(next, `Updated ${group.name} faculty and load`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="group-card">
      <div className="group-heading">
        <h3>{group.name}</h3>
        <Badge tone={assignment ? "green" : "amber"}>
          {assignment ? "Faculty assigned" : "Choose faculty"}
        </Badge>
      </div>
      <form onSubmit={save}>
        <fieldset disabled={busy} className="group-fieldset">
          <div className="form-grid">
            <Select
              options={data.faculty
                .filter(
                  (f) =>
                    f.id === faculty ||
                    (f.active &&
                      !data.loadActivities.some(
                        (a) =>
                          a.semesterId === term &&
                          a.facultyId === f.id &&
                          a.kind === "leave",
                      )),
                )
                .map((f) => ({
                  id: f.id,
                  name: `${f.name} · ${workload(data, f.id, term).toFixed(2)} / ${f.maxLoad} units`,
                }))
                .sort(
                  (a, b) =>
                    workload(data, a.id, term) - workload(data, b.id, term),
                )}
              label="Faculty for this group"
              value={faculty}
              onChange={setFaculty}
              empty="Unassigned"
            />
            <Field label="Students in this group">
              <input
                type="number"
                min="1"
                required
                value={draft.students}
                onChange={(e) =>
                  setDraft({ ...draft, students: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Weekly contact hours">
              <input
                type="number"
                min="0"
                step="0.25"
                required
                value={draft.contactHours}
                onChange={(e) =>
                  setDraft({ ...draft, contactHours: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <details>
            <summary>
              Load credit and source details · {credit.toFixed(2)} units
            </summary>
            <div className="form-grid">
              <Field label="Load category">
                <select
                  value={draft.loadCategoryId ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      loadCategoryId: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">Department default factor</option>
                  {data.loadCategories
                    .filter(
                      (c) =>
                        c.component === "any" ||
                        c.component === group.component,
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · factor {c.factor}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Group name">
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />
              Use a reported or approved credit instead of a factor
            </label>
            {override && (
              <div className="form-grid">
                <Field label="Credited load units">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={draft.creditedLoad ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        creditedLoad: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Credit source or reason">
                  <input
                    required
                    value={draft.creditReason}
                    onChange={(e) =>
                      setDraft({ ...draft, creditReason: e.target.value })
                    }
                  />
                </Field>
              </div>
            )}
            {group.sourceNote && <p className="note">{group.sourceNote}</p>}
            <p className="note">
              Category factors are editable under Settings → Load credit
              categories. A reported credit is retained as an explicit override,
              with its source.
            </p>
          </details>
          {faculty && (
            <p className="load-preview">
              Resulting faculty total:{" "}
              <strong>
                {(
                  workload(data, faculty, term) -
                  (assignment?.facultyId === faculty
                    ? groupCredits(data, group)
                    : 0) +
                  credit
                ).toFixed(2)}
              </strong>{" "}
              / {data.faculty.find((f) => f.id === faculty)?.maxLoad} units ·
              this group {credit.toFixed(2)}
            </p>
          )}
          <ErrorMessage message={error} />
          <div className="actions wrap">
            <button className="primary" disabled={busy || !dirty}>
              Save group
            </button>
            <button
              type="button"
              disabled={dirty}
              onClick={() => setShowTimes(!showTimes)}
            >
              {showTimes ? "Hide meetings" : "Schedule this group"}
            </button>
            {group.component === "lab" && (
              <button
                type="button"
                disabled={busy || dirty || group.students < 2}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await commit(
                      splitLab(data, group.id),
                      "Split laboratory enrollment into two groups",
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Unable to split.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Split lab into two
              </button>
            )}
          </div>
          {dirty && (
            <p className="note">
              Unsaved changes. Save this group before leaving this offering or
              scheduling it.
            </p>
          )}
          <details className="group-remove">
            <summary>Remove this group</summary>
            <p className="note">
              This removes this group’s faculty assignment and meetings. Other
              groups are kept. You can undo the change.
            </p>
            <button
              className="danger-text"
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    `Remove ${group.name}, its assignment and its meetings?`,
                  )
                )
                  void commit(
                    {
                      ...data,
                      teachingGroups: data.teachingGroups.filter(
                        (g) => g.id !== group.id,
                      ),
                      assignments: data.assignments.filter(
                        (a) => a.groupId !== group.id,
                      ),
                      meetings: data.meetings.filter(
                        (m) => m.groupId !== group.id,
                      ),
                    },
                    "Removed teaching group and related meetings",
                  );
              }}
            >
              Remove group and its meetings
            </button>
          </details>
        </fieldset>
      </form>
      {showTimes && (
        <MeetingPlanner data={data} group={group} commit={commit} />
      )}
    </article>
  );
}
export function GroupWorkspace({
  data,
  offeringId,
  commit,
}: {
  data: Data;
  offeringId: string;
  commit: Commit;
}) {
  const groups = data.teachingGroups.filter((g) => g.offeringId === offeringId);
  return (
    <div className="padded">
      <p className="note">
        Assign each component, then schedule it. Use{" "}
        <strong>Split lab into two</strong> when a class needs smaller
        laboratory groups. Contact hours are checked per group, and each group
        contributes its own load credit.
      </p>
      <div className="actions wrap">
        <button
          onClick={() => {
            const o = data.offerings.find((o) => o.id === offeringId)!,
              subject = data.subjects.find((s) => s.id === o.subjectId)!,
              section = data.sections.find((s) => s.id === o.sectionId)!;
            let index = 1;
            while (groups.some((g) => g.name === `Lab ${index}`)) index++;
            const group: Row<"teachingGroups"> = {
              id: uid(),
              offeringId,
              component: "lab",
              name: `Lab ${index}`,
              students: section.size,
              contactHours:
                subject.labHours ||
                groups.find((g) => g.component === "lab")?.contactHours ||
                0,
              creditReason: "",
              sourceNote: "",
            };
            void commit(
              { ...data, teachingGroups: [...data.teachingGroups, group] },
              "Added laboratory group",
            );
          }}
        >
          + Add laboratory group
        </button>
        {!groups.some((g) => g.component === "lecture") && (
          <button
            onClick={() => {
              const o = data.offerings.find((o) => o.id === offeringId)!,
                subject = data.subjects.find((s) => s.id === o.subjectId)!,
                section = data.sections.find((s) => s.id === o.sectionId)!;
              void commit(
                {
                  ...data,
                  teachingGroups: [
                    ...data.teachingGroups,
                    {
                      id: uid(),
                      offeringId,
                      component: "lecture",
                      name: "Lecture",
                      students: section.size,
                      contactHours: subject.lectureHours,
                      creditReason: "",
                      sourceNote: "",
                    },
                  ],
                },
                "Added lecture group",
              );
            }}
          >
            + Add lecture group
          </button>
        )}
      </div>
      {groups.map((g) => (
        <GroupCard
          key={`${g.id}-${JSON.stringify(g)}-${data.assignments.find((a) => a.groupId === g.id)?.facultyId ?? ""}`}
          data={data}
          group={g}
          commit={commit}
        />
      ))}
    </div>
  );
}
