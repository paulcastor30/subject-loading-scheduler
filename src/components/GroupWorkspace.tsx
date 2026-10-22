import { useMemo, useState, type FormEvent } from "react";
import { days, offeringName, uid, type Data, type Row } from "../lib/model";
import {
  availableRooms,
  minutes,
  suggestions,
  workload,
  clockTime,
} from "../lib/engine";
import { enableGroups, groupCredits, splitLab } from "../lib/loading";
import { useDraft } from "../lib/drafts";
import type { Commit } from "../lib/useStore";
import { Badge, DaySelect, ErrorMessage, Field, Select } from "./UI";

type ClassDraft = {
  group: Row<"teachingGroups">;
  faculty: string;
  override: boolean;
  addMeeting: boolean;
  meetingId: string;
  day: number;
  start: string;
  end: string;
  roomId: string;
  moreDays: number[];
};
function GroupCard({
  data,
  group,
  commit,
}: {
  data: Data;
  group: Row<"teachingGroups">;
  commit: Commit;
}) {
  const offering = data.offerings.find((o) => o.id === group.offeringId)!,
    subject = data.subjects.find((s) => s.id === offering.subjectId)!;
  const assignment = data.assignments.find((a) => a.groupId === group.id),
    own = data.meetings.filter((m) => m.groupId === group.id);
  const complete =
    Boolean(assignment) &&
    Math.abs(
      own.reduce((n, m) => n + (minutes(m.end) - minutes(m.start)) / 60, 0) -
        group.contactHours,
    ) < 0.001;
  const [expanded, setExpanded] = useState(!complete);
  const initial: ClassDraft = {
    group,
    faculty: assignment?.facultyId ?? "",
    override: group.creditedLoad !== undefined,
    addMeeting:
      !own.length ||
      own.reduce((n, m) => n + (minutes(m.end) - minutes(m.start)) / 60, 0) <
        group.contactHours - 0.001,
    meetingId: "",
    day: data.schedulingRules[0].days[0],
    start: "08:00",
    end: clockTime(
      480 +
        Math.max(
          30,
          Math.min(
            180,
            Math.max(
              0.5,
              group.contactHours -
                own.reduce(
                  (n, m) => n + (minutes(m.end) - minutes(m.start)) / 60,
                  0,
                ),
            ) * 60,
          ),
        ),
    ),
    roomId: "",
    moreDays: [],
  };
  const form = useDraft(
    `class:${group.id}`,
    initial,
    `${offeringName(data, offering.id)} · ${group.name}`,
    `#scheduling/guided?offering=${encodeURIComponent(offering.id)}`,
  );
  const draft = form.value;
  const set = <K extends keyof ClassDraft>(key: K, value: ClassDraft[K]) =>
    form.setValue((d) => ({ ...d, [key]: value }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [options, setOptions] = useState<Omit<Row<"meetings">, "id">[]>([]);
  const proposedGroup = {
    ...draft.group,
    creditedLoad: draft.override ? (draft.group.creditedLoad ?? 0) : undefined,
  };
  function prepared() {
    const next = { ...data };
    next.teachingGroups = next.teachingGroups.map((g) =>
      g.id === group.id ? proposedGroup : g,
    );
    next.assignments = next.assignments.filter((a) => a.groupId !== group.id);
    if (draft.faculty)
      next.assignments.push({
        id: assignment?.id ?? uid(),
        offeringId: offering.id,
        groupId: group.id,
        facultyId: draft.faculty,
      });
    return next;
  }
  const pending = prepared(),
    credit = groupCredits(pending, proposedGroup);
  const roomData = {
    ...pending,
    meetings: pending.meetings.filter((m) => m.id !== draft.meetingId),
  };
  const roomQuery = {
    semesterId: offering.semesterId,
    day: draft.day,
    start: draft.start,
    end: draft.end,
    size: proposedGroup.students,
    type: group.component === "lab" ? "laboratory" : "",
    equipment: subject.equipment,
  };
  const repeatedAvailability = draft.moreDays.map(
    (day) =>
      new Set(availableRooms(roomData, { ...roomQuery, day }).map((r) => r.id)),
  );
  const rooms = availableRooms(roomData, roomQuery).filter((room) =>
    repeatedAvailability.every((ids) => ids.has(room.id)),
  );
  const scheduled = own.reduce(
    (sum, m) => sum + (minutes(m.end) - minutes(m.start)) / 60,
    0,
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = prepared();
      if (draft.addMeeting) {
        if (!rooms.some((r) => r.id === draft.roomId))
          throw new Error(
            "Choose an available room, or change the day or time.",
          );
        const meetingDays = [...new Set([draft.day, ...draft.moreDays])];
        next.meetings = next.meetings.filter((m) => m.id !== draft.meetingId);
        next.meetings.push(
          ...meetingDays.map((day, i) => ({
            id: i === 0 && draft.meetingId ? draft.meetingId : uid(),
            offeringId: offering.id,
            groupId: group.id,
            component: group.component,
            day,
            start: draft.start,
            end: draft.end,
            roomId: draft.roomId,
          })),
        );
      }
      if (
        await commit(
          next,
          `Saved ${group.name} assignment${draft.addMeeting ? " and meeting" : ""}`,
        )
      ) {
        form.clear({
          ...draft,
          group: proposedGroup,
          meetingId: "",
          addMeeting: false,
          roomId: "",
          moreDays: [],
        });
        setOptions([]);
        if (
          draft.faculty &&
          Math.abs(
            next.meetings
              .filter((m) => m.groupId === group.id)
              .reduce(
                (n, m) => n + (minutes(m.end) - minutes(m.start)) / 60,
                0,
              ) - proposedGroup.contactHours,
          ) < 0.001
        )
          setExpanded(false);
        setMessage(
          draft.addMeeting
            ? "Saved. Faculty, load and meeting changes are recorded together."
            : "Saved. Faculty and load recorded. Add meeting times when ready.",
        );
      } else
        setError(
          "This class was not saved. Review the error above, adjust the details and try again.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save this class.");
    } finally {
      setBusy(false);
    }
  }
  function edit(m: Row<"meetings">) {
    form.setValue((d) => ({
      ...d,
      addMeeting: true,
      meetingId: m.id,
      day: m.day,
      start: m.start,
      end: m.end,
      roomId: m.roomId,
      moreDays: [],
    }));
    setMessage("");
  }
  return (
    <article
      className="group-card"
      aria-label={`${group.name} assignment and schedule`}
    >
      <div className="group-heading">
        <h3>{group.name}</h3>
        <Badge
          tone={
            assignment && Math.abs(scheduled - group.contactHours) < 0.001
              ? "green"
              : "amber"
          }
        >
          {scheduled} / {group.contactHours} hours scheduled
        </Badge>
      </div>
      {message && <p role="status">{message}</p>}
      {!(expanded || form.dirty) ? (
        <div className="saved-class-summary">
          <p>
            <strong>
              {data.faculty.find((f) => f.id === assignment?.facultyId)?.name ??
                "Unassigned"}
            </strong>{" "}
            · {credit.toFixed(2)} load units
          </p>
          {own.map((m) => (
            <p key={m.id}>
              <strong>
                {days[m.day]} {m.start}–{m.end}
              </strong>{" "}
              · {data.rooms.find((r) => r.id === m.roomId)?.code}
            </p>
          ))}
          <button onClick={() => setExpanded(true)}>
            Edit assignment or meetings
          </button>
        </div>
      ) : (
        <>
          <button
            className="collapse-class"
            type="button"
            disabled={form.dirty}
            onClick={() => setExpanded(false)}
          >
            Collapse details
          </button>
          <form onSubmit={save}>
            <fieldset disabled={busy} className="group-fieldset">
              <Select
                label="Faculty for this group"
                value={draft.faculty}
                onChange={(v) => set("faculty", v)}
                empty="Choose faculty"
                required
                options={data.faculty
                  .filter(
                    (f) =>
                      f.id === draft.faculty ||
                      (f.active &&
                        !data.loadActivities.some(
                          (a) =>
                            a.semesterId === offering.semesterId &&
                            a.facultyId === f.id &&
                            a.kind === "leave",
                        )),
                  )
                  .sort(
                    (a, b) =>
                      workload(data, a.id, offering.semesterId) -
                      workload(data, b.id, offering.semesterId),
                  )
                  .map((f) => ({
                    id: f.id,
                    name: `${f.name} · ${workload(data, f.id, offering.semesterId).toFixed(2)} / ${f.maxLoad} units`,
                  }))}
              />
              <p className="load-preview">
                {proposedGroup.students} students · {proposedGroup.contactHours}{" "}
                hours/week · {credit.toFixed(2)} load units
                {draft.faculty && (
                  <>
                    {" "}
                    · Faculty total after saving:{" "}
                    <strong>
                      {workload(
                        pending,
                        draft.faculty,
                        offering.semesterId,
                      ).toFixed(2)}{" "}
                      /{" "}
                      {
                        data.faculty.find((f) => f.id === draft.faculty)
                          ?.maxLoad
                      }
                    </strong>
                  </>
                )}
              </p>
              {own.map((m) => (
                <div className="meeting-row" key={m.id}>
                  <span>
                    <strong>
                      {days[m.day]} {m.start}–{m.end}
                    </strong>
                    <small>
                      {data.rooms.find((r) => r.id === m.roomId)?.code}
                    </small>
                  </span>
                  <div className="actions">
                    <button type="button" onClick={() => edit(m)}>
                      Edit meeting
                    </button>
                    <button
                      type="button"
                      className="danger-text"
                      onClick={async () => {
                        if (
                          confirm(
                            "Remove this meeting? You can undo this change.",
                          )
                        ) {
                          if (
                            await commit(
                              {
                                ...data,
                                meetings: data.meetings.filter(
                                  (v) => v.id !== m.id,
                                ),
                              },
                              "Removed class meeting",
                            )
                          ) {
                            if (draft.meetingId === m.id) form.clear(initial);
                          }
                        }
                      }}
                    >
                      Remove meeting
                    </button>
                  </div>
                </div>
              ))}
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.addMeeting}
                  onChange={(e) => {
                    set("addMeeting", e.target.checked);
                    setOptions([]);
                  }}
                />
                {draft.meetingId
                  ? "Update selected weekly meeting"
                  : "Add a weekly meeting"}
              </label>
              {draft.addMeeting && (
                <div className="group-meetings">
                  <p className="note">
                    Choose a day and time. Rooms below fit the class and are
                    free at that time.
                  </p>
                  <div className="form-grid">
                    <DaySelect
                      value={draft.day}
                      onChange={(v) => set("day", v)}
                    />
                    <Field label="Start time">
                      <input
                        type="time"
                        required
                        value={draft.start}
                        onChange={(e) => set("start", e.target.value)}
                      />
                    </Field>
                    <Field label="End time">
                      <input
                        type="time"
                        required
                        value={draft.end}
                        onChange={(e) => set("end", e.target.value)}
                      />
                    </Field>
                    <Field label="Available room">
                      <select
                        required
                        value={draft.roomId}
                        onChange={(e) => set("roomId", e.target.value)}
                      >
                        <option value="">
                          {rooms.length
                            ? "Choose a room"
                            : "No rooms free — try another time"}
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
                        .filter((d) => d !== draft.day)
                        .map((d) => (
                          <label className="check" key={d}>
                            <input
                              type="checkbox"
                              checked={draft.moreDays.includes(d)}
                              onChange={(e) =>
                                set(
                                  "moreDays",
                                  e.target.checked
                                    ? [...draft.moreDays, d]
                                    : draft.moreDays.filter((v) => v !== d),
                                )
                              }
                            />
                            {days[d]}
                          </label>
                        ))}
                    </div>
                  </details>
                  <button
                    type="button"
                    onClick={() =>
                      setOptions(
                        suggestions(
                          roomData,
                          offering.id,
                          group.component,
                          Math.max(
                            30,
                            minutes(draft.end) - minutes(draft.start),
                          ),
                          group.id,
                        ),
                      )
                    }
                  >
                    Suggest available times
                  </button>
                  {options.map((m, i) => (
                    <button
                      className="suggestion"
                      type="button"
                      key={i}
                      onClick={() => {
                        form.setValue((d) => ({
                          ...d,
                          day: m.day,
                          start: m.start,
                          end: m.end,
                          roomId: m.roomId,
                        }));
                        setOptions([]);
                      }}
                    >
                      {days[m.day]} {m.start}–{m.end} ·{" "}
                      {data.rooms.find((r) => r.id === m.roomId)?.code} · Use
                      this time
                    </button>
                  ))}
                </div>
              )}
              <details className="class-advanced">
                <summary>Class size, hours and load-credit settings</summary>
                <div className="form-grid">
                  <Field label="Students in this group">
                    <input
                      type="number"
                      min="1"
                      required
                      value={draft.group.students}
                      onChange={(e) =>
                        set("group", {
                          ...draft.group,
                          students: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Weekly contact hours">
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      required
                      value={draft.group.contactHours}
                      onChange={(e) =>
                        set("group", {
                          ...draft.group,
                          contactHours: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Group name">
                    <input
                      required
                      value={draft.group.name}
                      onChange={(e) =>
                        set("group", { ...draft.group, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Load category">
                    <select
                      value={draft.group.loadCategoryId ?? ""}
                      onChange={(e) =>
                        set("group", {
                          ...draft.group,
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
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={draft.override}
                    onChange={(e) => set("override", e.target.checked)}
                  />
                  Use a reported or approved credit instead of a factor
                </label>
                {draft.override && (
                  <div className="form-grid">
                    <Field label="Credited load units">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.group.creditedLoad ?? 0}
                        onChange={(e) =>
                          set("group", {
                            ...draft.group,
                            creditedLoad: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Credit source or reason">
                      <input
                        required
                        value={draft.group.creditReason}
                        onChange={(e) =>
                          set("group", {
                            ...draft.group,
                            creditReason: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                )}
                {group.sourceNote && <p className="note">{group.sourceNote}</p>}
              </details>
              <ErrorMessage message={error} />
              {form.storageError && (
                <ErrorMessage message="Your browser could not keep this draft. Save before leaving this page." />
              )}
              <div className="actions wrap">
                <button
                  className="primary"
                  disabled={busy || (!form.dirty && !draft.roomId)}
                >
                  {busy
                    ? "Saving…"
                    : draft.addMeeting
                      ? "Save assignment & meeting"
                      : "Save assignment"}
                </button>
                {form.dirty && (
                  <button
                    type="button"
                    onClick={() => {
                      form.clear(initial);
                      setMessage("");
                      setError("");
                    }}
                  >
                    Discard unfinished edits
                  </button>
                )}
              </div>
              {form.dirty && (
                <p className="draft-note">
                  Unfinished edits kept in this tab. They are not saved academic
                  records yet.
                </p>
              )}
            </fieldset>
          </form>
          <details className="class-advanced">
            <summary>Split, unassign or remove this group</summary>
            <div className="actions wrap">
              {group.component === "lab" && (
                <button
                  disabled={busy || form.dirty || group.students < 2}
                  onClick={async () => {
                    try {
                      setError("");
                      await commit(
                        splitLab(data, group.id),
                        "Split laboratory into two groups",
                      );
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Unable to split group",
                      );
                    }
                  }}
                >
                  Split lab into two
                </button>
              )}
              {assignment && (
                <button
                  disabled={busy || form.dirty}
                  onClick={() =>
                    void commit(
                      {
                        ...data,
                        assignments: data.assignments.filter(
                          (a) => a.groupId !== group.id,
                        ),
                      },
                      "Unassigned group faculty",
                    )
                  }
                >
                  Unassign faculty
                </button>
              )}
              <button
                className="danger-text"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      `Remove ${group.name}, its assignment and its meetings? Undo is available.`,
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
                      "Removed teaching group and meetings",
                    );
                }}
              >
                Remove group and its meetings
              </button>
            </div>
          </details>
        </>
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
  const prepared = useMemo(
    () =>
      enableGroups(data, offeringId, {
        lecture: `component:${offeringId}:lecture`,
        lab: `component:${offeringId}:lab`,
      }),
    [data, offeringId],
  );
  const groups = prepared.teachingGroups.filter(
    (g) => g.offeringId === offeringId,
  );
  return (
    <div className="padded">
      <p className="note">
        Choose an instructor and a meeting time, then save once. Lecture and
        laboratory are prepared from the subject’s contact hours.
      </p>
      {groups.map((g) => (
        <GroupCard key={g.id} data={prepared} group={g} commit={commit} />
      ))}
      {!groups.length && (
        <p>
          No lecture or laboratory hours are set for this subject. Update its
          contact hours in Subjects & sections before assigning faculty.
        </p>
      )}
      <details className="class-advanced">
        <summary>Add an additional teaching group</summary>
        <div className="actions">
          {(["lecture", "lab"] as const).map((component) => (
            <button
              key={component}
              onClick={() => {
                const subject = prepared.subjects.find(
                  (s) =>
                    s.id ===
                    prepared.offerings.find((o) => o.id === offeringId)
                      ?.subjectId,
                )!;
                const section = prepared.sections.find(
                  (s) =>
                    s.id ===
                    prepared.offerings.find((o) => o.id === offeringId)
                      ?.sectionId,
                )!;
                let n =
                  groups.filter((g) => g.component === component).length + 1;
                while (
                  groups.some(
                    (g) =>
                      g.name ===
                      `${component === "lab" ? "Lab" : "Lecture"} ${n}`,
                  )
                )
                  n++;
                void commit(
                  {
                    ...prepared,
                    teachingGroups: [
                      ...prepared.teachingGroups,
                      {
                        id: uid(),
                        offeringId,
                        name: `${component === "lab" ? "Lab" : "Lecture"} ${n}`,
                        component,
                        students: section.size,
                        contactHours:
                          component === "lab"
                            ? subject.labHours
                            : subject.lectureHours,
                        creditReason: "",
                        sourceNote: "",
                      },
                    ],
                  },
                  "Added teaching group",
                );
              }}
            >
              + Add {component === "lab" ? "laboratory" : "lecture"} group
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
