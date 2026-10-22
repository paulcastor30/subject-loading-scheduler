import { Form3Report } from "./Form3Report";
import { useMemo, useState } from "react";
import type { Data, Entity } from "../lib/model";
import {
  buildReport,
  facultyLoadNote,
  reportTypes,
  type ReportType,
} from "../lib/reports";
import { exportExcel } from "../lib/imports";
import { Empty, Field, Panel, Reference } from "./UI";
export function Reports({
  data,
  term,
  onError,
}: {
  data: Data;
  term: string;
  onError: (s: string) => void;
}) {
  const [type, setType] = useState<ReportType>(reportTypes[0]),
    [resource, setResource] = useState(""),
    [program, setProgram] = useState(""),
    [busy, setBusy] = useState(false);
  const entity: Entity | null =
    type.includes("Individual Faculty") ||
    type === "Faculty Weekly Schedule" ||
    type === "OVCAA Form 3 Loading Summary"
      ? "faculty"
      : type === "Student Section Weekly Schedule"
        ? "sections"
        : type === "Classroom and Laboratory Timetable" ||
            type === "Room Utilization Summary"
          ? "rooms"
          : null;
  const report = useMemo(
    () => buildReport(data, term, type, resource, program),
    [data, term, type, resource, program],
  );
  const semester = data.semesters.find((s) => s.id === term),
    year = data.academicYears.find((y) => y.id === semester?.academicYearId);
  const subtitle = `${year?.name ?? "No academic year"} · ${semester?.name ?? "No semester"} · ${program ? data.programs.find((p) => p.id === program)?.name : "All programs / department"}`;
  async function excel() {
    setBusy(true);
    try {
      await exportExcel(type, report.headers, report.rows, subtitle);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar wrap no-print">
        <Field label="Report">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as ReportType);
              setResource("");
              setProgram("");
            }}
          >
            {reportTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        {type !== "OVCAA Form 3 Loading Summary" && (
          <Reference
            data={data}
            entity="programs"
            label="Program"
            value={program}
            onChange={setProgram}
            empty="All programs"
          />
        )}
        {entity && (
          <Reference
            data={data}
            entity={entity}
            label={
              entity === "faculty"
                ? "Faculty member"
                : entity === "sections"
                  ? "Student section"
                  : "Room"
            }
            value={resource}
            onChange={setResource}
            empty="All records"
          />
        )}
        <button
          className="primary"
          onClick={() => void excel()}
          disabled={busy || !term || !report.rows.length}
        >
          {busy ? "Exporting…" : "Export Excel"}
        </button>
        <button
          disabled={!term || !report.rows.length}
          onClick={() => window.print()}
        >
          Print / Save PDF
        </button>
      </div>
      <div className="report">
        <header className="report-header">
          <p className="eyebrow">SUBJECT LOADING AND SCHEDULING SYSTEM</p>
          <h2>{type}</h2>
          <p>{subtitle}</p>
          <p>Generated {new Date().toLocaleString()}</p>
          {entity === "faculty" && (
            <p>{facultyLoadNote(data, term, resource)}</p>
          )}
        </header>
        {type === "OVCAA Form 3 Loading Summary" ? (
          <Form3Report data={data} term={term} faculty={resource} />
        ) : (
          <Panel title={`${report.rows.length} report records`}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {report.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((v, j) => (
                        <td key={j}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!report.rows.length && (
              <Empty
                title={term ? "No matching records" : "Start with a semester"}
              >
                {term ? (
                  <>
                    Adjust the filters, or{" "}
                    <a href="#scheduling/guided">
                      assign and schedule your classes →
                    </a>
                  </>
                ) : (
                  <a href="#dashboard/setup">
                    Create your semester workspace →
                  </a>
                )}
              </Empty>
            )}
          </Panel>
        )}
        <p className="report-footnote">
          Weekly recurring schedules. Teaching groups use their category factor
          or an explicit credited-load override; ungrouped offerings use
          department factors. Other duties are credited separately. Course units
          are independent. Room utilization excludes blocked/unavailable time
          and covers the full selected semester, regardless of program filter.
        </p>
      </div>
    </>
  );
}
