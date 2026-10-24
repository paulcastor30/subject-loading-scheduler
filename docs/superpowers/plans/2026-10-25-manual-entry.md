# Manual Entry Usability Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. The user has authorized judgment and continuous execution.

**Goal:** Make manual semester preparation easier to discover and faster to complete.

**Architecture:** Extend existing record forms and dashboard; replace the generic new-offering form with a dedicated batch class editor. Keep all writes behind the existing validated commit boundary.

**Tech Stack:** Existing React, TypeScript, Vitest, Playwright, Dexie and CSS.

**Spec:** docs/superpowers/specs/2026-10-25-manual-entry-design.md

## Global Constraints

- Preserve storage schemas, validation, routes, backups, and advanced workflows.
- No new dependencies, backend, synchronization, or automatic full scheduling solver.
- Failed saves retain entered values.
- Keep unfinished selections per semester.

## Review Focus

- Multiple programs: class subjects must match the selected section's program.
- Existing classes: never duplicate a semester/section/subject combination.
- Failed commits: selections and record forms remain recoverable.
- Finalized or missing semester: class creation cannot write.
- Repeated entry: preserve context, never reuse identities or private record details.

### Task 1: Manual-entry next action and simpler record entry

Files: create `src/components/SemesterGuide.tsx`, `src/components/ManualEntry.test.tsx`; modify Dashboard, Records, styles.

Interface: `SemesterGuide({data, term, navigate})` recommends the first missing prerequisite; `RecordForm.onSave(row, addAnother?)` supports successful repeated entry.

- [x] Write behavioral tests for missing prerequisites, advisory-only review, repeated entry, fresh identity/context, and failed saves; observe expected failures.
- [x] Implement the guide, essential/optional form fields, contextual help and repeated entry.
- [x] Run targeted tests then the full unit suite.

### Task 2: Add several classes together

Files: create `src/components/AddClasses.tsx`, `src/components/AddClasses.test.tsx`; modify Scheduling and styles.

Interface: `AddClasses({data, term, commit, onDone, onCancel})` validates and atomically adds the chosen subjects for one section. `onDone(id)` opens the first new class.

- [x] Write tests for a real validated multi-subject save, program isolation, duplicates, failure recovery, draft recovery, and finalized terms; observe failures.
- [x] Implement focused class selection and integrate with existing new-class routes and actions.
- [x] Run targeted and full unit tests.

### Task 3: Valid lab suggestions and workflow verification

Files: modify engine, engine tests, e2e/workflows.spec.ts, README and user guide.

- [x] Reproduce the split-lab suggestion omission with a failing test.
- [x] Align the section prefilter with the validator's disjoint lab exception; preserve faculty/room conflicts.
- [x] Add a fresh manual browser journey covering setup, repeated record entry, batch class selection, assignment and refresh.
- [x] Run lint, production build, all unit and browser tests; inspect laptop/tablet UI and have a fresh reviewer assess the final changes.
- [x] Record results and leave changes reviewable in the current checkout; do not publish or push.

## Execution ledger

Ruling: work in the clean current checkout and execute inline, respecting the user's explicit “use your judgment and proceed” instruction. Existing dependencies and the previously passing baseline are available. No worktree or approval interruptions are needed.

Pre-flight: Tasks 1 and 2 share RecordForm only through existing Scheduling integration; AddClasses replaces the new-offering editor and preserves its route. Task 3 uses existing validation semantics. No schema changes.

Task 1: complete — next-step guidance, optional fields, retained context, fresh identities and keyboard focus. Regression testing caught a fast-entry race; all record fields now wait for the save to finish, with failed entries retained.

Task 2: complete — atomic multi-subject class selection, program isolation, duplicate prevention, legacy draft recovery, missing/finalized-semester guards. Ruling: show class creation in a focused view, because screenshot inspection showed unrelated empty scheduling panels distracted from the form.

Task 3: complete — split-lab suggestions share the validator's exception. Final verification: 105 tests across 12 files, 13 Chromium production workflows, TypeScript/build and ESLint passed. Screenshots inspected at 1280px and 768px. Fresh reviewer reported no actionable findings. Work remains local on codex/manual-entry-usability; no publishing or remote changes.
