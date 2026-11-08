# Clinical Case Registry

This module extends the existing app, repository and Netlify deployment. There is no separate paid database, upload platform, AI API or export subscription. Clinical data is stored in the existing Google Sheets; images and videos are managed manually by the clinical owner in Drive.

## Release boundary

The implementation is on `feature/clinical-case-registry`. Do not merge/deploy to production until review. No real spreadsheet setup, imports, Drive folders or credential connections are part of automated verification. Non-production Netlify contexts reject clinical integration routes, even if deployment environment variables are inherited. Local QA uses fictional repositories and mocked integration responses only.

## Owner configuration

1. The designated clinical owner is `natthachat.j.md@gmail.com`, explicitly configured in server code. This works even when Netlify does not provide `CLINICAL_OWNER_EMAIL`. An optional nonempty Functions environment override can replace that email for a future ownership change. Google-only authentication and the optional subject pin still apply. This is intentionally separate from `ADMIN_EMAIL`; scheduling-administrator status never grants clinical access.
2. Optionally pin `CLINICAL_OWNER_GOOGLE_SUB` to the Google subject ID. Password accounts and email-code sessions are rejected as clinical-owner identities even if their email matches.
3. Reuse the existing Google web OAuth client, enable Google Drive API and Google Sheets API, and register `https://rama-derm-schedule.netlify.app/auth/clinical/google/callback`.
4. Sign in with that Google account and choose Clinical registry → Connect Google Sheets & Drive. Consent is for Drive and Sheets access on behalf of the owner. The app never supplies the owner's tokens to fellows.
5. Refresh credentials are encrypted with AES-256-GCM in a separate private Netlify Blobs store. Rotating `SESSION_SECRET` requires reconnecting Google. No credentials belong in the repository, client bundle or user-facing logs.
6. Review both spreadsheets and the parent folder's sharing settings. The app checks that permissions are limited to the configured owner and pauses clinical access if it finds other users, groups or public sharing. It does not silently change sharing settings.

Google connection requires the owner's interaction; it cannot be supplied by the ChatGPT Drive connector. The connector's authorization does not become a deployed app credential.

## Spreadsheet initialization (explicit owner action)

Registry settings → Inspect spreadsheet mappings shows missing headers, existing AutoCrat settings tabs, sharing checks and presence of a record-ID column. Only after reviewing this report should the owner initialize supporting tabs.

Source response spreadsheets:

- RAVC: `1T9eHLdm84bHKy3uoRY5dsXLEGc_izKhaN3HhtcVd2XI`, `Form Responses 1` (40 original headers).
- Nodule: `13xdpgSqdTvoBkxuYJwYVoMLZRbXXB1KR9sh7SRYNck0`, `Form Responses 1` (114 original headers).

Initialization adds `Registry Records`, `Registry Revisions`, the RAVC `Registry Settings` tab, and one `Registry Record ID` column after existing populated response headers. Existing question headers, AutoCrat settings, document IDs, hyperlink formulas and output-status columns are preserved. Choices are standardized starting options, not a recovered Google Form definition; the owner can add answer choices in settings.

Cases are stored as structured JSON split across four cells per record (up to 170,000 UTF-16 code units), with a separate index and full saved revisions. Repeated injections, history, investigations, treatments and follow-ups live within the structured record. Long cases beyond this limit fail with a clear message; no data is silently truncated. Empty values, explicit none, unknown, not assessed, not applicable and not recorded remain distinct.

All record mutations are serialized with a private Netlify Blobs lease containing only an opaque ID and expiry. Revisions reject stale browser saves. Source response rows are appended atomically; existing source rows are located by permanent ID. AutoCrat fields are not overwritten. A source write/PDF failure leaves a recoverable processing status.

## Fellow lifecycle

- Eligibility uses the current roster identity (`academic year + fellow ID`), so the fellow's Google and password login can resume the same own draft.
- Disabled or archived fellows cannot create/read/edit drafts.
- Enabled fellows receive owner-configured answer choices through an intake-only endpoint. This endpoint excludes private settings, access lists, exports and clinical records.
- Drafts autosave after 12 idle seconds and when advancing steps; unsaved navigation is guarded.
- Submission validates required and visible conditional fields on both client and server. Unknown and not-assessed answers must be explicitly chosen. Validation does not assert clinical correctness.
- Submission closes fellow read/edit access. Receipt APIs omit answers, source information, folder/PDF IDs, edit history and patient identifiers.
- The trusted submission handler writes the source row, creates the case folder, generates an anonymous A4 information-only PDF and uploads it. Retrying looks up the permanent case marker, so it reuses an existing folder/PDF after a partial failure.
- Only the owner can subsequently review, edit, add follow-up, retry processing and export.
- Cases older than 90 inactive draft days are flagged for owner approval. Draft removal deletes the active draft; revision history remains owner-only for audit. There is no automatic cleanup or media deletion.

