import { useMemo } from "react";
import { offeringName, type Data } from "../lib/model";
import { utilization, validate, workload } from "../lib/engine";
import { Badge, Empty, Panel } from "./UI";
export function Dashboard({
  data,
  term,
  navigate,
}: {
  data: Data;
  term: string;
  navigate: (page: string, mode?: string) => void;
}) {
  const offerings = data.offerings.filter((o) => o.semesterId === term),
    ids = new Set(offerings.map((o) => o.id));
  const assigned = data.assignments.filter((a) => ids.has(a.offeringId));
  const issues = useMemo(() => validate(data, term), [data, term]);
  const stats = useMemo(
    () =>
      data.rooms
        .filter((r) => r.active)
        .map((r) => ({ ...r, ...utilization(data, r.id, term) })),
    [data, term],
  );
  const totalLoad = data.faculty.reduce(
    (s, f) => s + workload(data, f.id, term),
    0,
  );
  const unassigned = offerings.filter(
    (o) => !assigned.some((a) => a.offeringId === o.id),
  );
  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">YOUR SEMESTER AT A GLANCE</p>
          <h2>A clearer week starts here.</h2>
          <p>
            Prepare teaching loads, find the right rooms, and keep every class
            in place.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => navigate("scheduling", "new")}
        >
          + Add subject offering
        </button>
      </div>
      {!data.semesters.length && (
        <div className="alert warning">
          Start with Settings → Records to create an academic year and semester,
          or load the optional fictional sample under Data management. This
          workspace starts empty.
        </div>
      )}
      <div className="stats-grid">
        {[
          [
            "Active faculty",
            data.faculty.filter((f) => f.active).length,
            "Department roster",
          ],
          [
            "Subjects offered",
            new Set(offerings.map((o) => o.subjectId)).size,
            "Distinct subjects",
          ],
          [
            "Class sections",
            offerings.length,
            `${new Set(offerings.map((o) => o.sectionId)).size} student blocks`,
          ],
          [
            "Assigned / unassigned",
            `${assigned.length} / ${unassigned.length}`,
            "Subject offerings",
          ],
          [
            "Teaching-load units",
            Number(totalLoad.toFixed(2)),
            "Configured workload factors",
          ],
          [
            "Blocking conflicts",
            issues.filter((i) => i.severity === "error").length,
            `${issues.filter((i) => i.severity === "warning").length} items to review`,
          ],
        ].map(([label, value, note]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="shortcut-grid">
        {[
          [
            "Assign faculty",
            "Work through unassigned offerings",
            "scheduling",
            "guided",
            "↗",
          ],
          [
            "Find an available room",
            "Check seating, equipment, and time",
            "rooms",
            "",
            "▦",
          ],
          [
            "View weekly timetable",
            "Review faculty, sections, and rooms",
            "scheduling",
            "timetable",
            "▤",
          ],
          [
            "Generate reports",
            "Export Excel or print to PDF",
            "reports",
            "",
            "↓",
          ],
        ].map(([title, desc, page, mode, icon]) => (
          <button
            key={title}
            className="shortcut"
            onClick={() => navigate(page, mode)}
          >
            <span className="shortcut-icon" aria-hidden="true">
              {icon}
            </span>
            <span>
              <strong>{title}</strong>
              <small>{desc}</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
      <div className="split">
        <Panel
          title="Ready for assignment"
          action={<Badge tone="amber">{unassigned.length} unassigned</Badge>}
        >
          {unassigned.length ? (
            <div className="padded">
              {unassigned.slice(0, 6).map((o) => (
                <div className="meeting-row" key={o.id}>
                  <span>
                    <strong>{offeringName(data, o.id)}</strong>
                    <small>
                      {data.subjects.find((s) => s.id === o.subjectId)?.name}
                    </small>
                  </span>
                  <button onClick={() => navigate("scheduling", "guided")}>
                    Assign →
                  </button>
                </div>
              ))}
              {unassigned.length > 6 && (
                <button onClick={() => navigate("scheduling", "guided")}>
                  View all {unassigned.length} offerings
                </button>
              )}
            </div>
          ) : (
            <Empty
              title={
                offerings.length
                  ? "All offerings have faculty"
                  : "No offerings yet"
              }
            >
              {offerings.length
                ? "Review weekly meetings to finish your schedule."
                : "Add subjects and sections, then create semester offerings."}
            </Empty>
          )}
        </Panel>
        <Panel
          title="Room capacity in use"
          action={
            <button onClick={() => navigate("rooms")}>View rooms →</button>
          }
        >
          <div className="padded">
            {["classroom", "laboratory"].map((type) => {
              const rooms = stats.filter((r) => r.type === type),
                available = rooms.reduce((s, r) => s + r.available, 0),
                occupied = rooms.reduce((s, r) => s + r.occupied, 0),
                percent = available ? (occupied / available) * 100 : 0;
              return (
                <div className="utilization-summary" key={type}>
                  <div>
                    <strong>
                      {type === "classroom" ? "Classrooms" : "Laboratories"}
                    </strong>
                    <span>{percent.toFixed(1)}%</span>
                  </div>
                  <div className="meter">
                    <span style={{ width: `${Math.min(100, percent)}%` }} />
                  </div>
                  <small>
                    {(occupied / 60).toFixed(1)} of{" "}
                    {(available / 60).toFixed(1)} available room-hours / week
                  </small>
                </div>
              );
            })}
            <p className="note">
              Blocked and unavailable time is excluded from capacity. View a
              typical recurring week for the selected semester.
            </p>
          </div>
        </Panel>
      </div>
      <Panel title="Recent changes">
        <div className="padded">
          {data.history.length ? (
            data.history.slice(0, 7).map((h) => (
              <div className="history-row" key={h.id}>
                <span className="history-dot" />
                <span>{h.description}</span>
                <time dateTime={h.at}>{new Date(h.at).toLocaleString()}</time>
              </div>
            ))
          ) : (
            <p className="quiet">Your saved changes will appear here.</p>
          )}
        </div>
      </Panel>
    </>
  );
}
