import {
  cloneElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { days, rowName, type Data, type Entity } from "../lib/model";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string }>;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-describedby": hint ? `${id}-hint` : undefined,
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
  empty = "Select…",
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  empty?: string;
  required?: boolean;
  hint?: string;
}) {
  const [search, setSearch] = useState("");
  const id = useId();
  return (
    <div className="select-field">
      <label htmlFor={id}>{label}</label>
      {options.length > 8 && (
        <input
          aria-label={`Search ${label}`}
          placeholder={`Search ${label.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      <select
        id={id}
        value={value}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{empty}</option>
        {options
          .filter(
            (o) =>
              o.id === value ||
              o.name.toLowerCase().includes(search.toLowerCase()),
          )
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
      </select>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Reference({
  data,
  entity,
  activeOnly = false,
  ...rest
}: {
  data: Data;
  entity: Entity;
  activeOnly?: boolean;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  empty?: string;
  hint?: string;
}) {
  return (
    <Select
      {...rest}
      options={data[entity]
        .filter(
          (r) =>
            !activeOnly || !("active" in r) || r.active || r.id === rest.value,
        )
        .map((r) => ({
          id: r.id,
          name: rowName(data, entity, r.id),
        }))}
    />
  );
}
export function DaySelect({
  value,
  onChange,
  label = "Day",
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {days.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        ▤
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className="alert error" role="alert">
      {message}
    </div>
  ) : null;
}
