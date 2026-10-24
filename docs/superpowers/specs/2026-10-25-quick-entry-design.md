# Quick Entry for academic records

The user approved Quick Entry for manual subject, faculty and classroom entry. Work directly on main, per their stated branch preference. Extend the existing React/TypeScript application without new dependencies or storage schema changes.

## Approach and intent

A shared editable table inside each supported Records screen reduces repeated form submissions. Single-record forms remain available. A separate upload wizard would repeat the existing importer, and more single-form shortcuts would leave batch entry slow; use inline batch entry with optional tab-separated paste instead.

## User behavior

- Quick entry is offered beside Add record for subjects, faculty and rooms. A direct draft link reopens the correct table.
- Shared defaults: subjects use one curriculum plus course units and lecture/lab hours; faculty use a load limit; rooms use building/type/capacity. Defaults start with existing example values and are visibly editable. Empty row cells inherit shared defaults; entered values override them. Curriculum is selected by name, never an ID the user must type.
- Essential columns are shown initially; optional equipment, faculty specialization/rank columns can expand. Hidden values remain part of the draft and save.
- Add a row, duplicate a row, or remove an unsaved row. Tab follows normal controls; Enter moves to the next row's first cell, creating it when necessary. Save is explicit, never triggered by Enter in a cell.
- An expandable paste area accepts tab-separated Excel rows or one faculty name per line. It explains column order, supports quoted cells/newlines and recognized headers, and appends below entered rows without overwriting them. Limit each batch to 500 rows and pasted text to 1,000,000 characters; reject oversize/malformed input without losing current entries.
- Blank rows are ignored. Nonblank rows receive field-level validation, including required numbers (never coercing blank required values to zero). Subject codes are unique within the selected curriculum, room codes are unique, and matching faculty names are flagged to prevent accidental repeats. Legitimate same-name people can use the existing individual form.
- Show the pending count and feedback before one atomic Save N records. No valid-only partial save and no existing-record updates. Validate against current records at save, keep all input after failure, protect fields while saving, and use the normal commit boundary so Undo remains available.
- Drafts retain defaults, rows and unapplied pasted text per entity in this tab. Navigation and refresh recover them. Successful save starts an empty batch with the current shared defaults retained and fresh row IDs.

## Boundaries and verification

No automatic policy guesses or full roster creation. No existing-record bulk edit. Browser storage and backup behavior remain unchanged. Test schema errors, whitespace/case duplicates, missing curricula, independent curricula, pasted quoting/header/limits, row operations, keyboard continuation, failed/pending saves, data changes since entry, retained defaults, fresh identities, draft recovery and existing workflows. Verify production browser entry for all three entity types, Undo and refresh; inspect laptop/tablet layout. No measured time-saving claim without staff observation.