## Drive behavior

Parent: `1fUqfMTRLxfcl_mSKeiLozlNDG1QYWo5P` (`Complications - U/S`). Folder naming uses visit year (cohort fallback for new records), complication type, material, affected area, technique, substance and permanent case ID. Unknown and not-applicable values are explicit. No HN or patient name is used. Subsequent edits never rename folders; permanent IDs survive manual renaming.

Photos/videos are uploaded manually in Google Drive. The app does not upload, enumerate, embed, edit or delete this media. Exporting a case does not read images/videos. The owner can open the linked case folder to manage its contents. Deleting a manually uploaded photo/video does not alter the clinical record. Opening a deleted/moved-inaccessible folder/PDF is handled by Drive; generation failures are visible in the app. Existing historical file links remain in original source data, not copied into new folders.

## Historical import

Preview reads original responses, maps them by exact header, and preserves raw answers and source references. Typed Google Sheet DATE/DATE_TIME numeric values are converted using their actual serial values; ambiguous date strings remain unparsed and require review. Unknown academic-year associations use `0` internally rather than inventing a year; reporting uses recorded visit/injection dates.

The owner selects up to 20 reviewed rows per batch. A source fingerprint prevents committing a stale preview. Each reviewed batch writes permanent source IDs, registry rows and audit revisions together in one atomic Sheets batchUpdate request. The registry index is read once for duplicate checks; there are no per-row registry lookups. Existing imported IDs are skipped. Unusually large batches above 1.8 MB require selecting fewer rows. The app is authoritative after import; direct changes to source response copies are not imported over edited cases.

Historical imports, edits, processing retries and exports NEVER create folders automatically. Existing Drive links remain where they are. If an owner chooses to create a historical folder manually in Drive, this release does not automatically adopt that folder.

## Owner workspace and analysis

The overview shows pending review, failed processing and stale drafts. Search covers reference, HN, material and recorded summary fields through a private owner-only index. Case review includes original imported values, dated events, completeness warnings and saved revisions. Possible duplicates are flagged by matching recorded HN; this is only a review aid, never an automatic merge. Explicit links preserve both records and support representative-episode counts.

Analysis supports separate registries, configurable fields/cross-tabs, visit/injection/academic years, numeric summaries, recorded/missing denominators and compatible combined material/brand/area/outcome views. Combined columns are registry counts and can include linked records; they are not unique-patient totals. Descriptive outputs are exploratory and cannot establish population incidence or causal treatment effects. Differing linked answers require review; count mode clearly identifies a representative record.

## PDF and PowerPoint

Automatic case-folder PDFs are anonymous by default, because the private-vs-anonymous automatic PDF setting was not explicitly resolved. They are marked pending owner review until the record is approved. The owner can explicitly choose a private information-only export in the export creator.

The export creator supports section selection, editable summary text, preview and information-only A4 PDF/PPTX downloads. Anonymous exports omit private fields, known patient/referrer/brand strings and links. The owner must review the exact preview before downloading. Automatic redaction cannot establish that all free text is anonymous. Anonymous filenames and presentation metadata use a separate presentation code. No patient images/video/media objects are present.

PDFs embed the bundled Sarabun font and paginate to A4. PPTX files contain native editable text/tables, including timeline rows, and use the chosen font. Font availability must be verified on the presentation computer. Routine font, colour, background, size, footer and added-choice settings are owner-only. Anonymous footers use a fixed safe label rather than unreviewed custom text. This release does not generate AI summaries or perform statistical inference.

AutoCrat must be retired only after reviewing replacement exports. Check Extensions → AutoCrat and the bound Apps Script trigger list; disable applicable jobs/triggers manually after review. The app does not alter Apps Script/AutoCrat settings or assume API writes fire Form-submit triggers.

