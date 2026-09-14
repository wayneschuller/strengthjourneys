# Fitbod importer fixtures

Fitbod's exact export format isn't publicly documented in detail. This
fixture is built from the column names corroborated by multiple independent
community converter tools (Date, Exercise, Reps, Weight(kg), Duration(s),
Distance(m), Incline, Resistance, isWarmup, Note, multiplier) — the date/time
format itself is unconfirmed, so the parser accepts both ISO-like and US
slash dates defensively.

This importer is intentionally not advertised anywhere in the app (no
`/import/fitbod` guide, no picker entry) — it only activates if a matching
file is dropped in. Treat the parser as provisional until a real user export
can be checked against it.

- `fitbod-sample.csv`: a warmup + working sets pair, a bodyweight pull-up
  set, a cardio-only row (should be skipped), a row missing reps (should be
  skipped), and an impossible calendar date (should be skipped).

Run `node scripts/validate-fitbod-importer.mjs` after changing the parser.
