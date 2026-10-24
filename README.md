# Subject Loading and Scheduling System (SLSS)

A local-first academic administration application built with React, TypeScript, Vite, Tailwind CSS, Dexie/IndexedDB, and browser-based Excel libraries. No server, account, API key, subscription, or external database is required. The application starts empty for your real academic records. No demonstration data or sample loaders are included in the deployed application.

## Run locally

Use **Node.js 24** and **pnpm 11.25.0** (the version is pinned in `package.json`). Install pnpm using your preferred Node package-manager setup, then:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the printed URL ending in `/subject-loading-scheduler/`. Development dependencies need internet access during installation. Normal academic record operations, validation, import, export, and reporting operate locally after the app and its bundled assets finish loading. There are no remote fonts, analytics, or runtime API calls. This release does **not** install a service worker: reopening or refreshing the app offline depends on the browser's HTTP cache. Keep an already-loaded tab open for offline work.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm preview
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser tests run against the **production** build on port 4173. Run `pnpm build` first. An existing compatible Chromium executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. CI installs the Playwright-matched browser instead. `pnpm format` formats application and configuration files.

## First use

1. On **Overview**, follow **Your next step** and complete semester setup to create your academic year, semester, program and initial curriculum. To create another semester or import a Form 3 workbook, expand **All setup tasks and import options**.
2. Add subjects (student course units, weekly lecture contact hours, weekly laboratory contact hours, equipment), faculty (specialization, load limit), student sections (program, year, class size), and rooms.
3. Review **Workload rule** and **Scheduling rule**. Configure lecture/lab load factors, working days, opening/closing hours, and the severity of overload. Defaults are examples, not institutional policy.
4. Select the semester in the header. In **Loading & scheduling**, add subject offerings linking subjects and student sections to that semester.
5. Choose a class in **Assign & schedule**. Lecture/lab components are prepared from the subject’s contact hours. Choose faculty and an available room/time, then **Save assignment & meeting** once. Uncheck **Add a weekly meeting** to save faculty only. Expand group controls to split laboratory enrollment or adjust credits.
6. Review **Review & conflicts** for unassigned offerings and mismatched contact hours. Blocking errors prevent persistence and show an actionable message; valid partial schedules may be saved with visible review warnings.
7. Generate reports, export a full JSON backup, and optionally finalize the semester in Settings. Reopen the semester before changing its offerings or schedules.

[Basic user guide](docs/USER_GUIDE.md) covers setup and daily workflows.

## Faster everyday workflow

**Manual entry** starts with **Your next step** on Overview. Follow direct actions to add faculty, rooms, subjects and student sections. Records screens show the next task as prerequisites become available. **Save and add another** opens a fresh record and retains the program/curriculum context; optional details remain expandable. Fields are protected while saving, and failed saves retain your entries.

**Add classes** lets you choose a student section and select several subjects in one save. Search by code/title, select visible subjects, and review the total selection count. Existing classes are marked and cannot be added twice; subjects are limited to the section's program. Unfinished selections stay in this tab, including recovery of earlier single-class drafts. After adding classes, the first class opens for instructor and meeting assignment. The class list distinguishes missing instructors from missing meeting times, and **Your next step** returns to the next unfinished class.

**Overview** now provides a semester-start checklist, one-form term/draft creation, and **Import previous loading**. A new semester can copy offerings and group structure from an existing term without carrying forward its instructors or bookings. Use a distinct draft name for hiring alternatives; never import multiple alternative tabs into the same plan.

**Assign & schedule** opens an exact class from dashboard shortcuts and prepares lecture/lab components without a conversion step. Faculty choices show current load; the class previews the resulting total. Select faculty, time and room and save together. Repeated weekdays are validated in the same save. Completed components collapse to readable summaries with an Edit action; unfinished components stay open. Additional groups, splitting and credit overrides remain under expandable controls. Existing ungrouped records are prepared in memory and converted only when a change is saved.

**Task-based records** group everyday work under Faculty, Subjects & sections, Rooms and Semesters. The complete linked-record picker and calculation rules remain under **Advanced records and department rules**. A sole available required parent record is selected automatically. Missing prerequisite records have direct creation links.

**Unfinished edits** are kept in this tab’s session storage for class cards, quick rows, academic forms, semester setup, faculty duties and import review. The header distinguishes saved academic records from unfinished drafts and links to the relevant form. Drafts can survive navigation and refresh while session storage remains available; they are not validated academic records and are not included in JSON backups. Save before closing the tab. Storage failures are shown, and drafts can be discarded explicitly.

**Weekly timetable** uses a shared time axis, aligned class blocks and separate lanes for simultaneous classes. Faculty, section and room filters are visible above the grid. Wider department views scroll within the timetable.

