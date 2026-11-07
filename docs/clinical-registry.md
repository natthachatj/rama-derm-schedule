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

The owner selects up to 20 reviewed rows per batch. A source fingerprint prevents committing a stale preview. The permanent source ID is written before storing the imported record so a retry after a partial failure reuses that ID. Existing imported IDs are skipped. The app is authoritative after import; direct changes to source response copies are not imported over edited cases.

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