## Testing

`npm test` runs existing scheduling tests and clinical validation/access/privacy/import/retry/export tests. `npm run build:netlify` builds the actual frontend and backend. Type check:

```
npx tsc --noEmit --jsx react-jsx --module esnext --moduleResolution bundler --target es2022 --lib es2023,dom --allowSyntheticDefaultImports --skipLibCheck app/*.tsx app/clinical/*.tsx lib/*.ts lib/clinical/*.ts netlify/functions/app.ts
```

Browser QA uses an ignored local Vite fixture, a fake session/clinical repository and fictional cases. No real spreadsheets, production case folders or patient records are read or modified by QA. Verify native PowerPoint appearance/font substitution on the intended presentation machine before production adoption; XML editability checks are not a PowerPoint playback test.

## Google publishing: required public links

The public, script-free `about.html` and `privacy.html` pages are copied into the actual Netlify build. They do not require sign-in or read clinical data. The public workspace footer and login screen link to them. The privacy policy documents the implemented data flow; review it before publishing and keep it current with future changes.

After deploying this branch and checking both pages without signing in, set Google Auth Platform → Branding:

- Application home page: `https://rama-derm-schedule.netlify.app/about.html`
- Application privacy policy link: `https://rama-derm-schedule.netlify.app/privacy.html`

Keep the existing app name, support email, developer contact and authorized app domain. Do not replace the authorized domain with `netlify.app`. Save and resolve any field-level errors, then return to Audience → Publish app. If Google requires brand/domain or data-access verification, follow the displayed requirements; these pages do not establish verification or guarantee publication. There is no terms-of-service page in this change; do not use an unrelated or nonexistent URL if Google requests one. Publishing OAuth does not publish clinical records or change app authorization.

Historical imports use bounded retries with short exponential backoff only for explicit Google 429 responses. If rate limiting persists or Google asks for a longer delay, the app tells the owner to wait at least 60 seconds and generate a new preview. Network errors and other uncertain write failures are not automatically retried. The new preview detects already completed rows after an interrupted request. Imports never create Drive folders.

## Clinical dashboard and research workspace (form v2)

The owner-only Dashboard & research tab provides demographics and clinical distributions,
calendar-year/custom first-visit date ranges, persisted chart visibility preferences (no clinical
answers in localStorage), chart-to-case drilldown and a collapsed advanced field-analysis view.
Case listings return age/sex, complication, material, area, treatment, outcome, visit and
follow-up summaries only to the clinical owner. Fellow list responses remain receipts.

Outcome & follow-up is a dedicated form step. The optional structured `outcomes` object is
stored with existing record JSON in Registry Records and immutable revision rows. No original
Google response columns are changed. Older answers remain intact; no historical healing,
sex, first-treatment date, severity or sequelae is inferred. RAVC sex is a new optional extra
field. Editing a record upgrades its current form version while its audit history retains prior
versions. New structured outcomes also appear in information-only case exports.

### Finalized definitions

- Unit: one complication episode. Explicit links form transitive episode groups; HN equality
  alone never merges episodes. Combined summaries count linked records once, retaining all
  shared-field values. Conflicting scalar demographics/endpoints need review.
- Date filter: earliest valid first RAMA/RAVC visit in the linked episode; inclusive date limits.
  Unknown visit dates remain in all-time summaries, but are excluded when a date bound is used.
- Wound healing: complete epithelialization with no remaining open wound; time zero is first
  RAVC treatment, explicitly entered. Nodule resolution remains separate.
- Primary sequelae: closest *assessed* visit to day 90, within days 60–120 after first RAVC
  treatment; ties use the earlier visit. No qualifying visit is missing, never an absent event.
- Sequelae are individually recorded: None, Scarring, Pigmentation, Tissue loss, Functional
  impairment, Other. Unknown/not assessed are distinct from None and not applicable.
- Approval, processing and follow-up completeness remain independent states.

### Guided analysis

Question → cohort → outcome/factors → data readiness → results. Descriptive summaries provide
counts, denominators, missing-state breakdowns, mean/sample SD, median, interpolated quartiles
and range. Group comparisons provide Wilson 95% proportion intervals, two-sided Fisher exact
for exactly two groups and Newcombe–Wilson confidence intervals for differences. Groups must
be unambiguous; treatment groups describe the recorded regimen rather than implying comparable
clinical indications. Multiple exploratory comparisons are not multiplicity-adjusted.

