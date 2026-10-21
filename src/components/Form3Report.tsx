import type { Data } from "../lib/model";
import {
  loadRows,
  otherLoad,
  preparations,
  teachingLoad,
} from "../lib/loading";
export function Form3Report({
  data,
  term,
  faculty,
}: {
  data: Data;
  term: string;
  faculty: string;
}) {
  const people = data.faculty.filter(
    (f) =>
      (!faculty || f.id === faculty) &&
      (f.active ||
        f.status === "studyLeave" ||
        data.loadActivities.some(
          (a) => a.semesterId === term && a.facultyId === f.id,
        ) ||
        data.assignments.some(
          (a) =>
            a.facultyId === f.id &&
            data.offerings.some(
              (o) => o.id === a.offeringId && o.semesterId === term,
            ),
        )),
  );
  return (
    <div className="form3-report">
      {people.map((f) => {
        const rows =
            f.status === "studyLeave"
              ? [["Study leave", "Status", "—", "—", "—", 0, "—", ""]]
              : loadRows(data, term, f.id),
          teaching = teachingLoad(data, f.id, term),
          other = otherLoad(data, f.id, term),
          total = teaching + other;
        return (
          <section className="faculty-report-block" key={f.id}>
            <h3>
              {f.name}
              {f.rank && <small> · {f.rank}</small>}
            </h3>
            <table>
              <thead>
                <tr>
                  {[
                    "Course / section / duty",
                    "Group / category",
                    "Schedule",
                    "Day",
                    "Room assignment",
                    "Academic / other credit",
                    "Students",
                    "Credit reference",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((v, j) => (
                      <td key={j}>
                        {typeof v === "number" && j === 5 ? v.toFixed(2) : v}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="load-total">
                  <td colSpan={5}>Total faculty load</td>
                  <td>{total.toFixed(2)}</td>
                  <td colSpan={2}>
                    Teaching {teaching.toFixed(2)} · Other {other.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={5}>
                    Preparations: {preparations(data, f.id, term)} · Regular
                    limit: {f.maxLoad}
                  </td>
                  <td colSpan={3}>
                    Over limit: {Math.max(0, total - f.maxLoad).toFixed(2)} ·
                    Under limit: {Math.max(0, f.maxLoad - total).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}
      <p className="note">
        Each assigned group is credited once, even when it meets on several
        days. Reported or approved overrides include their source. This report
        is a working Form 3 summary; institutional signatories and approval are
        not implied.
      </p>
    </div>
  );
}
