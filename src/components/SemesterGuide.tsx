import { offeringComplete } from "../lib/loading";
import { validate } from "../lib/engine";
import type { Data } from "../lib/model";
import { useMemo } from "react";

export function SemesterGuide({
  data,
  term,
  navigate,
  currentEntity,
}: {
  data: Data;
  term: string;
  navigate: (page: string, mode?: string) => void;
  currentEntity?: string;
}) {
  const classes = data.offerings.filter((o) => o.semesterId === term);
  const issues = useMemo(() => validate(data, term), [data, term]);
  const unfinished = classes.find(
    (o) =>
      !offeringComplete(data, o.id) ||
      issues.some(
        (i) =>
          i.offeringId === o.id &&
          ["contact-hours", "missing-component"].includes(i.code),
      ),
  );
  const steps = [
    {
      done: !!term,
      title: "Create your semester",
      detail:
        "Choose the academic year, semester and program. We will prepare the related records for you.",
      action: "Set up semester",
      page: "dashboard",
      mode: "setup",
    },
    {
      done: data.faculty.some((f) => f.active),
      title: "Add your faculty",
      detail:
        "Enter instructors and their teaching load limits. Save and add another to build your roster without reopening the form.",
      action: "Add faculty",
      page: "settings",
      mode: "faculty?record=new",
    },
    {
      done: data.rooms.some((r) => r.active),
      title: "Add your rooms",
      detail:
        "Enter each room's name, seating capacity and whether it is a classroom or laboratory.",
      action: "Add rooms",
      page: "settings",
      mode: "rooms?record=new",
    },
    {
      done: data.subjects.length > 0,
      title: "Add your subjects",
      detail:
        "Enter subject codes, titles and weekly lecture/laboratory hours. You only need to enter each subject once.",
      action: "Add subjects",
      page: "settings",
      mode: "subjects?record=new",
    },
    {
      done: data.sections.length > 0,
      title: "Add your student sections",
      detail:
        "A section is a student group, such as First Year A. Enter its program, year level and class size.",
      action: "Add sections",
      page: "settings",
      mode: "sections?record=new",
    },
    {
      done: classes.length > 0,
      title: "Choose this semester's classes",
      detail:
        "Choose a student section, then select all its subjects together. There is no need to add them one at a time.",
      action: "Add classes",
      page: "scheduling",
      mode: "new",
    },
    {
      done: !unfinished,
      title: "Assign instructors and meeting times",
      detail:
        "Work through one class at a time. Choose an instructor, time and available room, then save them together.",
      action: "Continue scheduling",
      page: "scheduling",
      mode: `guided?offering=${encodeURIComponent(unfinished?.id ?? "")}`,
    },
  ];
  const next = steps.find((s) => !s.done);
  const finalized = data.semesters.find((s) => s.id === term)?.finalized;
  if (
    currentEntity &&
    next?.page === "settings" &&
    next.mode.split("?")[0] === currentEntity
  )
    return null;
  return (
    <section
      className={`semester-guide no-print${currentEntity ? " compact-guide" : ""}`}
      aria-label="Your next step"
    >
      <div>
        <p className="eyebrow">
          {finalized ? "SEMESTER FINALIZED" : "YOUR NEXT STEP"}
        </p>
        <h2>
          {finalized
            ? "Your semester is ready to view"
            : (next?.title ?? "Review your semester and prepare reports")}
        </h2>
        <p>
          {finalized
            ? "View schedules, print reports or download a backup. Reopen the semester in Settings if you need to make changes."
            : (next?.detail ??
              "Review any remaining advice, then print or export the reports you need. Keep a backup of your finished work.")}
        </p>
        <button
          className="primary"
          onClick={() =>
            navigate(
              finalized || !next ? "reports" : next.page,
              finalized || !next ? "" : next.mode,
            )
          }
        >
          {finalized || !next ? "Review and print reports" : next.action}
        </button>
      </div>
      {!currentEntity && (
        <ol aria-label="Semester preparation progress">
          {steps.slice(0, 6).map((step) => (
            <li key={step.action}>
              <button
                onClick={() => navigate(step.page, step.mode)}
                aria-current={step === next ? "step" : undefined}
              >
                <span aria-hidden="true">{step.done ? "✓" : "○"}</span>{" "}
                {step.title}
                <small>{step.done ? "Started" : "To do"}</small>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
