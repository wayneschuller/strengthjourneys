/**
 * Checks every lift file in src/lib/lifts/ against src/lib/lift-schema.js,
 * plus the rules that span files or touch disk: names are unique, every file
 * is wired into the registry, artwork exists, standards table rows exist, and
 * inline markdown has no half-open marks.
 *
 * Run with `npm run validate:lifts`. Exits non-zero on any problem.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(repositoryRoot, "src");
const liftsDir = path.join(sourceRoot, "lib/lifts");

// Same `@/` resolution as scripts/validate-hevy-importer.mjs.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const target = path.join(sourceRoot, specifier.slice(2));
    return {
      shortCircuit: true,
      url: pathToFileURL(path.extname(target) ? target : `${target}.js`).href,
    };
  },
  // The standards module reaches the registry, whose bundler-style JSON
  // imports carry no `with { type: "json" }`; supply it here.
  load(url, context, nextLoad) {
    if (!url.endsWith(".json")) return nextLoad(url, context);
    return nextLoad(url, { ...context, importAttributes: { type: "json" } });
  },
});

const { liftSchema } = await import("@/lib/lift-schema.js");
const { parseInlineMarkdown } = await import("@/lib/inline-markdown.js");
const { LiftingStandardsKG } = await import("@/lib/lifting-standards-kg.js");

const problems = [];
const report = (file, where, message) =>
  problems.push(`${file}${where ? ` ${where}` : ""}: ${message}`);

const registrySource = readFileSync(path.join(sourceRoot, "lib/lift-registry.js"), "utf8");
const files = readdirSync(liftsDir).filter((file) => file.endsWith(".json")).sort();
const lifts = [];

for (const file of files) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(path.join(liftsDir, file), "utf8"));
  } catch (error) {
    report(file, "", `not valid JSON (${error.message})`);
    continue;
  }
  const result = liftSchema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      report(file, issue.path.join(".") || "(root)", issue.message);
    }
    continue;
  }
  lifts.push({ file, lift: result.data });
}

const seenNames = new Map();
const seenSlugs = new Map();

for (const { file, lift } of lifts) {
  const expectedFile = `${slugify(lift.liftType)}.json`;
  if (file !== expectedFile) report(file, "", `should be named ${expectedFile}`);

  if (!registrySource.includes(`@/lib/lifts/${file}"`)) {
    report(file, "", "is not imported in src/lib/lift-registry.js");
  }

  for (const name of [lift.liftType, ...(lift.synonyms ?? [])]) {
    if (seenNames.has(name)) report(file, "", `name "${name}" is also used by ${seenNames.get(name)}`);
    seenNames.set(name, file);
  }
  if (seenSlugs.has(lift.slug)) report(file, "slug", `also used by ${seenSlugs.get(lift.slug)}`);
  seenSlugs.set(lift.slug, file);

  for (const [where, src] of [
    ["artwork.src", lift.artwork?.src],
    ["guide.ogImage", lift.guide?.ogImage],
  ]) {
    if (src && !existsSync(path.join(repositoryRoot, "public", src))) {
      report(file, where, `${src} is not in public/`);
    }
  }

  for (const [where, value] of collectInlineMarkdown(lift)) {
    for (const part of parseInlineMarkdown(value)) {
      if (part.type === "text" && /\*\*|\]\(/.test(part.text)) {
        report(file, where, "has an unclosed ** or a malformed [link](url)");
      }
    }
  }

  const table = lift.strengthLevels?.interpretation?.exampleTable;
  for (const bodyWeight of table?.bodyweightsKg ?? []) {
    const row = LiftingStandardsKG.find(
      (entry) =>
        entry.liftType === lift.liftType &&
        entry.gender === table.sex &&
        entry.age === table.age &&
        entry.bodyWeight === bodyWeight,
    );
    if (!row) {
      report(file, "strengthLevels.interpretation.exampleTable", `no ${table.sex} age ${table.age} row at ${bodyWeight} kg`);
    }
  }
}

if (problems.length) {
  console.error(`${problems.length} lift registry problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`${lifts.length} lift files valid.`);

/** [path, value] for every field the schema marks as inline markdown. */
function collectInlineMarkdown(lift) {
  const found = [];
  lift.guide?.introduction?.paragraphs.forEach((value, i) =>
    found.push([`guide.introduction.paragraphs.${i}`, value]),
  );
  lift.guide?.faqItems?.forEach((item, i) => found.push([`guide.faqItems.${i}.answer`, item.answer]));
  lift.strengthLevels?.faqItems.forEach((item, i) =>
    found.push([`strengthLevels.faqItems.${i}.answer`, item.answer]),
  );
  return found;
}

/** Mirrors slugifyLiftType in src/lib/lift-registry.js. */
function slugify(liftType) {
  return String(liftType)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