The wound-healing path uses Kaplan–Meier estimates with log-log Greenwood intervals. Exact
healing dates are events. Last explicitly confirmed unhealed follow-up is the censoring date.
Interval-known healing is retained in the registry but excluded from this exact-date estimator;
it is never replaced by a midpoint or upper-bound event date. Unadjusted group curves and a
two-group log-rank test are available when group membership and test variance are estimable. Non-informative censoring is an
assumption, not a verified fact. At-risk counts, events, censored counts and exclusions are shown.

Adjusted associations use an optional, clinically selected logistic model of three-month sequelae.
Current supported factors are age (per year), treatment delay (per day, known symptom-onset to
first RAVC treatment), and clinical wound severity (ordinal mild/moderate/severe). No automatic
p-value selection. Complete-case analysis only; no missing-value imputation. At least 30 complete
episodes and at least 10 observations in each outcome category per selected factor are required.
Constant/collinear predictors, nonconvergence, separation and unstable estimates are withheld.
This conservative gate is not proof of model adequacy. Ordinal/linear assumptions, missing-data
bias, referral selection, confounding and clinical severity definitions and within-patient episode clustering require statistical review
before publication. Models do not establish causation, incidence or treatment effectiveness.

### Saved analyses and exports

Explicit owner action Save analysis & fixed snapshot creates the supporting `Registry Research`
tab in the existing RAVC spreadsheet if absent, then appends an immutable JSON snapshot with
config, calculation version, aggregate results, source record IDs/revisions, creation time and actor.
This uses the existing Sheets connection; no additional service or clinical database. Reads do not
create the tab. UUID retries reuse the existing snapshot. There are no Drive folder operations.
Snapshots can be reopened as fixed results or their settings reused with current records. The
Refresh results action switches to current data and never rewrites a saved snapshot.

Research PDF, editable PPTX and CSV exports are owner-only backend requests. Saved snapshots
export their stored aggregates; live exports are recomputed server-side. Aggregate category labels
are allowlisted from standard clinical choices; nonstandard/free-text labels become anonymous
Other category codes. Names, HN, product brands, source IDs, folder links, notes, snapshot names
and individual records are excluded. Small groups still require disclosure review. PDF/PPTX include
methods; charts are native PDF vectors and editable PowerPoint charts/lines. CSV cells are quoted
and spreadsheet-formula prefixes escaped. No patient data is sent to an AI provider.

### Manual Drive folder links

Owners may link an existing submitted case to a Drive folder. Backend checks role, optimistic
revision, Google Drive URL/ID syntax, folder type, trash state, owner-only permissions, case marker
and ancestry within Complications - U/S. The parent itself is rejected. Linking is audited, creates
no folder and moves no files. A changed folder clears its former PDF reference; a later explicit
Update Sheet / PDF can write the anonymous PDF in the newly linked folder. Historical cases still
never create folders automatically. All source resource privacy gates continue to apply.

### Validation

`tests/clinical-research.test.mjs` uses only fictional data and mocked Google requests. It covers
linked episodes, date bounds, endpoint selection/ties, missingness, impossible outcomes, censoring,
KM ties, known Fisher/Wilson/summary fixtures, known logistic odds ratios and instability, role
boundaries, folder ancestry/privacy, snapshot immutability/retries and anonymous export bytes.

### Owner section edits

Submitted cases use explicit section saves with a fixed Save/Cancel bar. Opening an editor fetches
the current record revision. An optional explanation supplements automatic audit descriptions of
changed field names. Unrelated historical gaps do not block an otherwise valid section edit; new
invalid values do. Fellow drafts retain their existing autosave and submission validation.

The server checks clinical-owner access before reads, reconstructs the requested base revision,
and merges only changed fields into the latest record. Unrelated updates survive. Conflicting
values require explicit mine/latest choices bound to the latest revision; another change triggers
a fresh comparison. Missing or ambiguous base history fails safely. Retried identical edits are
no-ops. Unsaved edits remain on screen after failures, with navigation/discard protection.

Add follow-up opens a single dated assessment while preserving prior visits and outcome settings.
Registry saves mark response processing pending without calling Drive/response synchronization.
The owner explicitly runs Update response Sheet & PDF afterward. No new storage service is used.

