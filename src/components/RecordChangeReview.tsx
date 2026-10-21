import { useEffect, useRef, useState } from "react";
import { labels, type Data, type Entity } from "../lib/model";
import { type ChangePlan } from "../lib/recordChanges";
import { ErrorMessage, Panel } from "./UI";
const valueLabel = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map(
          (v) =>
            ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][Number(v)] ?? v,
        )
        .join(", ")
    : String(value);
export function RecordChangeReview({
  plan,
  data,
  busy,
  onApply,
  onCancel,
  onRefresh,
}: {
  plan: ChangePlan;
  data: Data;
  busy: boolean;
  onApply: () => void;
  onCancel: () => void;
  onRefresh: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setAcknowledged(false);
    heading.current?.focus();
  }, [plan]);
  const action = plan.request.action,
    stale = plan.source !== data;
  const changes = action === "delete" ? plan.removed : plan.changed;
  const groups = [...new Set(changes.map((r) => r.entity))];
  const preserved: Partial<Record<Entity, string>> = {
    semesters:
      "Shared faculty, subjects, programs, student sections and rooms are kept.",
    academicYears:
      "Shared faculty, subjects, programs, student sections and rooms are kept.",
    programs:
      "Shared faculty, rooms and academic terms are kept. This program’s curricula, subjects, sections and connected offerings are included below.",
    faculty:
      "Class offerings and room bookings are kept. Classes whose teaching assignments are removed will need another instructor.",
    rooms:
      "Class offerings and faculty assignments are kept. Bookings and availability for these rooms are included below.",
    assignments:
      "Class meetings and room bookings are kept. These classes will need a faculty assignment.",
    loadCategories:
      "Teaching groups, instructors and meetings are kept. Each affected group retains its current credited load, with a reference to the removed category.",
  };
  const confirmLabel =
    action === "delete"
      ? `Delete ${plan.removed.length} records`
      : action === "reset"
        ? "Reset to defaults"
        : `${action === "deactivate" ? "Deactivate" : "Activate"} ${plan.changed.length} ${plan.changed.length === 1 ? "record" : "records"}`;
  return (
    <Panel
      title={
        action === "delete"
          ? "Review deletion"
          : action === "reset"
            ? "Review rule reset"
            : "Review active status"
      }
    >
      <div className="padded record-change-review">
        <h3 ref={heading} tabIndex={-1}>
          Check these changes before saving
        </h3>
        <p>
          {plan.request.ids.length} selected{" "}
          {labels[plan.request.entity].toLowerCase()}
          {action === "delete"
            ? ` · ${plan.removed.length} records will be deleted in total.`
            : ` · ${plan.changed.length} records will change.`}
        </p>
        {action === "delete" && (
          <p>
            {preserved[plan.request.entity] ??
              "Only the selected records and their dependent records listed below will be removed. Other records are kept."}
          </p>
        )}
        {(action === "activate" || action === "deactivate") && (
          <p>
            No assignments, schedules or reports are deleted. Inactive faculty
            and rooms are unavailable for new work. Existing bookings remain
            visible with review warnings.
          </p>
        )}
        {action === "reset" && (
          <>
            <p>
              Restore application defaults for this rule only. These defaults
              are not university policy. Existing schedules are kept; the reset
              is blocked if it would make them invalid.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Setting</th>
                    <th>Current</th>
                    <th>Default</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(plan.next[plan.request.entity][0] ?? {})
                    .filter(([key]) => key !== "id")
                    .map(([key, value]) => (
                      <tr key={key}>
                        <th>
                          {key
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (s) => s.toUpperCase())}
                        </th>
                        <td>
                          {valueLabel(
                            (
                              plan.source[
                                plan.request.entity
                              ][0] as unknown as Record<string, unknown>
                            )[key],
                          )}
                        </td>
                        <td>{valueLabel(value)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {groups.map((entity) => (
          <details key={entity} open={entity === plan.request.entity}>
            <summary>
              {labels[entity]} (
              {changes.filter((r) => r.entity === entity).length})
            </summary>
            <ul>
              {changes
                .filter((r) => r.entity === entity)
                .map((r) => (
                  <li key={r.id}>{r.name}</li>
                ))}
            </ul>
          </details>
        ))}
        {action === "delete" && plan.changed.length > 0 && (
          <details>
            <summary>
              Records kept with preserved load credits ({plan.changed.length})
            </summary>
            <ul>
              {plan.changed.map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
            </ul>
          </details>
        )}
        {plan.finalizedDeleted.length > 0 && (
          <div className="alert warning">
            This also deletes finalized semester records:{" "}
            {plan.finalizedDeleted.join("; ")}. Download a backup before
            continuing.
          </div>
        )}
        {plan.errors.map((message) => (
          <ErrorMessage key={message} message={message} />
        ))}
        {stale && (
          <ErrorMessage message="Records changed after this preview. Review the changes again before continuing." />
        )}
        {stale && (
          <button disabled={busy} onClick={onRefresh}>
            Review changes again
          </button>
        )}
        {!plan.errors.length && !stale && (
          <label className="check">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={busy}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            I reviewed the affected records and want to{" "}
            {action === "reset"
              ? "reset this rule"
              : action === "delete"
                ? "delete them"
                : `${action} them`}
            .
          </label>
        )}
        <p className="note">
          Undo restores this change during the current session. Download a JSON
          backup to keep a copy beyond this session.
        </p>
        <div className="actions">
          <button
            className={action === "delete" ? "danger-text" : "primary"}
            disabled={busy || !acknowledged || stale || plan.errors.length > 0}
            onClick={onApply}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
          <button disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </Panel>
  );
}
