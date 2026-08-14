# Hevy importer fixtures

These synthetic files capture the public Hevy workout-export shapes used by
the importer validation script.

- `hevy-kg.csv`: metric load, repeated identical sets, equipment qualifiers,
  bodyweight load, duration-only work, multiple same-day workouts, and an
  impossible date.
- `hevy-lb.csv`: imperial load plus the publicly observed
  `weight_lbs`/`distance_miles` headers.

Run `npm run validate:hevy` after changing the parser, provenance notes, or
merge deduplication.
