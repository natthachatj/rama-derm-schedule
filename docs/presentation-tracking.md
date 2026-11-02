# Presentation sign-off and completion tracking

Presentation tracking is attached to existing calendar activities. It requires no additional service, instructor login, email provider or environment variables. Existing clinic schedules and activities are not reassigned or migrated.

## Roles and access

Edit an activity and assign Presenter, Co-presenter or Attendee for each fellow. These are separate from the Responsible fellows (organizers) field. Presenters and co-presenters each receive one credit per activity after their own completion submission and admin approval (instructor sign-off is required only for Topic review); organizers and attendees receive no automatic presentation credit. Activities without presentation roles are not added to tracking. Programme templates preserve roles within the same year and clear fellow roles when reused in a different cohort.

Only admin sees Presentation progress, its overview shortcut, yearly counters, fellow comparison, July–June timeline, filtered CSV export and approval queue. Fellows see My presentations, containing only their own submissions and approval history. They can also access their own record from the activity detail. Public visitors and other fellows receive no signatures, feedback, submission evidence or history in API responses. Minimum requirements are not used.

## Journal club, Meeting, Workshop and Lecture: fellow confirmation and admin approval

Journal club, Meeting, Workshop and Lecture require no instructor signature. After presenting, the assigned fellow opens their record, optionally adds slides/evidence, confirms they have finished, and selects **Mark finished & send for approval**. The submission goes directly to the admin queue; it earns no credit until admin approves it. Each co-presenter submits separately. Future dates cannot be marked finished. Returned or reopened records are corrected and submitted again without a signature. Changed presentation details invalidate the prior completion confirmation and approval while preserving them in history. Previously signed records in these categories remain reviewable and approvable.

## Topic review: fellow and instructor workflow

1. Open My presentations (or the calendar activity), choose the relevant occurrence, and save presentation details. Optional evidence is a full HTTP(S) slides link, or submission notes. The PDF upload field has been removed; previously saved attachments remain accessible in their private records.
2. On or after the presentation date, choose Save & continue to instructor sign-off. Saving the submission opens the instructor form immediately; give the device to the instructor. For a future date, Save presentation details prepares the record and the form explains the date when signing becomes available. The instructor enters/selects their name, chooses Satisfactory or Revision needed, adds optional feedback, draws their signature and confirms that they observed the presentation.
3. Satisfactory submissions enter Awaiting admin approval. Revision needed returns the record to the fellow. This is acknowledgment through the fellow's session, not independent authentication of the instructor's identity.
4. Only admin can approve completion. A shared activity is marked Completed when all assigned presenters/co-presenters are approved. One person's approval does not grant credit to another.

Workflow: Scheduled → Awaiting instructor sign-off → Awaiting admin approval → Completed, with Returned for correction when needed. The instructor needs no separate account. Signature data is stored as bounded pen strokes and displayed as SVG; client-supplied timestamps, approval identities and statuses are not trusted.

## Admin approval inbox and corrections

The admin Overview puts the approval shortcut before the year summary. Review presentations and the Presentation approvals navigation open an approval inbox at the top of the page, with the oldest pending submission already selected. Learning progress, comparison, timeline and historical records are below in an expandable section. Opening an approval shortcut again resets inbox filters and returns to the first pending item.

The inbox includes active pending presenter submissions from the selected academic year; it excludes drafts, cancelled/deleted activities, removed presenters, records awaiting instructor sign-off and already decided records. Its counts match the Overview shortcut and sidebar badge. Filter by fellow/category, view the pending list or move with Previous/Next without making a decision. Each record shows presenter, topic, type, activity date/time and submitted evidence; Topic review includes instructor signature/assessment/feedback, while other categories show the fellow’s completion confirmation.

Approve & next records the approval, notifies the fellow, updates completion credit and advances only after a successful response. Return for correction opens a required comment; Send correction & next returns it and advances only after saving. Errors leave the decision unsaved and do not approve the next item. Review controls stay at the bottom of the scrollable review panel on desktop and mobile. A completed queue shows All presentations reviewed. Filters with no matches can be cleared to show all pending.

Historical records still support reopening an approved completion with a reason; reopening removes credit. The fellow saves corrected details and obtains a new sign-off for Topic review, or marks another category finished and submits it again. History and in-app notices are retained. Every decision uses the existing server-side admin authorization, workspace revision and presentation version checks; navigating the inbox does not make decisions automatically.

Signed/pending/approved evidence is locked. Changing topic, category, date, time, all-day setting or presenter role automatically invalidates that person's sign-off and approval. Previous signed details, signature, evidence and approval are retained in private history; Topic review needs a new sign-off, while other categories need a fresh completion submission. Changes affect only that activity occurrence. Other recurring dates remain independent. Removing a presenter preserves their historical record for inspection. Deleted, draft or cancelled activities do not count toward completion. Soft deletion retains signed records; restoring the activity restores valid existing credit. Academic-year archives are read-only to fellows and remain manageable by admin.

## Counts-only learning progress and reports

Fellows have a new My learning progress page and an Overview shortcut. Only their own activity counts and private records are shown. Admin can choose any fellow on Presentation progress and compare counts across fellows. There are no minimum requirements, targets, remaining quotas or progress bars. The previous targets editor/API is retired; old target values remain readable only through legacy private backup compatibility and do not affect the app.

Each category (Topic review, Journal club, Workshop, Meeting, Lecture) has four expandable counts:

- Completed: the presenter has a currently valid admin approval.
- Awaiting action: awaiting admin approval, returned for correction, or a past Topic review waiting for instructor sign-off.
- Upcoming: scheduled for a later date or not yet ended today in Bangkok time. All-day events stay upcoming until the next day. Preparing a future submission does not remove it from Upcoming.
- Past, not submitted: the activity has ended but no submission has been sent, including prepared direct-approval records awaiting completion confirmation.

Every active presenter/co-presenter assignment belongs to one group. Draft, cancelled, deleted and removed-role assignments are excluded from these counts; historical records remain in My presentations/admin records. Counts are separate per academic year and per presenter; attendance does not earn presentation credit.

Expanding a count shows topics, dates/times, role and workflow status. Completed entries show admin approval date/name. Upcoming entries show meeting format, location and assigned staff. Opening an entry shows full activity details, a meeting link when present and the fellow’s own submission/sign-off/approval record. Fellows do not see other fellows’ private assessments or records. Public visitors have no learning progress page.

Admin retains the July–June timeline, approval queue and filtered CSV export, plus a counts-only comparison table. Export includes presenter role, category, topic, activity date, workflow status, whether credit is counted, instructor assessment/signing time when relevant, fellow completion-confirmation time and admin approval name/time. Filter to one fellow for an individual yearly report. UI times use ICT; CSV timestamps use UTC as labelled.

One record per activity/presenter prevents duplicate submissions from creating extra credit. A previously approved same-topic/category presentation triggers an explicit duplicate acknowledgment before another submission. There is no bulk approve button: final approval is per presenter record.

## Storage and compatibility

New records live in the existing revision-checked private workspace. Mutations check both workspace revision and record version. Backups include records, targets, signatures, evidence and history; existing backups without these fields remain valid. PDF contents and size are validated; attachments download as files and are not embedded as executable content. Current attachment data has a 12 MB aggregate guard; total workspace size is bounded to 18 MB for presentation changes including history. Use slides links for larger files and keep private backups. No real signatures or test presentations are added during deployment.
