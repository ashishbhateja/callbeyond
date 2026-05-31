#!/usr/bin/env node
/**
 * build.mjs — assemble a single, self-contained edition page from the open
 * reader framework plus one content manifest.
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

  const [css, personalize, search, reader] = await Promise.all([
    readFile(resolve(root, 'src/reader/reader.css'), 'utf8'),
    readFile(resolve(root, 'src/personalize.js'), 'utf8'),
    readFile(resolve(root, 'src/search.js'), 'utf8'),
    readFile(resolve(root, 'src/reader/reader.js'), 'utf8'),
  ]);

  // Inline the modules and embed the edition so the result is a single file
  // with no network dependencies — friendly to gating and offline reading.
  const bundled = inlineModules({ personalize, search, reader }, manifest);
  const html = page(manifest, css, bundled);

  const issue = sanitize(manifest.issue || manifest.edition || 'edition');
  const outPath = resolve(root, 'dist', `${issue}.html`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');

  console.log(`Built ${outPath}`);
  console.log(`  ${manifest.articles?.length ?? 0} articles from "${manifest.edition}"`);
  console.log('\nTo publish as a gated edition, encrypt the output:');
  console.log(`  npx staticrypt "${outPath}" --short -d dist/`);
}

/** Resolve the three modules' imports into one inline script + embedded data. */
function inlineModules({ personalize, search, reader }, manifest) {
  const stripExports = (src) => src.replace(/^export\s+/gm, '');
  const readerInline = reader
    .replace(/^import[^;]+;\s*$/gm, '') // drop ES imports; modules are inlined
    .replace(/const EDITION_URL[^;]+;/, '') // edition is embedded, not fetched
    .replace(/await loadEdition\(EDITION_URL\)/, 'EMBEDDED_EDITION');

  return [
    `const EMBEDDED_EDITION = ${JSON.stringify(manifest)};`,
    stripExports(personalize),
    stripExports(search),
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
      <h1>The Call Beyond</h1>
      <p class="tagline">${escapeHtml(manifest.edition ?? '')}</p>
    </header>
    <main id="main">
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