`tests/clinical-edit.test.mjs` covers role boundaries, scoped updates, stale edits, conflicts,
revision-bound resolutions, legacy gaps, audit notes, follow-up merges and retry idempotency.

### Mobile registry usability and dashboard

Owner editing has a compact fixed action bar with safe-area padding and keyboard-aware positioning.
The bar can reserve space for a visible hosting-branding link. Required omissions and invalid values
have named, tappable issue lists, red field/section markers, and inline explanations. Conditional
hidden fields and optional blanks are not flagged. Standard-choice mismatches receive separate amber
review suggestions; original answers and configured extra choices remain intact. Unrelated missing
information does not block a valid owner edit. Fellow submission still checks required fields.

Delete draft now means recoverable trash. The authenticated fellow can trash only their own accessible
unfinished draft; the clinical owner can trash accessible drafts and alone can restore them. Both
operations validate revision and draft status and write audit history. Trashed drafts are excluded
from active lists and fellow read/save requests; owner trash contains Restore, without permanent
purge or Drive deletion. Trash metadata lives in the existing Registry Records JSON and index,
requiring no new columns or paid service. Submitted records cannot enter this workflow.

Owner-only registry filters use recorded categorical values: sex, material, complication, affected
area, dissolution technique/agent, brand, and other suitable choice fields. Multiple values within
one factor use OR; separate factors use AND. Missing states remain explicit. Registry switches
clear incompatible filters; selected values have removable chips. More filters provides a mobile
full-height panel with explicit Apply/Clear/Cancel, keyboard focus containment and Escape support.
These are record-list filters, distinct from episode-based dashboard/research cohorts.

The dashboard defaults to monthly case counts, age distribution, sex, complication, affected area
and material, plus four labeled summary cards. Customization adds treatment, dissolution technique,
agent/sessions, clinical outcome, wound-healing status, three-month sequelae and latest-assessment
recurrence. Counts and percentages use explicitly displayed known-episode denominators; missing
and conflicting information is excluded and reported. Linked cases count once. Three-month sequelae
retain the established day 60–120 endpoint; latest recurrence is separately labeled. Chart selection
shows matching case buttons from the same filtered cohort. Stable category colors, horizontal bars
for clinical labels, monthly/age columns, empty states and single-column mobile layout improve reading.
Only chart names are persisted as browser preferences; clinical values and filters are not persisted.

Validation adds fictional tests for trash ownership, restoration, stale revisions, submission boundaries,
missing/conditional/structured field guidance, private filter payloads, OR/AND matching, categorical values,
chart denominators, linked conflicts, endpoint eligibility and stable colors. No live patient data is used.

### Dose correction (form version 3)

RAVC's original `Total amount of dissolution agent used` column remains unchanged in position and
accepts the full original multiline treatment description. It is no longer validated as a number.
Separate optional structured total and unit fields synchronize to appended response columns
`Structured dissolution total dose` and `Structured dissolution dose unit`. Existing columns,
automation fields and Registry Record IDs are not moved. Setup appends only missing extension
headers; sync fails before writing if entered structured values have no destination columns.
Import recognizes the extension columns and preserves explicit unknown states. A numerical dose
requires a concrete unit; multiple selected agents require separate treatment entries. Unknown
is explicit, never zero. The submission dose group places agent, total, unit and original description
together. Known-dose totals are manual declarations, never inferred from prose, vial counts or
concentrations. Numeric legacy corrections are not multiplied or converted.

Dated treatment events optionally include agent and route/technique, with paired amount/unit inputs.
Event totals group by matching agent and literal unit only, exclude incomplete entries, and do not
add themselves to the case total. They do not convert IU, units, vials, mg or mL. Event agent/route
remain in the existing Registry Records JSON and are included in information-only exports.

Historical recovery is restricted to submitted historical RAVC records whose active Not applicable
answer still contains exactly the original meaningful dose description. No totals are extracted.
The recovery retains all other values, sourceRaw, links and outcomes, increments revision, retains
pre/post recovery audit snapshots and marks document processing pending. Source description cells
are restored only after matching permanent IDs and checking current values. Existing independent
numeric corrections and deliberately different answers are not overwritten. No PDF regeneration,
Drive-folder creation, AutoCrat change or deployment is part of this correction.

