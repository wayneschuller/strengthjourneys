/**
 * Turbopack loader for the browser copy of the lift JSON files in this folder.
 * Wired up in next.config.js under turbopack.rules, for browser code only.
 *
 * Every page ships the registry, because the nav, footer and log read lifts on
 * every page. They only need the small facts though, while the page blocks
 * (guide and strengthLevels) were ~84% of the bytes: about 45 KB gzipped on
 * every page in Oct 2026, growing with every guide written. So the browser copy
 * keeps every other field and stubs the blocks:
 *
 *   guide           -> {}             still truthy, so isLiftGuideIndexable works
 *   strengthLevels  -> { pageTitle }  truthy, plus the title the hub cards show
 *
 * The server copy is the untouched file, so getStaticProps, server rendering
 * and next-sitemap.config.js see everything. The guide and strength levels
 * pages get their blocks as props from getStaticProps; browser code that read
 * a block straight from the registry would get the stub, and its first render
 * would not match the server HTML. If this rule ever stops applying (a webpack
 * build ignores turbopack.rules), the browser simply gets the full files again.
 *
 * Turbopack loaders must return JavaScript, hence the export default.
 */
module.exports = function liftStubLoader(source) {
  const lift = JSON.parse(source);
  if (lift.guide) lift.guide = {};
  if (lift.strengthLevels) {
    lift.strengthLevels = { pageTitle: lift.strengthLevels.pageTitle ?? null };
  }
  return `export default ${JSON.stringify(lift)};`;
};
