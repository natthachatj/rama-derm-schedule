# Activity schedule and dashboard update

The existing work schedule, authentication, leave approvals and PDF export remain in place. Activities use the same private, revision-checked workspace storage but do not modify clinic plans. No new service account, API key, domain, or environment variable is required.

## Dashboard and calendar

The four summary tiles and Training balance panel appear only in the private admin workspace. Fellows and public visitors see today's assignments, upcoming activities, and the other schedule controls. Public preview follows the public dashboard layout.

The Calendar page opens in Work schedule, with Activity schedule and Combined one tap away. Switching keeps the selected date and day/week/month/agenda mode. The academic-year matrix remains available for Work; switching from that matrix to Activities or Combined uses Month. Work also has an Agenda list. Activities and Combined provide Day, Week, Month and Agenda list, type/fellow/staff filters, and My schedule only. The clinic overlay can be toggled from Activity schedule.

Clinic cards use fellow colors; activity cards use blue for Topic review, purple for Journal club, teal for Workshop and amber for Meeting and rose for Lecture, with text labels as well. The selected-date agenda separates clinic duties and activities into Morning and Afternoon; all-day activities are above them and RAVC is separate. An activity crossing noon appears once, with its full time range.

## Create and edit activities

Select New activity, or click an empty date/time. Choose the topic, type, date, start/end time or all-day, responsible fellows, supervising/covering staff, meeting format, visibility, description and status. At least one responsible fellow must belong to the selected academic year. Admin manages a staff directory; guests can also be typed. Onsite needs a location, Online and Hybrid meeting links are optional when scheduling and can be added later through Edit this occurrence. A supplied link must be a full HTTP(S) URL. Hybrid still needs an onsite location. Activities use Bangkok time (ICT / UTC+7). Timed activities start and end on the same day.

Scheduled activities become visible immediately, with no approval step. Draft is an optional preparation status visible only to admin and the creator/responsible fellows. Completed and Cancelled are available as explicit statuses; Delete removes selected occurrences from calendar display while retaining their records for recovery.

Admin can manage all activities. Fellows can create in their own academic-year cohorts and edit activities they created or are responsible for. Past academic years are read-only to fellows; admin can edit them. Password and Google sign-in resolve to the same cohort identity for these permissions. Public visitors and other cohorts have read-only access to activities marked Public. Meeting links, locations, staff, descriptions and history are excluded from public API responses. Cohort-only is the default visibility.

Drag an activity or resize it in the time grid to change its schedule; on touch devices, press and hold first. The confirmation shows the old and new date/time. Only that occurrence changes, and cancelling or a failed save reverts the movement. Clinic cards cannot be dragged. Edit this occurrence is a keyboard- and touch-friendly alternative for changing dates and times. Duplicate creates a new independent activity, with no inherited recurrence.

Conflicts with responsible fellows, shared staff and clinic assignments are shown as warnings and do not block an intentional overlap. RAVC notes are informational. Activity changes never submit leave or change clinic coverage automatically. Creation, changes, deletion and restoration notify responsible fellows inside the app. Bulk creation/deletion groups notices per fellow instead of issuing a separate notice for every date.

## Recurrence and deletion

Repeat daily, weekly, every other week, or monthly with an interval and selected weekdays. Recurrence defaults to 30 June of the selected academic year and cannot extend beyond it. Monthly repetition uses the same day number and skips months lacking that day. Every other week uses a weekly interval of two, retaining selected weekdays and the academic-year end limit. Each occurrence is stored independently, with its original series position retained when it moves.

Delete offers:

- Selected occurrence only.
- Selected occurrence and all later occurrences in its original recurrence order.
- Entire series in this academic year.

The confirmation lists actual affected dates and the count. Every affected occurrence must be editable by the person submitting the deletion. If the set or any version changes after the preview, deletion is rejected so it can be reviewed again. Other series and academic years are untouched. Show deleted activities you can manage provides Restore occurrence. History records the actor, time, and changed fields, including previous details. Activities are included in private backups and imports; old backups without activity fields remain valid.

