# SLSS basic user guide

## Set up the semester

In **Settings & data → Academic records & rules**, use Record type to create prerequisite records. Start with academic years, semesters, programs, and curricula. Then enter faculty, subjects, sections, and rooms. A curriculum belongs to a program; offerings must pair a subject and section in the same program.

A subject records **course units**, **lecture contact hours per week**, and **lab contact hours per week** separately. Review your department's workload factors before assigning faculty. New faculty load limits are editable.

## Explore the supplied BSCA prospectus

Open **Data management & backups → BSCA prospectus sample**, review the source notes and course list, and click **Add BSCA prospectus sample**. It adds records without replacing your current data or rules. Then select **BSCA sample planning year** in the top bar.

The sample contains 59 catalog records (51 curriculum rows including four elective slots, plus eight elective options), two planning semesters and four illustrative blocks. Its 51 offerings start unassigned and unscheduled. Add your faculty and rooms when ready. Replace each elective-slot offering with the elective you actually selected; do not schedule both. Review internship, NST and thesis loading policy before assignment. The source contains inconsistent printed totals; course-row units and separate lecture/lab columns are preserved, and source notes explain those differences.

## Assign a class

1. Select the academic term in the top bar.
2. Open **Loading & scheduling → Guided assignment**.
3. Add an offering for a subject and student section, or select one from the list.
4. Choose faculty and click **Assign faculty**. Current credited loads appear below the selector.
5. Click **Add meeting**, enter a component (lecture/lab), weekday, start/end time, and room, then save. Repeat for every weekly meeting.
6. Use **Suggest times** to review a few suitable free room/time combinations. Suggestions check existing faculty and section bookings as well as rooms.

Changes save after validation. A blocking error appears at the top; the prior saved version stays intact. Missing faculty and incomplete contact hours are review warnings so you can build a schedule in stages.

## Make quick changes

Use **Quick edit** for spreadsheet-like editing. Tab moves between day/time/room fields. Save a row with its button or Ctrl/⌘ + Enter; Escape resets its draft. Unsaved rows have a visible label. Save a draft before switching screens.

Use filters to identify a group of offerings for bulk faculty reassignment. Confirm the affected count before applying. Select meeting checkboxes for bulk room/day edits or deletion. An invalid bulk change is rejected as a whole.

**Weekly timetable** groups classes by weekday. Filter to a faculty member, section, or room; select a class card to open its editor. All timetable changes also have a keyboard-accessible form.

Undo/redo in the header reverses recent saved changes during the session. A browser refresh resets the undo stack, but does not erase saved records.

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