**Quick edit** supports instructor, day, time and room changes. Changing an instructor applies to all meetings for the same group. Bulk assignment defaults to **Fill unassigned groups only**; replacing existing assignments requires clearing that option and confirming the operation. Conflicting bulk edits are rejected together.

**Faculty loads** shows teaching, other duties, total load, regular limit, remaining/overload and distinct course preparations. Record administration, research, extension, advising, supervision and other credits with their order/source references. Semester-specific leave is recorded as a zero-credit `leave` activity and prevents teaching assignments in that semester; it does not deactivate the instructor in other years.

## Import previous OVCAA Form 3 loading

Open **Settings & data → Data management & backups → Import your OVCAA Form 3 loading**. This is a dedicated reader for the supplied style of faculty loading form (Name of Faculty, Course/Section, Schedule, Day, Room, Load and Students in columns A–H). It is separate from the flat CSV/XLSX importer.

1. Choose a local XLSX and **one authoritative worksheet**. The source filename and printed academic-term label are shown because these can disagree. Plotting/timetable grids are not imported as loading tables.
2. Select the destination semester/program. Import teaching rows for one program at a time, excluding other-program rows for a separate import; include shared faculty duties only once. Map faculty aliases to existing roster records when needed. Exact faculty names are reused. New source names retain their rank; study leave is stored for the destination term only.
3. Match each course to a catalog record. For a missing course, enter its title and **academic course units**; these cannot be inferred from credited faculty load. New catalog records are placed in an imported curriculum snapshot, preserving historical versions with the same course code.
4. Confirm year levels for new blocks. Enrollment is kept separately for each lecture/lab group. Fractional and zero reported credits are retained with source sheet/cell references, rather than converted using an assumed institutional formula.
5. Default **Load records only** retains original time/day/room text as source notes and leaves meetings unscheduled. To import bookings now, enable that option, map room spelling variations, and confirm capacities/types for new rooms. TBA, ambiguous times, disabled days/hours, capacity failures and resource conflicts must be resolved or the affected rows excluded before importing bookings. New room locations are explicitly marked for confirmation; equipment is not invented.
6. Review/edit included rows. Day combinations such as MTh, TF, MT and ThF expand into separate meetings. Times require explicit AM/PM (NN is treated as noon). Exclude duplicate alternative assignments. Confirm the source/target choice, validate the complete proposed change, inspect its counts, then choose **Import reviewed loading**.

The optional overload-warning setting applies only to the destination semester. It preserves reported historical loads for review without changing the department-wide policy. Reimporting existing offerings/duties is rejected instead of silently overwriting them. The preview becomes invalid if local records change before commit. All file processing is local; faculty files and imported operational data are never included in the static deployment or source repository.

## Functional modules

- **Overview:** active faculty, subjects, offered class sections, assignment completion, credited load, conflicts/review items, classroom/lab weekly utilization, shortcuts, and latest changes.
- **Loading & scheduling:** guided assignment, faculty workloads, suggested room/time combinations, lecture/lab meeting CRUD and duplication, searchable resource selectors, program/faculty/subject/section/room filters, weekly timetable, and schedule review.
- **Quick edit:** inline day/start/end/room fields, Tab navigation, Ctrl/⌘ + Enter to save a row, Escape to reset, bulk assignment of filtered offerings, selected-meeting day/room edits and deletion. Bulk changes are validated atomically.
- **Rooms:** live availability search by day/time, size, room type, equipment; capacity-fit ordering, room weekly schedules, available/blocked windows, and occupied/available minutes.
- **Records:** validated create/edit/delete for all domain entities. Delete previews list selected records and all dependent records by name and count. Bulk selections delete in one validated, undoable operation after an explicit review. Deleting a semester keeps shared faculty, subjects, sections, programs and rooms. Faculty/rooms can be deactivated while preserving history; required rules have reviewed resets.
- **Data management:** CSV/XLSX import, mapping, preview, row errors, explicit valid-row commit, CSV templates, reference-ID Excel export, semester copy, JSON backup/restore, last requested-backup indicator, and persistent-storage request.
- **Reports:** all nine required report formats plus an OVCAA Form 3 loading summary, program/resource filters, Excel downloads, browser print / Save PDF, report metadata, calculation notes, and print styles.
- **Undo/redo:** up to 20 saved changes in the current session, including imports and restoration. Refresh clears undo/redo. Recent-change history keeps the latest 250 events in IndexedDB.

## Calculation and validation rules

The centralized engine is in `src/lib/engine.ts`. Schema and relationship validation are in `src/lib/model.ts`. Every UI mutation and import commit passes through the same transaction boundary in `src/lib/storage.ts`.

### Three separate quantities

