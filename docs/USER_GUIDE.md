# SLSS basic user guide

## Set up the semester

Start on **Overview → Start a semester / draft**. This creates the academic year, semester, program and initial curriculum together. Then use the task buttons in **Settings & data → Academic records & rules**: Faculty, Subjects & sections, Rooms and Semesters. The full Record type picker and calculation rules remain under **Advanced records and department rules**. A curriculum belongs to a program; offerings must pair a subject and section in the same program.

A subject records **course units**, **lecture contact hours per week**, and **lab contact hours per week** separately. Review your department's workload factors before assigning faculty. New faculty load limits are editable.

## Start quickly

Use the **Get the semester ready** checklist on Overview. **Start a semester / draft** creates the year and term together. You can copy prior offerings and group structure without copying instructors or meetings. Use different draft names for hiring scenarios. Checklist items open the relevant records screen; **Import previous loading** opens the reviewed Form 3 importer.

## Assign a class

1. Select the academic term in the top bar.
2. Open **Loading & scheduling → Assign & schedule**, or use a class’s **Assign →** shortcut on Overview.
3. Add a class for a subject and student section, or choose an existing class. If a prerequisite is missing, follow its creation link; unfinished academic forms remain in this tab.
4. The app prepares lecture/lab components from subject contact hours. Choose **Faculty for this group**; review the resulting faculty load.
5. Enter day, start/end and an **Available room**. Use **Suggest available times** or **Repeat on other days** when useful. Click **Save assignment & meeting** to save faculty, credits and bookings together. To assign without scheduling yet, uncheck **Add a weekly meeting** and click **Save assignment**.
6. Completed components show compact summaries. Use **Edit assignment or meetings** to change one. Inside the expanded form, **Edit meeting** fills the existing meeting rather than creating a duplicate. Expand **Class size, hours and load-credit settings** for enrollment, contact hours, credit categories and sourced overrides. **Split, unassign or remove this group** contains the less frequent structural actions.

Changes save after validation. A blocking error appears at the top; the prior saved version stays intact. Missing faculty and incomplete contact hours are review warnings so you can build a schedule in stages.

## Make quick changes

Use **Quick edit** for spreadsheet-like editing. Tab moves between day/time/room fields. Save a row with its button or Ctrl/⌘ + Enter; Escape resets its draft. Unsaved rows have a visible label. Unfinished rows remain in this tab when switching screens; save them to update academic records.

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

## Delete records without navigating through dependencies

In **Academic records & rules**, choose the task and subtab. The full record picker remains under **Advanced records and department rules**. Click a row’s **Delete**, or select several rows (the header checkbox selects all visible filtered rows) and choose **Delete selected**. Selection persists when you filter the same record type; the selected count includes any selected rows hidden by the filter. Use **Clear selection** to start over.

The inline review lists names and counts for every affected record. Expand each category to inspect connected records. Deleting a semester removes its offerings, lecture/lab groups, assignments, meetings and other duty credits while keeping shared faculty, subjects, programs, curricula, student sections and rooms. Deleting a year includes its semesters. Deleting faculty removes teaching assignments, duties and availability but keeps class offerings and room bookings for reassignment. Deleting rooms removes their meetings and availability while keeping classes and instructors. Removing a load-credit category keeps groups and converts their current credits to sourced overrides so calculated totals do not change silently.

Check the review acknowledgement, then apply the displayed action. **Cancel** changes nothing. **Undo** restores the whole operation during the current session; refresh ends session Undo. Download a JSON backup before large deletions. If records change after preview, use **Review changes again**. Deleting an entire finalized semester is explicitly identified in the preview; partial deletion of records used by a finalized semester requires reopening that semester first.

## Deactivate instead of deleting history

Faculty and rooms have **Deactivate** and **Activate** actions. You can also select several and choose **Deactivate selected**. Review the status change before saving. Deactivation keeps historical assignments, weekly schedules, duty credits and reports, with visible inactive-resource warnings. Inactive resources are unavailable for new assignments/bookings. Activate or reassign before modifying affected meetings. Undo can reverse deactivation.

## Reset required rules

Choose **Workload rule** or **Scheduling rule**, then **Reset to defaults**. Compare current/default values in the preview. Application defaults are not institutional policy. The reset is blocked if it would make existing schedules invalid. No academic records or schedules are deleted. Confirm the reviewed reset, or cancel; session Undo also applies.

## Unfinished edits and saved records

The header’s **Saved academic records** status applies to validated records already in IndexedDB. The amber unfinished-edit list is separate: open it to **Continue** a form or explicitly **Discard draft**. Academic forms, class assignments/meetings, Quick Edit, semester setup, other duties and import reviews keep unfinished values in this tab’s session storage. You can change screens and return, and refresh can recover the draft while that storage remains available. Save before closing the tab or browser; session storage is not a backup. JSON backups include saved academic records only. Storage failures show a warning to finish before leaving. The browser may warn when leaving with unfinished edits.

A recovered import has not imported anything yet. Validate again against current records, then choose the final import action. Form 3 review initially emphasizes unmatched courses and flagged source rows. **Show all courses** and **Show all source rows** reveal the full source for checking or exclusions. Every included row is validated whether visible or hidden.

## Read the weekly timetable

Open **Weekly timetable** and choose a faculty member, student section or room using the visible filters. Classes align on a common time axis; simultaneous classes occupy separate lanes. Select a class to edit it. Large department views can be wider than the screen, so scroll inside the timetable or select a resource to focus it. Room schedules use the same time-grid display.
