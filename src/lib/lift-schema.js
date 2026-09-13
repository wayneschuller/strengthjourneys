/**
 * The shape of a lift file in src/lib/lifts/, and the reference for what each
 * field means. Run `npm run validate:lifts` after editing any lift file.
 *
 * Objects are strict: a misspelt or invented key fails validation instead of
 * quietly doing nothing. To add a field, add it here first, with a describe()
 * saying what it is for, then use it.
 *
 * Only scripts/validate-lifts.mjs imports this file, so zod never reaches the
 * browser bundle. Rules that span files (unique names, artwork on disk, the
 * standards table rows) live in the script.
 *
 * TEXT FORMAT: fields marked "inline markdown" accept **bold** and
 * [text](/path) and nothing else (see lib/inline-markdown.js). Every other
 * string renders exactly as written.
 */

import { z } from "zod";

const text = z.string().trim().min(1);
const inlineMarkdown = text.describe("Inline markdown: **bold** and [text](/path).");
const sitePath = z.string().regex(/^\/[^\s]*$/, "a site path starting with /");
const BIG_FOUR = ["Back Squat", "Bench Press", "Deadlift", "Strict Press"];

const faqItem = z.strictObject({
  question: text,
  answer: inlineMarkdown,
});

/** Fields every page block shares, named the same wherever they appear. */
const pageMeta = {
  seoTitle: text.describe("The <title> and og:title."),
  pageTitle: text.describe("The visible H1."),
  description: text.describe("Meta description. The guide also shows it under the H1."),
  keywords: text.describe("Comma separated meta keywords."),
};

const video = z.strictObject({
  url: z.url().regex(/youtube\.com\/watch\?v=|youtu\.be\//, "a YouTube watch link"),
  title: text,
  channel: text,
});

const coaching = z.strictObject({
  summary: text.describe("One plain-English sentence on what the lift is."),
  cues: z.array(text).length(3).describe("Exactly three cues, in the order a lifter needs them."),
  standardsRef: z
    .strictObject({
      liftType: z.enum(BIG_FOUR),
      ratio: z.number().positive().max(3),
      note: text.optional().describe("Why the ratio is what it is, when it is not obvious."),
    })
    .optional()
    .describe(
      "A rough ratio to a big four lift, for first-time target weights on the log. Not a published standard. Big four lifts never have one.",
    ),
});

const guide = z.strictObject({
  ...pageMeta,
  ogImage: sitePath.optional().describe("Share image in public/. Falls back to the site default."),
  introduction: z
    .strictObject({
      title: text,
      paragraphs: z.array(inlineMarkdown).min(1),
    })
    .optional(),
  quote: z
    .strictObject({
      sectionTitle: text,
      text: text,
      author: text.describe("Who said it, and where, e.g. \"Bill Starr, CrossFit Journal\"."),
    })
    .optional(),
  resources: z
    .strictObject({
      title: text,
      links: z
        .array(
          z.strictObject({
            title: text,
            url: z.url(),
            author: text,
            note: text.optional(),
          }),
        )
        .min(1),
    })
    .optional()
    .describe("Third party reading, best first."),
  faqItems: z.array(faqItem).optional().describe("Also emitted as FAQPage structured data."),
});

const strengthLevels = z.strictObject({
  ...pageMeta,
  intro: text,
  supportingCopy: text,
  relatedArticlesCategory: text.describe("The Sanity category whose articles appear at the foot of the page."),
  interpretation: z
    .strictObject({
      title: text,
      body: z.array(text).min(1),
      milestones: z.array(text).min(1),
      exampleTable: z
        .strictObject({
          sex: z.enum(["male", "female"]),
          age: z.number().int().describe("An age band midpoint in lib/lifting-standards-kg.js: 17, 25, 35 ... 85."),
          bodyweightsKg: z.array(z.number().int()).min(1).describe("Bodyweight rows present in the standards data."),
        })
        .optional()
        .describe(
          "Which slice of the standards to print as a static table. The numbers are read from the standards data at build, never typed here.",
        ),
      closer: text,
    })
    .optional(),
  faqItems: z.array(faqItem).min(1),
});

export const liftSchema = z
  .strictObject({
    // ── Identity ──────────────────────────────────────────────────────────
    liftType: text.describe(
      "Canonical name, exactly as lifters log it in their sheet. The file is named after it: Back Squat -> back-squat.json.",
    ),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .describe("The /progress-guide/ and /strength-levels/ URL segment. Changing it breaks live URLs."),
    commonName: text
      .optional()
      .describe("What people call it in headings and links, when that differs from liftType. Back Squat is \"Squat\". Defaults to liftType."),
    shortName: text.optional().describe("Compact label for tight navs, e.g. \"Bench\". Defaults to liftType."),
    synonyms: z
      .array(text)
      .optional()
      .describe(
        "Other names for the SAME lift, never a lookalike. Front Squat once pointed at Back Squat's drawing for seven months.",
      ),
    bigFour: z.literal(true).optional().describe("Squat, bench, deadlift, press: the lifts with strength standards."),
    icon: text.optional().describe("Lucide icon name; must also be registered in components/lift-icon.js."),

    // ── Short copy ────────────────────────────────────────────────────────
    tagline: text.optional().describe("One line under the lift's name on hub pages and dashboard cards."),
    homepageDescription: text.optional().describe("Big four: one line for someone who has never seen the lift."),
    bodyBenefit: text
      .optional()
      .describe("Big four: what the lift gives the body, as an invitation. Never a count of time away."),

    // ── Links and media ───────────────────────────────────────────────────
    calculatorUrl: sitePath.optional().describe("Its 1RM calculator page, when one exists."),
    artwork: z
      .strictObject({
        src: sitePath.describe("File in public/. Drawing rules live in components/lift-artwork.js."),
        figure: z.enum(["male", "female"]),
      })
      .optional()
      .describe("Having artwork is the commitment to a lift: explorer tile, log tile, and a guide page."),
    videos: z
      .array(video)
      .optional()
      .describe("Tutorials. The guide shows them all; the FIRST is the log's form check, so lead with the best beginner intro."),
    coaching: coaching.optional(),

    // ── Page blocks ───────────────────────────────────────────────────────
    guide: guide
      .optional()
      .describe("Editorial /progress-guide/ copy. The page is noindex until this block exists."),
    strengthLevels: strengthLevels.optional().describe("Copy for /strength-levels/[slug]. Big four only."),
  })
  .superRefine((lift, ctx) => {
    const bigFourOnly = ["homepageDescription", "bodyBenefit", "strengthLevels"];
    for (const key of bigFourOnly) {
      if (lift[key] && !lift.bigFour) {
        ctx.addIssue({ code: "custom", path: [key], message: "only big four lifts have this" });
      }
    }
    if (lift.bigFour) {
      for (const key of ["icon", "tagline", "bodyBenefit", "homepageDescription", "calculatorUrl", "strengthLevels"]) {
        if (!lift[key]) ctx.addIssue({ code: "custom", path: [key], message: "big four lifts need this" });
      }
      if (lift.coaching?.standardsRef) {
        ctx.addIssue({ code: "custom", path: ["coaching", "standardsRef"], message: "big four lifts are the reference" });
      }
    }
    if (lift.guide && !lift.tagline) {
      ctx.addIssue({ code: "custom", path: ["tagline"], message: "a lift with a guide needs a tagline" });
    }
  });