- **Course units:** academic credit attached to the subject; never used implicitly as contact hours or teaching load.
- **Planned contact hours:** weekly lecture/lab hours defined on the subject. Actual scheduled contact hours are calculated from all meeting durations and compared against these targets.
- **Credited teaching load:** for each assigned offering, `planned lecture hours × lecture factor + planned lab hours × laboratory factor`. Legacy whole-offering assignments count once, regardless of number of meetings. Faculty limits apply separately per semester. Reports distinguish course units, planned/scheduled hours, and credited load.

For explicit teaching groups, credited teaching load is each assigned group's contact hours times its selected category factor (or department default), unless a nonnegative credited-load override is entered with a required reason/source. Repeated meetings do not repeat that credit. Different groups can have different instructors and credit categories. Other duty credits are added separately for the faculty total. Preparations count distinct course codes per instructor/semester. Overrides imported from a tentative form are labeled as reported values; they do not establish institutional approval.

There is one editable department-wide default workload rule and scheduling rule, plus any number of named lecture/lab credit categories. Default factors are 1 and 1 and new faculty limits default to 18; all are editable examples. A semester may override the overload severity for its own plan. No BCA, CCC, graduate or supervision formula is silently assumed. Arbitrary piecewise policy formulas and percentage-sharing of one teaching group remain outside this release. Specialization is a comma-separated subject-keyword advisory, not an automatic qualification decision.

### Scheduling

Intervals are half-open: `startA < endB && startB < endA`. Adjacent meetings do not conflict. Faculty, room, and section overlap checks are isolated by semester and weekday. Different laboratory groups within the same offering are treated as disjoint student groups and may run in parallel when their instructors and rooms differ. A lecture still conflicts with that offering’s labs. Across different offerings, section conflict checks remain conservative because this release does not store individual student rosters. Group capacity uses the group enrollment rather than the full block size. The engine also checks enabled days, valid time intervals, active resources, faculty windows, room windows/blocks, seating capacity, laboratory suitability, required equipment, duplicate/inconsistent relationships, and workload limits. Required equipment uses case-insensitive exact comma-separated names.

Faculty with no availability rows are unrestricted within department hours. Once any faculty window exists, all meetings must fit the union of their listed windows for that day. Rooms similarly use explicit `available` windows when present, intersected with department days/hours; `blocked` windows always subtract time. All windows repeat weekly across semesters. Laboratory meetings require a laboratory; lectures can use either room type. Room search finds suitable free rooms; schedule suggestions additionally check faculty and section constraints. Warnings cover missing faculty, incomplete contact hours, specialization review, and optionally overload.

### Utilization

Reports describe a **typical recurring week** in the selected semester, not date-specific attendance or a count of instructional weeks. Room utilization = union of occupied meeting minutes ÷ configured available minutes. Available minutes exclude blocked periods and time outside opening windows. Overlapping occupied minutes count once. An unavailable room with zero available minutes reports 0%; its minute columns make that condition visible. Room utilization is the full-semester room schedule even if another report filter names a program.

## Import and export

Supported imports: UTF-8 CSV and `.xlsx` (first worksheet only), at most 5,000 rows / 10 MB. `.xls`, macros, date-based calendars, merged/multirow headers, and formula evaluation are not supported. Use a single nonempty, unique header row. Keep time columns as **text in HH:MM**, booleans as `true`/`false`, and weekday numbers as 0 (Monday) through 6 (Sunday). Excel may auto-convert times: explicitly format those cells as Text before entry.

1. Select the entity and download its CSV template.
2. Create prerequisite records first. Use **Export records with IDs** to obtain foreign-key IDs. IDs are stable; blank ID mapping generates new UUIDs. To import existing loading records, import offerings, then assignments, then meetings.
3. Choose a file, map headers to fields, and validate/preview.
4. Inspect proposed rows and row-level errors. The preview displays the first 20 proposed rows. Commit only when ready; the button explicitly identifies skipped rejected rows.

Imports add new records only; duplicate IDs/codes and identical records are rejected, never silently overwritten. Related records are checked as each row is proposed. A row that conflicts is rejected; remaining valid rows are committed together only after the explicit preview action. Editing existing records uses the record form or Quick edit. CSV templates have headers only; reference Excel exports include report metadata in rows 1–4 and headers in row 5, so remove those metadata rows before using a reference export as an import source.

Reports download XLSX with title, semester/year/program, generation time, headings, and frozen headings. Print / Save PDF uses the browser's standard print dialog. No institutional signatures or policies are invented.

## Local data, backups, recovery

Academic data is stored in normalized IndexedDB tables under database `slss-local-v1`, database schema version 2. Initial schema creation is explicit via Dexie. Future releases must add a versioned Dexie upgrade before changing stored shapes; do not edit a historical schema version in place. Backup envelope schema version 2 is validated separately; version 1 backups remain readable and are upgraded with empty group/category/activity tables. IndexedDB version 2 adds those tables without rewriting legacy assignments or meetings. Unsupported versions and invalid references/schedules are rejected before replacement.

