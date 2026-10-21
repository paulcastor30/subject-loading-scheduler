# Local verification — 21 October 2026

Production build verified locally under `/subject-loading-scheduler/`. No live GitHub Pages deployment was performed.

| Check | Result |
| --- | --- |
| TypeScript project check | Passed |
| ESLint | Passed, no lint warnings |
| Vitest / React Testing Library | 48 tests passed across 5 files |
| Vite production build | Passed, no build warnings |
| Playwright Chromium on production preview | 5 tests passed |
| Representative scale fixture | 50 faculty, 300 subjects, 500 offerings/meetings, 100 rooms; validation, availability, utilization and summary projections passed |
| GitHub Pages subpath | Direct hash navigation and refresh passed locally |
| Loaded-app offline use | Faculty assignment and Excel download passed with browser networking disabled |
| PDF | Chromium generated an A4 landscape faculty weekly schedule PDF using print CSS |

The browser suite exercises optional sample loading, guided assignment, meeting creation, refresh persistence, quick edits, undo/redo, available rooms, report selection, Excel download, full JSON download and confirmed restoration, direct hash-route refresh, XLSX import field mapping/preview, rejected-row reporting, explicit commit, offline edits/exports, and PDF generation. Browser page errors were checked in the primary workflow.

Unit/integration tests cover resource overlaps, adjacency/containment, multiple meetings, semester isolation, capacity/type/equipment, availability, load factors/limits, references/duplicates, schedule recommendations, utilization, CSV parsing, import validation, all report projections, backup version/integrity, semester duplication, IndexedDB reopen, stale-write rejection, chronological history reload, and subject creation through the UI.

Local verification used the bundled Node runtime and an existing Chromium executable; CI installs its own Playwright-matched Chromium. Generated screenshots/PDFs and browser traces live in ignored `test-results/`. No operational dataset is committed. The optional sample fixture contains fictional records only.

Remaining verification boundaries: GitHub-hosted deployment and repository Pages settings have not been exercised; no formal WCAG certification, assistive-technology audit, department-user timing study, or cross-browser test matrix has been completed. Offline refresh is not guaranteed without a service worker. See README for supported calculation assumptions and product limitations.

## BSCA prospectus sample update

Verified the 51 course rows across all eight semester lists and eight suggested elective options. Tests check exceptional NST/OJT component hours, 59 catalog records, 28/23 offerings by planning semester, additive loading alongside existing records, compatible course reuse, collision rejection, duplicate-load prevention, custom-rule preservation, backup roundtrip, browser preview filtering, loading, and persistence after refresh. No real faculty or private operational records were added.
