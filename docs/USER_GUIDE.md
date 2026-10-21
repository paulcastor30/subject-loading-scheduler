# SLSS basic user guide

## Set up the semester

In **Settings & data → Academic records & rules**, use Record type to create prerequisite records. Start with academic years, semesters, programs, and curricula. Then enter faculty, subjects, sections, and rooms. A curriculum belongs to a program; offerings must pair a subject and section in the same program.

A subject records **course units**, **lecture contact hours per week**, and **lab contact hours per week** separately. Review your department's workload factors before assigning faculty. New faculty load limits are editable.

## Start quickly

Use the **Get the semester ready** checklist on Overview. **Start a semester / draft** creates the year and term together. You can copy prior offerings and group structure without copying instructors or meetings. Use different draft names for hiring scenarios. Checklist items open the relevant records screen; **Import previous loading** opens the reviewed Form 3 importer.

## Assign a class

1. Select the academic term in the top bar.
2. Open **Loading & scheduling → Guided assignment**.
3. Add an offering for a subject and student section, or select one from the list.
4. For separate components, click **Set up lecture & lab groups**. Each group has an instructor, enrollment, contact hours and credited load. Faculty options show current load; selecting one previews the resulting total. Save each group. Existing simple offerings can still use **Assign faculty**.
5. Use **Split lab into two** for smaller laboratory groups, then **Schedule this group**. Select a day/time to see available rooms that fit its enrollment. Use **Repeat on other days** to save several weekly meetings together. For existing simple offerings, **Add meeting** still works.
6. Use **Suggest available times** to review a few suitable free room/time combinations. Suggestions check existing faculty and section bookings as well as rooms.

Changes save after validation. A blocking error appears at the top; the prior saved version stays intact. Missing faculty and incomplete contact hours are review warnings so you can build a schedule in stages.

## Make quick changes

Use **Quick edit** for spreadsheet-like editing. Tab moves between day/time/room fields. Save a row with its button or Ctrl/⌘ + Enter; Escape resets its draft. Unsaved rows have a visible label. Save a draft before switching screens.

Instructor changes in Quick edit affect the matching group’s meetings. Bulk assignment defaults to filling unassigned groups; clear that option only when you intend to replace existing assignments. Use filters to identify offerings for bulk faculty reassignment. Confirm the affected count before applying. Select meeting checkboxes for bulk room/day edits or deletion. An invalid bulk change is rejected as a whole.

**Weekly timetable** groups classes by weekday. Filter to a faculty member, section, or room; select a class card to open its editor. All timetable changes also have a keyboard-accessible form.

Undo/redo in the header reverses recent saved changes during the session. A browser refresh resets the undo stack, but does not erase saved records.

## Review total faculty load

Open **Faculty loads** to see teaching credits, other duties, totals, limits and preparation counts. Select a faculty member to add or edit duty credits and source/order references. Use a zero-credit **leave** activity for semester-specific study leave. In **Reports**, select **OVCAA Form 3 Loading Summary** for a grouped printable form or Excel export with totals and preparations.

## Import a previous loading form

In Data management, choose **Choose Form 3 workbook**, then the authoritative loading worksheet. Confirm the destination semester and program, course catalog matches, block years and faculty aliases. Course units cannot be taken from faculty credited load; enter missing catalog details explicitly. Review source term labels, which can disagree with filenames.

By default, import **load records only** and finish scheduling afterward. To bring in room bookings, enable meeting import, match room names and confirm capacities/types. Correct malformed times/TBA rooms or exclude rows. Review the row selection, confirm the target, validate, then **Import reviewed loading**. Reported credits keep their source references. Duplicate offerings are rejected; use a new draft for an alternative plan. The file stays on this browser and is not uploaded.

## Find a room

Open **Rooms**, enter weekday, start/end time, class size, room type, and equipment. Results update immediately and favor a close capacity fit. Select a result to inspect its weekly schedule. Room windows and recurring maintenance periods are entered under **Settings → Room availability**.

A room with no explicit available windows uses department scheduling hours. Once available windows are entered, only those windows are available. Blocked windows always subtract from them. Faculty availability works similarly, without blocked-window records.

## Review and report

Open **Review & conflicts** and resolve unassigned faculty, incomplete weekly hours, and specialization/load advisories. Blocking conflicts cannot be saved. In **Reports**, choose a report and optional resource/program filter, then **Export Excel** or **Print / Save PDF**. Printed reports include term/year, title, generation date, and calculation notes.

Room utilization describes a recurring week, excluding blocked/unavailable minutes from capacity. It is not actual attendance or a date-specific instructional calendar.

## Reuse last semester

Create the destination semester first. In **Data management & backups → Copy a semester**, choose source/destination and whether to include faculty and meetings. The copy uses fresh IDs and stops if it would introduce duplicate offerings or invalid schedules.

## Import academic records

Download the entity's CSV template. Import parents before related records, using reference exports to find IDs. Keep time fields as text `HH:MM`, weekday as 0–6, booleans as `true`/`false`. Choose a CSV or XLSX, map the fields, and validate. Review valid rows and rejected-row messages before committing. The commit button clearly states when rejected rows will be skipped. Existing records are never silently replaced.

## Protect your records

Download JSON backups often and before finalizing a semester. Store copies outside the browser and keep older generations. The backup indicator only means a download was requested. Restore validates the file before asking to replace local data.

Records belong to this browser/profile/device. They do not sync. Clearing browser data or losing a device may erase them. A persistent-storage request can reduce eviction but does not guarantee recovery. Use one editing tab; stale writes from another tab are rejected, requiring a reload.

To finalize, edit the semester's **Finalized** checkbox after review and backup. To edit a finalized schedule later, clear that checkbox first.

## Existing data and backups

The update preserves existing simple offerings and browser records. Database version 2 adds teaching groups, load categories and other duty activities. JSON backup version 2 is now exported; version 1 backups still restore. After updating, download a fresh backup. Save visible group/row drafts before switching offerings or pages.