- **Back up regularly:** Settings → Data management → Download full JSON backup. Keep copies on a separate disk or approved private storage. Never commit operational records or backups to this public repository.
- **Restore:** select a valid SLSS JSON backup, review the replacement warning, and confirm. All records are replaced in one transaction; no partial restore occurs. Existing session undo can reverse restoration. Imported change history is retained in the file, but the active audit log records restoration on the current timeline.
- **Last-backup indicator:** records a requested download, not verification that the file exists or is recoverable. Open/check your downloaded file and retain more than one generation.
- **Persistent storage:** requests `navigator.storage.persist()` where supported. It reduces automatic eviction risk; it does not protect against browser-data deletion, device failure, or all data loss.
- **Concurrent tabs:** revisions are compared inside each write transaction. A stale tab cannot overwrite a newer tab. Reload the stale tab before continuing. There is no live cross-tab UI synchronization or device sync.
- **Save errors:** the prior transaction remains intact; the error and “Not saved” status remain visible. Check browser storage space/permissions and back up before clearing any browser data. Never clear storage as a first troubleshooting step.

Browser storage is **browser/profile/device/origin-specific**, not encrypted by this application. GitHub Pages only hosts public static code, never the local academic database. Use appropriate device access controls. There is no fake login or password gate. Changing hostnames or base origins creates a different browser storage space; transfer records using a backup.

## GitHub Pages

The repository's configured remote is `paulcastor30/subject-loading-scheduler`; the expected URL is:

`https://paulcastor30.github.io/subject-loading-scheduler/`

1. Push this source and lockfile to `main`.
2. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. The workflow in `.github/workflows/pages.yml` installs from the lockfile, typechecks, lints, runs unit/component tests, builds, installs Chromium, and runs production browser tests. Deployment occurs only after verification succeeds on `main` (or an explicit workflow dispatch). Pull requests verify without deployment.
4. Inspect the workflow's `github-pages` environment URL and verify the live page after deployment.

Vite's base is `/subject-loading-scheduler/`; hash navigation (`#rooms`, `#scheduling/timetable`, etc.) works on static hosting and direct refresh without server rewrites. The published artifact is **only `dist/`**. No secret/environment configuration is needed. If renaming the repository, update the Vite base and deployment documentation.

The application is deployed through this workflow at [the SLSS website](https://paulcastor30.github.io/subject-loading-scheduler/). Inspect the latest successful run and verify the live page after each update.

## Structure

```text
src/
  components/        Accessible controls and operational module screens
  lib/
    model.ts         Zod entity schemas, IDs, relationships, integrity checks
    engine.ts        Conflicts, load, available rooms, suggestions, utilization
    loading.ts       Teaching groups, sourced credits, duties and preparations
    form3.ts         Reviewed Form 3 parsing and normalized import
    storage.ts       Dexie transactions, revisions, backup, semester duplication
    imports.ts       CSV/XLSX parsing, preview validation, downloads
    reports.ts       Deterministic report projections
    useStore.ts      Save state, finalization guard, session undo/redo
    drafts.ts        Tab-scoped unfinished edits and return links
    timetable.ts     Deterministic overlap lanes for time-grid rendering
  test/              DOM and IndexedDB test setup
tests/fixtures/      Synthetic records used only by automated tests
e2e/                 Production browser workflows
.github/workflows/   Quality gates and static Pages deployment
```

## Verification and boundaries

[Local verification results](docs/VERIFICATION.md): 105 unit/component tests and 13 production browser tests passed; TypeScript, ESLint, and the production build passed.

Tests cover faculty/room/section conflicts, adjacency, containment, multiple meetings, different semesters, capacity, equipment/type, availability windows/blocks, load factors and limits, invalid references/duplicates, utilization, valid suggestions, CSV errors, preview imports, backup/restore, semester copying, IndexedDB reopen and stale writes, academic form creation, browser scheduling/editing/refresh, room search, reports, Excel import/export, and backup restoration. The README describes supported behavior rather than guaranteeing task completion times or WCAG certification.

Known boundaries: recurring weekly schedules only (no holiday/date exceptions); one faculty member per teaching group; no drag-and-drop (all edits work with keyboard-accessible forms); no automatic department-wide schedule solver; no collaboration/backend synchronization; no XLS import; no installed offline-refresh guarantee; no automatic institution-specific policy decisions beyond editable factors and documented credited-load overrides. Large imports are intentionally capped. The 50-faculty / 300-subject / 500-offering / 100-room scale is represented in the performance test; real device speed varies. Accessibility and usability targets still benefit from testing with department staff and assistive-technology users.