## Admin templates and bulk creation

Open Activity templates in admin navigation, or Templates & bulk add in the calendar. A reusable template contains a name, source academic year and one or more activity rows, including recurrence rules. Rows may omit dates or responsible fellows during preparation; saving a template adds nothing to the calendar. Edit, copy and remove templates in the library. Removing a template does not remove existing calendar activities.

Use for [year] opens a bulk preview. Dates and earlier recurrence end dates shift to the selected academic year. When the year changes, responsible fellows are cleared and must be selected from the new cohort. Review each row, edit it, select which rows to include, and Add selected activities to calendar. The table shows occurrence counts, validation errors, scheduling notes and duplicate counts. Incomplete selected rows cannot be submitted. A batch is saved in one revision-checked write; repeating a batch or adding an identical activity skips duplicates. The current safeguards allow 100 template rows, 1,000 occurrences per batch and 10,000 stored activity records per workspace.

## Implementation notes

The calendar uses pinned FullCalendar 6.1.20 Standard plugins (MIT), not paid Premium features. It is loaded in a separate browser bundle when needed. Stored date/time strings represent Bangkok wall-clock values; calendar rendering deliberately uses floating UTC coordinates so a visitor's browser timezone cannot shift a scheduled time. Time comparisons and the Today indicator use Bangkok time.

The backend is separated into lib/activities.ts and lib/activity-api.ts to keep it portable if hosting changes later. Templates and private staff directories are never returned to public visitors. Client-supplied actor, creator, series IDs or permissions are ignored; server-side identity and membership checks authorize every operation.

## Cohort changes and reusable auto-scheduling

Admin can change an existing cohort between 3, 4 and 5 active fellows. Increasing creates blank profiles with fresh IDs. Decreasing archives selected profiles; activities, signatures, presentation records and account identity remain linked to those profiles. A published plan freezes its fellow order before any cohort change, preserving every existing public assignment. The new clinic draft uses the new cohort template and requires review before publication. Draft clinic customizations and daily overrides are replaced; the impact dialog makes this explicit. Review outstanding leave requests and use the Fellows page's activity reassignment list. Existing historical accounts remain readable; do not reuse archived profile IDs for new people.

In Activity templates, create Topic review or Journal club rows, then choose Auto-schedule. Topic review dates use selected weekdays from 16 July through 31 May inclusive, with approximately equal chronological spacing, original topic order and assigned fellows. JC dates are second/fourth Fridays from 16 July through 14 June; holiday occurrences are skipped without advancing the round-robin fellow order. The UI shows assigned counts, gaps, staff and published clinic/activity conflict notes. Topic review and JC presenters are assigned for the existing completion workflow.

Before generating, admin must enter and review the official Thai public/substitute holidays plus institution closures for both calendar years. These are a separate activity holiday calendar; saving them does not publish clinic holiday changes. No authoritative holiday feed is assumed. Save template settings to retain weekday rules, time ranges and staff; copies to another academic year clear previous fellows. Save as a copy to keep alternate template versions. Nothing is written to the activity calendar until Confirm & add. A workspace revision guards confirmation against concurrent changes.

Use Manage executed batches to preview and soft-delete every remaining occurrence from one named batch. This keeps presentation and deletion history and does not touch other batches. Deleted activities can be restored individually; regenerating a removed programme creates a fresh batch rather than silently skipping deleted occurrences.

## Activity exports

Export activities is available in the activity calendar and template tools. Choose academic-year dates, zero or more fellows and activity types, then PDF or Excel (.xlsx). Rows sort by date, start time and title; a shared event appears once and fellow matching includes organizers, presenters and co-presenters. Drafts and deleted occurrences are omitted. Exports use the current permission-filtered view, so public exports contain only public activities and sanitized fields. Meeting links, notes, signatures and approval history are always omitted. PDF uses the existing embedded Thai-capable Sarabun font and repeated A4 landscape table headers. Excel uses inline text cells, frozen headers and autofilter without formulas. Both files are generated in the browser; no additional export service or storage is needed.
