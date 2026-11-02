# Presentation sign-off and completion tracking

Presentation tracking is attached to existing calendar activities. It requires no additional service, instructor login, email provider or environment variables. Existing clinic schedules and activities are not reassigned or migrated.

## Roles and access

Edit an activity and assign Presenter, Co-presenter or Attendee for each fellow. These are separate from the Responsible fellows (organizers) field. Presenters and co-presenters each receive one credit per activity after their own completion submission and admin approval (instructor sign-off is required for categories other than Journal club); organizers and attendees receive no automatic presentation credit. Activities without presentation roles are not added to tracking. Programme templates preserve roles within the same year and clear fellow roles when reused in a different cohort.

Only admin sees Presentation progress, its overview shortcut, yearly counters, category targets, progress bars, completion matrix, July–June timeline, filtered CSV export and approval queue. Fellows see My presentations, containing only their own submissions and approval history. They can also access their own record from the activity detail. Public visitors and other fellows receive no signatures, feedback, submission evidence or history in API responses. Targets are returned only to admin.

## Journal club: fellow confirmation and admin approval

Journal club requires no instructor signature. After presenting, the assigned fellow opens their record, optionally adds slides/evidence, confirms they have finished, and selects **Mark finished & send for approval**. The submission goes directly to the admin queue; it earns no credit until admin approves it. Each co-presenter submits separately. Future dates cannot be marked finished. Returned or reopened records are corrected and submitted again without a signature. Changed presentation details invalidate the prior completion confirmation and approval while preserving them in history. Previously signed Journal club records remain reviewable and approvable.

## Fellow and instructor workflow (other categories)

1. Open My presentations (or the calendar activity), choose the relevant occurrence, and save presentation details. Optional evidence is a full HTTP(S) slides link, or submission notes. The PDF upload field has been removed; previously saved attachments remain accessible in their private records.
2. On or after the presentation date, choose Save & continue to instructor sign-off. Saving the submission opens the instructor form immediately; give the device to the instructor. For a future date, Save presentation details prepares the record and the form explains the date when signing becomes available. The instructor enters/selects their name, chooses Satisfactory or Revision needed, adds optional feedback, draws their signature and confirms that they observed the presentation.
3. Satisfactory submissions enter Awaiting admin approval. Revision needed returns the record to the fellow. This is acknowledgment through the fellow's session, not independent authentication of the instructor's identity.
4. Only admin can approve completion. A shared activity is marked Completed when all assigned presenters/co-presenters are approved. One person's approval does not grant credit to another.

Workflow: Scheduled → Awaiting instructor sign-off → Awaiting admin approval → Completed, with Returned for correction when needed. The instructor needs no separate account. Signature data is stored as bounded pen strokes and displayed as SVG; client-supplied timestamps, approval identities and statuses are not trusted.

## Admin review and corrections

Open Presentation progress → Open approval queue. The record shows the signed topic, date/time, type, presenter role, instructor assessment, signature, feedback and evidence. Approve completion or return with a reason. Completed approvals can be reopened with a reason; reopening immediately removes credit. The fellow saves corrected details and obtains a new sign-off. In-app notices report submission status, returns, approvals, reopening and changed signed details. The admin sidebar badge and overview shortcut show pending submissions.

Signed/pending/approved evidence is locked. Changing topic, category, date, time, all-day setting or presenter role automatically invalidates that person's sign-off and approval. Previous signed details, signature, evidence and approval are retained in private history; a new sign-off is required. Changes affect only that activity occurrence. Other recurring dates remain independent. Removing a presenter preserves their historical record for inspection. Deleted, draft or cancelled activities do not count toward completion. Soft deletion retains signed records; restoring the activity restores valid existing credit. Academic-year archives are read-only to fellows and remain manageable by admin.

## Requirements, timeline and exports

Set category targets for each academic year, with defaults and optional fellow-specific overrides. No assumed quotas are created: zero means no required target. Approved counts, pending approvals and remaining requirements are separate. Progress bars show approved/required per fellow and category. A matrix compares all fellows. The July–June timeline and records table can be filtered by fellow, activity category and workflow status. Export filtered records downloads CSV with presenter role, topic/category/date, workflow status, whether credit is currently counted, instructor assessment/signing time and admin approval name/time. Select one fellow for their individual yearly report. Times in the UI use ICT; CSV timestamp headings explicitly use UTC.

Journal club CSV records also include the fellow’s completion-confirmation timestamp.

One record per activity/presenter prevents duplicate submissions from creating extra credit. A previously approved same-topic/category presentation triggers an explicit duplicate acknowledgment before another submission. There is no bulk approve button: final approval is per presenter record.

## Storage and compatibility

New records and annual targets live in the existing revision-checked private workspace. Mutations check both workspace revision and record version. Backups include records, targets, signatures, evidence and history; existing backups without these fields remain valid. PDF contents and size are validated; attachments download as files and are not embedded as executable content. Current attachment data has a 12 MB aggregate guard; total workspace size is bounded to 18 MB for presentation changes including history. Use slides links for larger files and keep private backups. No real signatures or test presentations are added during deployment.
