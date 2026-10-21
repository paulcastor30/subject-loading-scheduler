import { readPreference, writePreference } from "./lib/preferences";
import { Component, useEffect, useState, type ReactNode } from "react";
import { useStore } from "./lib/useStore";
import { Dashboard } from "./components/Dashboard";
import { Scheduling } from "./components/Scheduling";
import { Rooms } from "./components/Rooms";
import { Reports } from "./components/Reports";
import { Records } from "./components/Records";
import { DataManagement } from "./components/DataManagement";
import { ErrorMessage } from "./components/UI";
const pages = [
  ["dashboard", "Overview", "◫"],
  ["scheduling", "Loading & scheduling", "▤"],
  ["rooms", "Rooms", "▦"],
  ["reports", "Reports", "▥"],
  ["settings", "Settings & data", "⚙"],
];
const descriptions: Record<string, string> = {
  dashboard: "A practical overview of your academic semester.",
  scheduling: "Assign faculty and build a conflict-free weekly schedule.",
  rooms: "Find the right space and make the most of every room.",
  reports: "Clear, consistent records for your department.",
  settings: "Maintain academic records and keep your data protected.",
};
function readRoute() {
  const [page, mode] = location.hash.slice(1).split("/");
  return {
    page: pages.some(([key]) => key === page) ? page : "dashboard",
    mode: mode ?? "",
  };
}
export default function App() {
  const store = useStore(),
    { data, ready, error, setError, status, commit } = store;
  const [route, setRoute] = useState(readRoute),
    [chosenTerm, setChosenTerm] = useState(() => readPreference("slss-term")),
    [settingsTab, setSettingsTab] = useState("records");
  const term = data.semesters.some((s) => s.id === chosenTerm)
    ? chosenTerm
    : (data.semesters[0]?.id ?? "");
  useEffect(() => {
    const listener = () => setRoute(readRoute());
    addEventListener("hashchange", listener);
    return () => removeEventListener("hashchange", listener);
  }, []);
  const navigate = (page: string, mode = "") => {
    location.hash = `${page}${mode ? `/${mode}` : ""}`;
    setRoute({ page, mode });
  };
  useEffect(() => {
    if (error)
      document
        .querySelector("[role=alert]")
        ?.scrollIntoView({ block: "center" });
  }, [error]);
  const semester = data.semesters.find((s) => s.id === term);
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar no-print">
        <a className="brand" href="#dashboard">
          <span className="brand-mark" aria-hidden="true">
            S<span>▥</span>
          </span>
          <span>
            <strong>SLSS</strong>
            <small>Academic workspace</small>
          </span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {pages.map(([key, label, icon]) => (
            <a
              key={key}
              href={`#${key}`}
              aria-current={route.page === key ? "page" : undefined}
              className={route.page === key ? "active" : ""}
            >
              <span className="nav-icon" aria-hidden="true">
                {icon}
              </span>
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" />
          Local-first workspace
          <p>
            Your records stay in this browser.
            <br />
            Back up regularly.
          </p>
          <button
            onClick={() => {
              setSettingsTab("data");
              navigate("settings");
            }}
          >
            Back up your data ↗
          </button>
        </div>
        <div className="sidebar-footer">
          SUBJECT LOADING & SCHEDULING
          <br />
          Department administration
        </div>
      </aside>
      <div className="app-shell">
        <header className="topbar no-print">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>{pages.find(([key]) => key === route.page)?.[1]}</strong>
          </div>
          <div className="topbar-controls">
            <label className="term-picker">
              <span>Academic term</span>
              <select
                aria-label="Academic term"
                value={term}
                onChange={(e) => {
                  setChosenTerm(e.target.value);
                  writePreference("slss-term", e.target.value);
                }}
              >
                <option value="" disabled>
                  Select semester
                </option>
                {data.semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {
                      data.academicYears.find((y) => y.id === s.academicYearId)
                        ?.name
                    }{" "}
                    · {s.name}
                    {s.finalized ? " (finalized)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <span className="avatar" aria-label="Department workspace">
              D
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-title no-print">
            <div>
              <h1>
                {route.page === "dashboard"
                  ? "Semester overview"
                  : pages.find(([key]) => key === route.page)?.[1]}
              </h1>
              <p>{descriptions[route.page]}</p>
            </div>
            <div className="save-tools">
              <span
                className={
                  status.startsWith("Not") ? "save-error" : "save-status"
                }
                role="status"
              >
                {status.startsWith("Saved") ? "● " : ""}
                {status}
              </span>
              <div className="actions">
                <button
                  disabled={!store.canUndo}
                  onClick={() => void store.undo()}
                  title="Undo last saved change"
                >
                  ↶ Undo
                </button>
                <button
                  disabled={!store.canRedo}
                  onClick={() => void store.redo()}
                  title="Redo last undone change"
                >
                  ↷ Redo
                </button>
              </div>
            </div>
          </div>
          <div className="no-print">
            <ErrorMessage message={error} />
            {error && (
              <button className="dismiss" onClick={() => setError("")}>
                Dismiss message
              </button>
            )}
            {semester?.finalized && (
              <div className="alert warning">
                This semester is finalized. Reopen it in Settings → Records →
                Semesters before changing its offerings or schedules. Back up
                before finalizing.
              </div>
            )}
          </div>
          {ready ? (
            <>
              {route.page === "dashboard" && (
                <Dashboard data={data} term={term} navigate={navigate} />
              )}{" "}
              {route.page === "scheduling" && (
                <Scheduling
                  key={`${term}-${route.mode}`}
                  data={data}
                  term={term}
                  commit={commit}
                  initialMode={route.mode || "guided"}
                />
              )}{" "}
              {route.page === "rooms" && <Rooms data={data} term={term} />}{" "}
              {route.page === "reports" && (
                <Reports data={data} term={term} onError={setError} />
              )}{" "}
              {route.page === "settings" && (
                <>
                  <div className="tabs">
                    <button
                      className={settingsTab === "records" ? "active" : ""}
                      onClick={() => setSettingsTab("records")}
                    >
                      Academic records & rules
                    </button>
                    <button
                      className={settingsTab === "data" ? "active" : ""}
                      onClick={() => setSettingsTab("data")}
                    >
                      Data management & backups
                    </button>
                    <button
                      className={settingsTab === "guide" ? "active" : ""}
                      onClick={() => setSettingsTab("guide")}
                    >
                      Getting started
                    </button>
                  </div>
                  {settingsTab === "records" && (
                    <Records data={data} commit={commit} />
                  )}{" "}
                  {settingsTab === "data" && (
                    <DataManagement
                      data={data}
                      commit={commit}
                      replace={store.replace}
                      onError={setError}
                    />
                  )}{" "}
                  {settingsTab === "guide" && (
                    <section className="panel guide">
                      <h2>From academic records to a finished schedule</h2>
                      <ol>
                        <li>
                          <strong>Set up records.</strong> Add an academic year,
                          semester, program, curriculum, subjects, faculty,
                          student sections, and rooms. Use Settings → Records.
                        </li>
                        <li>
                          <strong>Review your rules.</strong> Configure
                          scheduling days/hours and lecture/lab workload
                          factors. Optional faculty windows and room
                          availability repeat each week.
                        </li>
                        <li>
                          <strong>Create offerings.</strong> In Loading &
                          scheduling, add the subject and section for a
                          semester.
                        </li>
                        <li>
                          <strong>Assign faculty.</strong> Select an offering,
                          choose faculty, and save. Review the load shown beside
                          each faculty member.
                        </li>
                        <li>
                          <strong>Add weekly meetings.</strong> Enter lecture
                          and lab meetings separately. Suggested times check
                          availability, room fit, and existing classes.
                        </li>
                        <li>
                          <strong>Review and report.</strong> Resolve missing
                          contact hours and unassigned faculty under Review &
                          conflicts. Download Excel or print reports.
                        </li>
                        <li>
                          <strong>Back up.</strong> Export a JSON backup to a
                          safe location. You may finalize a semester in Settings
                          → Semesters after review.
                        </li>
                      </ol>
                      <h3>Editing and importing</h3>
                      <p>
                        Quick edit supports Tab between cells, Ctrl/⌘ + Enter to
                        save a row, and Escape to reset it. Bulk edits validate
                        the complete proposed change. Import related records in
                        dependency order using IDs from reference exports.
                        Preview all proposed changes before committing valid
                        rows.
                      </p>
                      <h3>Storage and recovery</h3>
                      <p>
                        There are no accounts, passwords, or device
                        synchronization. Normal record operations work offline
                        after loading. Keep one editing tab open; stale writes
                        from another tab are rejected. If a save fails, preserve
                        any backup you have, check free browser storage, and
                        reload before retrying. Undo/redo keeps the last 20
                        changes during this session; refresh clears that undo
                        stack.
                      </p>
                      <h3>Calculation assumptions</h3>
                      <p>
                        Credited load is based on planned weekly subject contact
                        hours, once per assigned offering. It is independent of
                        course units and actual scheduled hours. Edit workload
                        factors to reflect your department’s rules. Availability
                        and class meetings describe a typical recurring week,
                        without date-specific holidays or exam exceptions.
                      </p>
                    </section>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="empty" role="status">
              Opening local academic records…
            </div>
          )}
          <footer className="main-footer no-print">
            <span>SLSS · Subject Loading and Scheduling System</span>
            <span>Local browser storage · No automatic synchronization</span>
          </footer>
        </main>
      </div>
    </>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Unable to display the workspace</h1>
        <p>
          Your browser records have not been deleted. Reload the page. If the
          issue persists, keep your backups and report this message:
        </p>
        <pre>{this.state.error}</pre>
        <button onClick={() => location.reload()}>Reload</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