On 8 November 2026 the owner authorized the live dose correction. Readback verified restoration of
20 exact-match historical registry descriptions and 19 overwritten response description cells;
one response description already matched. Two extension headers were appended at AP:AQ, preserving
AO Registry Record ID and all original column positions. Forty pre/post audit snapshots were retained
in Registry Revisions. No numeric totals were guessed or backfilled and no clinical record data was
copied into this repository. Recovered records await explicit PDF processing after app deployment.

### Case-card completeness and chronological ordering

Owner case cards now show a red dot and expandable “Missing information” count for required/invalid answers and essential demographics, material, area, treatment and final outcome information. The count deduplicates fields; explicit unknown and valid not-applicable answers are retained as distinct states. Fill in fetches the latest case, rechecks the issue, and opens/focuses the corresponding editor section. Owner inline markers and detail issue lists use the same rules; optional completeness gaps do not become submission-validation blockers. Missing metadata and visit chronology are excluded from fellow receipts.

Sort by first RAMA/RAVC visit (default), date added to the registry, or last updated, with newest/oldest first. Unknown dates stay last in either direction, and equal dates use a stable case-ID tie-break. Historical import timestamps remain separate from clinical visit dates. Approval and completeness remain separate from explicit Sheet/PDF processing labels. No live records or sharing permissions are changed by this update.

## Form v4: structured entry and manual historical review

Quantity controls keep the original string visible (including incompatible text) rather than binding it to a sanitizing HTML number input. Validation rejects malformed final answers. Quantities support explicit units, integer counts and estimated count ranges where appropriate; notes preserve explanations. LED, dissolution and HBOT have distinct treatment status/day fields, with HBOT hours and dissolution cycles kept separate from sessions. No automatic unit conversions or text-to-number extraction are performed. Explicit unknown, not assessed, none/not performed and not applicable statuses remain distinct from zero and absence.

Clinical response, residual sequelae and follow-up status are separate RAVC questions. Original outcome descriptions remain readable. Nodule homogeneity and solid/cystic composition are separate questions; original internal-structure text is retained. Pathology categories, procedures, anatomy and ultrasound choices cover collected vocabulary without silently translating clinical meanings. Every stored checkbox selection is rendered, including nonstandard historical selections. Other answers require explanatory notes on final submission. Standard Doppler grades are labeled choices rather than raw numeric inputs.

Meaningful saved child answers remain visible when a conditional parent is inconsistent. Final submissions require resolving parent/child conflicts. PCR performance/result is independent of biopsy status; recurrence gates recognize the original Yes wording. Invalid historical quantities, unsupported choices, calendar problems and chronology conflicts receive amber review flags, separate from red missing-information badges. Owner lists include a quality filter, field-specific links, review counts and markers. These details remain excluded from fellow receipts.

Date controls explicitly distinguish Gregorian from Buddhist entry. Buddhist conversion is previewed and only applied with the user's confirmation; historical years are never automatically changed. Unknown time uses day precision without inventing midnight. Date-order exceptions require a written explanation and explicit confirmation bound to the actual date pair; changing either date invalidates that acknowledgment.

Original source content is shown beside affected fields and remains available after correction. Server-owned snapshots cannot be rewritten by client input. Section saves preserve unchanged historical problems, audit changed fields and retain conflict/retry protection. Validation and review detection are read-only; no background historical migration is introduced. Save corrections in the registry, then use the existing explicit Update response Sheet & PDF action when ready.

Response synchronization appends extension headers without moving original columns. Untouched historical response cells are not rewritten; deliberately corrected fields are marked by the server. Numerical source columns receive scalar values, with appended unit/range/notes columns for interpretation. Extension fields and up to four bounded structured-answer JSON cells retain units, ranges, notes and statuses for lossless subsequent imports. A manually changed source cell takes precedence over stale structured metadata. Exports include structured values and unresolved review notes/original content while applying the existing anonymous redaction rules. Original snapshots and full revisions remain in the private registry. No folders, sharing or patient data are changed merely by viewing review flags.

Validation includes synthetic historical examples, SSR checks for visible nonstandard text/checkboxes, quantity/range/unit rules, calendar/chronology review, server-owned originals, isolated section corrections, Sheet/import round-trips and anonymous exports. A local browser QA harness verified a 390px content column, a saved LED correction retaining its Thai original, and explicit Buddhist-to-Gregorian conversion. No live clinical data was used in QA.
