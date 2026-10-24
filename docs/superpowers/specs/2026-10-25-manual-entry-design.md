# Easier manual semester preparation

The user enters academic records manually and has authorized proceeding with judgment, without further design questions. Improve the existing React application for technical and nontechnical staff. Preserve storage schemas, validation, routes, backups, and advanced workflows.

## Approach

Use progressive guidance within the existing workspace. A new separate wizard would duplicate record editors and make returning to work harder; copy-only changes would leave repeated class entry untouched. Keep the current screens, recommend one next action, simplify everyday forms, and add several classes together.

## Behavior

- Overview recommends the first missing prerequisite: semester, active faculty, active rooms, subjects, sections, classes, then unfinished assignments/meeting hours. Offer direct actions; keep imports and all record screens available. Advisory warnings must not permanently prevent reaching reports.
- Everyday faculty, subject, section, and room forms put essential fields first. Optional details are expandable. Existing values and all advanced entity editors remain editable. Explain automatically selected parents in human language.
- New record entry supports Save and add another. Only successful saves reset the form; retain context (curriculum, program, year level) but clear record identity, name and code. Failed saves retain entered values. Existing records retain the ordinary edit flow.
- Add classes by selecting a student section and several subjects, with subject search and selection counts. Show the destination semester as context, restrict subjects to the section's program, exclude existing classes, and commit all selections atomically. Keep unfinished selections per semester. Make prerequisite links actionable. Disable writes for finalized terms.
- Use “classes” for the everyday scheduling surface. Explain section, curriculum, contact hours, and load limits where needed. Keep Excel/CSV field names and database identifiers unchanged.
- Suggestions should offer valid simultaneous split laboratory sessions using the same conflict rules as save validation.

## Validation and boundaries

Use behavioral component tests for guidance, repeated entry and failed saves, batch class creation, incompatible programs, duplicates, finalized terms, and draft recovery. Extend production browser tests with a fresh manual-entry journey. Run the full existing suite, TypeScript, lint, build and Chromium workflows; inspect the updated UI at laptop/tablet widths. No new dependencies, backend, synchronization, or automatic full scheduling solver. Ease of use needs subsequent observation with department staff; do not claim measured time savings or accessibility certification.
