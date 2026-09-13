# KV User Funnel Analysis Task

Read this when the user asks for a KV funnel or retention review. Moved out of
AGENTS.md so it only loads when needed.

When the user asks to review KV user metadata, onboarding success, returning
users, manual email/support notes, or acquisition funnel quality, treat the work
as a product-analysis task, not just a stats dump.

Goal: determine which acquisition surfaces bring real lifters to activation,
real data usage, repeat visits, feedback, and eventual support/donation signals.
The useful question is not which CTA got sign-ins, but which CTA/source produced
activated lifters who saw value and came back.

Use read-only KV access. Do not write KV, delete keys, or store exported user
metadata in the repo. Keep the existing privacy boundary: report aggregates and
masked examples unless the user explicitly asks for identifiable support context.

Core KV sources and fields:

- User records: `sj:user:<email>`
- Daily aggregate sign-in attribution:
  `sj:metrics:signin:daily:<YYYY-MM-DD>`, keyed by `<page>|<cta>`
- Useful per-user fields include `firstSignInAt`, `lastSignInAt`,
  `signInCount`, `firstSignInPage`, `firstSignInCta`, `lastSignInPage`,
  `lastSignInCta`, `lastRequiredDriveScopeGranted`, `connectedAt`,
  `activationPromptedAt`, `connectionMethod`, `provisioningMethod`,
  `lastSeenAt`, `lastSheetReadAt`, `sheetReadDays`, `returnPromptedAt`, and
  `provisionedSheetId`

Recommended funnel definitions:

- Sign-in: `firstSignInAt` or daily attribution metric
- Scope success: `lastRequiredDriveScopeGranted === true`
- Scope failure: signed in with `lastRequiredDriveScopeGranted === false` and
  no activation
- Activation: `connectedAt` and/or `provisionedSheetId` present
- Real app usage: successful sheet reads via `lastSheetReadAt` or
  `sheetReadDays`
- Returning user: an existing activated user with `lastSeenAt` or
  `lastSheetReadAt` in the review window, plus stronger evidence from
  multi-day `sheetReadDays`, `returnPromptedAt`, manual replies, support
  exchanges, or donations

For each review:

1. Define the exact date window in UTC and, if relevant, translate it into
   the user's local-date context.
2. Exclude likely internal/test/admin accounts from public-user conclusions and
   state that exclusion.
3. Segment the funnel by `firstSignInPage|firstSignInCta` and compare against
   daily aggregate attribution keys.
4. Cross-check against any manual notes, email/support PDFs, Gmail searches, or
   donation notes the user provides. Manual qualitative evidence should explain
   the reasons behind the KV counts.
5. Verify current code before recommending funnel changes. In particular, do
   not suggest adding Drive-scope education, scope repair, import-first preview,
   stalled-user founder outreach, or CTA metadata tracking without first
   checking whether those paths already exist.
6. Separate conclusions into:
   - what the data says now
   - what is too early to call
   - which product/acquisition experiments are worth trying next
   - what instrumentation gap, if any, blocks a better read

Prefer a concise output table:

`source -> sign-ins -> scope granted -> activated -> sheet-read users -> repeat/return evidence -> qualitative notes -> recommended action`
