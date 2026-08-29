/**
 * Remark plugin that hyperlinks the first mention of each Big Four lift in
 * assistant answers.
 *
 * We used to ask the model to emit these links itself. It did so unreliably —
 * measured at roughly a 50% violation rate, either repeating a lift's link or
 * linking one lift in a list and leaving the rest as plain text. Doing it over
 * the parsed markdown instead is exact, costs no tokens, and works the same
 * whichever model is behind the chat.
 *
 * Matching is deliberately conservative: it only fires on unambiguous names of
 * the lift itself. "Bench" alone is not matched because it is usually the
 * furniture ("a flat bench that doesn't wobble"), and "squat" is skipped when
 * it is naming a rack. Under-linking is much cheaper than sending a reader to
 * a progress guide from a sentence about equipment.
 */

const BIG_FOUR = [
  {
    id: "squat",
    href: "/progress-guide/squat",
    // Not "squat rack" / "squat stand" / "squat cage" - that is equipment.
    pattern: /\bback squats?\b|\bsquats?\b(?!\s+(?:rack|stand|cage|bar))/i,
  },
  {
    id: "bench-press",
    href: "/progress-guide/bench-press",
    pattern: /\bbench press(?:es)?\b/i,
  },
  {
    id: "deadlift",
    href: "/progress-guide/deadlift",
    pattern: /\bdeadlifts?\b/i,
  },
  {
    id: "strict-press",
    href: "/progress-guide/strict-press",
    pattern: /\bstrict press(?:es)?\b|\boverhead press(?:es)?\b|\bOHP\b/i,
  },
];

// Never linkify inside these: existing links, code, headings, or image alts.
const SKIPPED_NODE_TYPES = new Set([
  "link",
  "linkReference",
  "code",
  "inlineCode",
  "html",
  "definition",
  "heading",
  "image",
  "imageReference",
]);

function findEarliestMatch(value, remaining) {
  let best = null;

  for (const lift of remaining) {
    const match = lift.pattern.exec(value);
    if (!match) continue;

    // Earliest wins; on a tie prefer the longer name ("Back Squat" over "Squat").
    if (
      !best ||
      match.index < best.index ||
      (match.index === best.index && match[0].length > best.text.length)
    ) {
      best = { lift, index: match.index, text: match[0] };
    }
  }

  return best;
}

function linkifyTextNode(node, remaining) {
  let value = node.value;
  const replacement = [];

  while (value && remaining.length > 0) {
    const hit = findEarliestMatch(value, remaining);
    if (!hit) break;

    if (hit.index > 0) {
      replacement.push({ type: "text", value: value.slice(0, hit.index) });
    }

    replacement.push({
      type: "link",
      url: hit.lift.href,
      children: [{ type: "text", value: hit.text }],
    });

    value = value.slice(hit.index + hit.text.length);
    remaining.splice(remaining.indexOf(hit.lift), 1);
  }

  if (replacement.length === 0) return null;
  if (value) replacement.push({ type: "text", value });

  return replacement;
}

/**
 * Drops any lift the message already links itself. Without this a
 * model-generated link would not consume the lift and we would add a second
 * link for it - the exact duplication this plugin exists to prevent.
 */
function excludeAlreadyLinked(node, remaining) {
  if (node.type === "link" && typeof node.url === "string") {
    const linked = remaining.findIndex((lift) => lift.href === node.url);
    if (linked !== -1) remaining.splice(linked, 1);
  }

  if (!Array.isArray(node.children)) return;
  for (const child of node.children) excludeAlreadyLinked(child, remaining);
}

function walk(node, remaining) {
  if (!Array.isArray(node.children)) return;

  for (let index = 0; index < node.children.length; index += 1) {
    if (remaining.length === 0) return;

    const child = node.children[index];
    if (SKIPPED_NODE_TYPES.has(child.type)) continue;

    if (child.type !== "text") {
      walk(child, remaining);
      continue;
    }

    const replacement = linkifyTextNode(child, remaining);
    if (replacement) {
      node.children.splice(index, 1, ...replacement);
      index += replacement.length - 1;
    }
  }
}

/** Remark plugin. Each message is linked independently, once per lift. */
export function remarkBigFourLinks() {
  return (tree) => {
    const remaining = [...BIG_FOUR];
    excludeAlreadyLinked(tree, remaining);
    walk(tree, remaining);
  };
}

export const BIG_FOUR_REMARK_PLUGINS = [remarkBigFourLinks];
