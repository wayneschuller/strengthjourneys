/**
 * Lets a script under plain Node import the application's source the way the
 * app does. Import this file first, for its side effect:
 *
 *   import "./source-loader.mjs";
 *
 * It resolves `@/` to src/, treats src/ files as ES modules and serves the
 * lift registry's JSON files. Every script here shares this one copy, so a
 * change to how the app imports things is made once.
 */

import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(repositoryRoot, "src");
const sourceRootUrl = pathToFileURL(sourceRoot).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) {
      return nextResolve(specifier, context);
    }
    const target = path.join(sourceRoot, specifier.slice(2));
    return {
      shortCircuit: true,
      url: pathToFileURL(path.extname(target) ? target : `${target}.js`).href,
    };
  },
  load(url, context, nextLoad) {
    // The lift registry imports its JSON files the way the Next bundlers
    // allow, with no import attribute, which bare Node refuses before a hook
    // could step in. Serve them here as modules exporting the parsed object.
    if (url.startsWith(sourceRootUrl) && url.endsWith(".json")) {
      return {
        shortCircuit: true,
        format: "module",
        source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`,
      };
    }
    const loaded = nextLoad(url, context);
    if (url.startsWith(sourceRootUrl) && url.endsWith(".js")) {
      return { ...loaded, format: "module" };
    }
    return loaded;
  },
});
