# Quick Entry Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. The user approved execution and prefers main.

**Goal:** Enter subjects, faculty and rooms together with fewer repeated actions.

**Architecture:** A small pure module owns column definitions, paste parsing and batch inspection. A shared component owns drafts and row interactions. Records provides the entry point; all writes go through the existing validated commit boundary.

**Tech Stack:** React, TypeScript, Zod, existing useDraft, Vitest and Playwright.

**Spec:** docs/superpowers/specs/2026-10-25-quick-entry-design.md

## Global Constraints

- Work on main; no new dependencies or schema changes.
- Maximum 500 rows and 1,000,000 pasted characters.
- Batch saves only add records and are atomic; failures retain all input.
- Existing single-record forms and advanced workflows remain available.

## Review Focus

- Duplicate codes differing only by case/space, including rows entered while records change.
- Blank numeric defaults must not become unintended zero credits.
- Drafts and current defaults must survive failed saves and successive successful batches.
- Paste parsing must reject malformed/oversize input without replacing existing entries.
- Keyboard and pending-save behavior must prevent accidental submission or lost typing.

### Task 1: Batch preparation and paste parser

Files: create src/lib/quickEntry.ts and src/lib/quickEntry.test.ts.

Interface: QuickEntity, QuickRow, column/default definitions, parseQuickPaste(entity, text), inspectQuickEntry(data, entity, rows, defaults). Inspection returns parsed records and field errors without expensive whole-dataset validation on every keystroke.

- [x] Write tests for parsing, defaults, required numbers, duplicate scopes, missing parents and limits; observe expected failures.
- [x] Implement the pure helpers with existing schemas and explicit duplicate checks.
- [x] Run targeted tests and the full suite.

### Task 2: Drafted table and Records integration

Files: create src/components/QuickEntry.tsx and src/components/QuickEntry.test.tsx; modify Records, App and styles.

Interface: QuickEntry({data, entity, commit, onClose}); Records onEntityChange accepts an optional record route so draft links use record=quick.

- [x] Write behavioral tests for repeated batches/defaults, keyboard rows, duplicate/remove, paste append, failed/pending saves, live duplicate detection and navigation recovery; observe failures.
- [x] Implement shared defaults, table controls, field feedback, paste, optional columns, draft restoration and atomic save.
- [x] Add the Records route/entry point, preserving normal forms and reviewed deletions.
- [x] Run targeted and full unit tests.

### Task 3: Workflow verification and delivery

Files: extend e2e/workflows.spec.ts; update README, USER_GUIDE, VERIFICATION.

- [x] Add browser entry for subjects/faculty/rooms, navigation/refresh recovery and Undo.
- [x] Run TypeScript/build, lint, all unit and production browser tests; inspect desktop/tablet screenshots.
- [x] Request a fresh code review and resolve actionable findings.
- [x] Record verified results and leave local changes reviewable on main; do not push or deploy.

## Execution ledger

Pre-flight: parser fields are the same fields consumed by the table, with curriculum kept as a shared subject default. The component performs whole-dataset checkData only when saving. No existing data migration is necessary.

Ruling: proceed inline without additional approvals, honoring the user's go and existing request to work on main.

Task 1: complete — pure batch inspection and TSV parsing with schemas, duplicate scopes, stable identities, blank/default handling, and size limits. Unit tests were observed failing before implementation.

Task 2: complete — shared defaults, keyboard row continuation, duplicate/remove, optional columns, explicit paste append, visible field errors, atomic save, per-entity session drafts, repeated batches and Records draft routes. Pending writes protect fields. Invalid pasted numeric/room-type values remain visible for correction; recognized room type capitalization is normalized.

Task 3: complete — full production browser entry covers all three record types, draft navigation/refresh, optional field recovery, invalid-row correction, atomic Undo/Redo, persistence and responsive layouts. A fresh reviewer found a duplicated scroll hint that inflated every row; a browser regression reproduced 160px valid rows before moving the hint once above the table. The height regression now passes.

Verification: 126 unit/component tests across 14 files, TypeScript/build, ESLint and 14 Chromium production workflows passed. Desktop/tablet screenshots inspected. Work stays local and uncommitted on main; no branch creation, push or deployment.
