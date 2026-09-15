# Strong importer fixtures

Synthetic file in the public Strong export shape, used by
`scripts/validate-lift-names.mjs`.

- `strong-sample.csv`: barbell lifts that should reach the big four and the
  registry variations, beside dumbbell, Smith machine, trap bar and assisted
  variants that must stay lifts of their own.

Run `npm run validate:imports` after changing a parser's lift-name handling,
the shared normalizer in `src/lib/data-sources/parser-utilities.js`, or a
registry synonym.
