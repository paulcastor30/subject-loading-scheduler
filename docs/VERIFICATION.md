# Operational review — 21 October 2026

The application was reviewed as a single-browser academic loading tool: initial setup → reviewed import or record entry → faculty assignment → weekly meetings → validated IndexedDB save → reload → report/export → backup and recovery. The production bundle starts empty and contains no sample-data controls, fictional department records or BSCA sample curriculum.

## Findings and corrections

| Finding                                                                                     | Correction and evidence                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sidebar backup shortcut opened academic records instead of recovery tools                   | Route now opens data management directly; browser regression verifies the destination and refresh.                                                                                                                                   |
| Switching faculty could retain another person's duty credits, category and source reference | All draft fields reset together; component test verifies the new person's saved duty contains no inherited credits/reference.                                                                                                        |
| Removing a duty while editing it left a draft that could recreate it                        | Successful removal clears the matching draft; component regression covers this sequence. Duty saves disable the form until complete.                                                                                                 |
| Demonstration loaders and sample curriculum distracted from operational use                 | Removed production components, data modules and CSS. Synthetic test records moved to tests/fixtures and restored through the real backup UI in browser tests. The built assets were searched for the removed data and sample labels. |
| Verification documentation described an older, undeployed version                           | Updated this review and user instructions to match supported workflows and the deployed application.                                                                                                                                 |

## Local verification

| Check                                          | Result                                                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| TypeScript project check                       | Passed                                                                                                                      |
| ESLint                                         | Passed                                                                                                                      |
| Vitest / React Testing Library                 | 88 tests passed across 8 files                                                                                              |
| Vite production build                          | Passed, no build warnings                                                                                                   |
| Playwright Chromium against production preview | 9 workflows passed                                                                                                          |
| Production sample-data scan                    | No removed sample labels, faculty names or BSCA sample IDs in dist                                                          |
| Representative scale fixture                   | 50 faculty, 300 subjects, 500 offerings/meetings, 100 rooms passed validation, availability, utilization and summary checks |

The former sample-curriculum tests were removed along with that feature; core academic, scheduling, storage and import coverage remains. New duty-edit regressions were added. The browser suite covers fresh empty setup, subject assignment, meetings, quick edits, undo/redo, room search, report/Excel export, print-to-PDF, backup/restore, refresh persistence, direct hash routes, offline loaded-tab edits, split labs, faculty duties, selected-sheet Form 3 imports and source-credit preservation. No private workbook or real faculty dataset is committed.

Core tests cover overlaps, adjacent intervals, semester isolation, multiple meetings, group enrollment/capacity, room type/equipment, faculty and room windows, load factors/limits/overrides, other duties, preparation counts, references/duplicates, import row validation, report projections, backup integrity/versions, semester copies, IndexedDB migrations/reopen and stale-write rejection.

## Assessment and practical boundaries

The tested workflows support real single-browser departmental planning and recordkeeping. Imported credits, course units, enrollment, room capacity/equipment, availability and workload rules still need confirmation against department records; the software cannot establish institutional approval from a tentative form. The Form 3 summary is a loading report, not an official signature or approval process.

Records remain in one browser/device. Keep regular external JSON backups, plus PDF/Excel copies of completed reports. Finalizing locks the semester's offering/group/duty/assignment/meeting edits until reopened; shared catalog, faculty labels and calculation settings are live references rather than immutable historical snapshots. Retain the exported report and backup for an exact submitted version.

Schedules represent a recurring week, without date-specific holidays or examination exceptions. Distinct laboratory groups within one offering are treated as disjoint; across different courses the section-overlap check is conservative because individual student membership is not stored. Suggestions assist scheduling but do not solve the entire department automatically. Normal data operations work in an already-loaded offline tab; offline reload is not guaranteed. No cross-device synchronization is provided.

The time-to-completion targets, formal WCAG conformance, assistive-technology behavior and cross-browser matrix have not been independently certified. Local browser checks used Chromium; CI installs its own matching Chromium. Screenshots/PDFs/traces are ignored test artifacts.

## Reviewed record deletion and status management

Added a centralized transitive deletion planner using the data model relationships. The planner computes names/counts and validates the complete result before confirmation. Tests cover semester/year deletion, shared-record preservation, dependent cleanup, multi-record deletion without duplicate counts, faculty/room removal semantics, finalized-term protection, explicit whole-finalized-term deletion, load-category credit preservation, missing IDs and stale previews. Rule resets compare defaults and reject invalid results before saving. Inactive faculty/rooms can remain in historical records as warnings; new/changed assignments and meetings are checked against active resources across normal saves, imports and semester copying.

Component tests cover dependency previews, confirmation gating, cancellation, bulk selection, stale-preview re-review and required-rule resets. Two additional production browser workflows exercise cancel/delete/undo/redo/reload, preservation of shared faculty, bulk deletion, rule reset and deactivation with preserved bookings and exclusion from new faculty choices. No user operational records were deleted for these tests.
