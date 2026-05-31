#!/usr/bin/env node
/**
 * build.mjs — assemble a single, self-contained edition page from the open
 * reader framework plus one content manifest (and the editorial arc, if present).
 *
 * This is the pipeline that keeps the framework open while the content stays
 * gated: the open `src/` is inlined into one HTML file together with a specific
 * edition's JSON, producing `dist/<issue>.html`. That output can then be served
 * as-is, or encrypted with StaticCrypt for gated publishing (printed below).
 *
 * It uses only the Node standard library — no install step, no dependencies.
 *
 *   node scripts/build.mjs content/sample-edition.json
 *
 * Note: the repository's existing root `index.html` was produced by an earlier,
 * manual StaticCrypt step and predates this pipeline. New editions should be
 * built through here so the source is always reproducible.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const manifestPath = process.argv[2] ?? 'content/sample-edition.json';
  const manifest = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'));

  const [css, personalize, search, journey, reader] = await Promise.all([
    readFile(resolve(root, 'src/reader/reader.css'), 'utf8'),
    readFile(resolve(root, 'src/personalize.js'), 'utf8'),
    readFile(resolve(root, 'src/search.js'), 'utf8'),
    readFile(resolve(root, 'src/journey.js'), 'utf8'),
    readFile(resolve(root, 'src/reader/reader.js'), 'utf8'),
  ]);

  // The editorial arc is optional; embed it if present so the journey view works.
  const arc = await readFile(resolve(root, 'content/2026-arc.json'), 'utf8')
    .then(JSON.parse)
    .catch(() => null);

  const bundled = inlineModules({ personalize, search, journey, reader }, manifest, arc);
  const html = page(manifest, css, bundled);

  const issue = sanitize(manifest.issue || manifest.edition || 'edition');
  const outPath = resolve(root, 'dist', `${issue}.html`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');

  console.log(`Built ${outPath}`);
  console.log(`  ${manifest.articles?.length ?? 0} articles from "${manifest.edition}"`);
  if (arc) console.log(`  arc embedded: ${arc.months?.length ?? 0} months`);
  console.log('\nTo publish as a gated edition, encrypt the output:');
  console.log(`  npx staticrypt "${outPath}" --short -d dist/`);
}

/** Resolve the modules' ES imports into one inline script + embedded data. */
function inlineModules({ personalize, search, journey, reader }, manifest, arc) {
  const stripExports = (src) => src.replace(/^export\s+/gm, '');
  const readerInline = reader
    .replace(/^import[^;]+;\s*$/gm, '') // drop ES imports; modules are inlined
    .replace(/^const \w+_URL = new URL[^;]+;\s*$/gm, '') // data is embedded, not fetched
    .replace(/await loadData\(\)/, '{ edition: EMBEDDED_EDITION, arc: EMBEDDED_ARC }');

  return [
    `const EMBEDDED_EDITION = ${JSON.stringify(manifest)};`,
    `const EMBEDDED_ARC = ${JSON.stringify(arc)};`,
    stripExports(personalize),
    stripExports(search),
    stripExports(journey),
    readerInline,
  ].join('\n\n');
}

function page(manifest, css, script) {
  const title = escapeHtml(`The Call Beyond — ${manifest.edition ?? ''}`.trim());
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${css}</style>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="site-controls"><button id="theme-toggle" type="button" class="theme-toggle" aria-pressed="false">High contrast</button></div>
      <h1>The Call Beyond</h1>
      <p class="tagline">${escapeHtml(manifest.edition ?? '')}</p>
    </header>
    <main id="main">
      <section id="arc-section" class="panel"><h2 id="arc-heading">The 2026 arc</h2>
        <div id="arc-current" class="arc-current"></div>
        <div id="arc-movements" class="arc-movements"></div>
        <div id="arc-detail" class="arc-detail" role="region" aria-label="Selected month" hidden></div>
      </section>
      <section class="panel"><h2 id="interests-heading">Your interests</h2>
        <div id="interests" class="chips" role="group" aria-labelledby="interests-heading"></div>
        <button id="reset-profile" type="button" class="secondary">Clear my profile</button>
      </section>
      <section class="panel"><h2 id="search-heading">Search this edition</h2>
        <label class="visually-hidden" for="search">Search articles</label>
        <input id="search" type="search" placeholder="Search…" autocomplete="off" />
      </section>
      <section class="panel"><h2>Reading list</h2>
        <p id="results-heading" class="results-heading" aria-live="polite">Recommended for you</p>
        <ul id="results" class="cards"></ul>
      </section>
      <article id="article" class="reading" aria-label="Article" hidden></article>
    </main>
    <p id="status" class="visually-hidden" role="status" aria-live="polite"></p>
    <script>${script}</script>
  </body>
</html>
`;
}

const sanitize = (s) => String(s).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
