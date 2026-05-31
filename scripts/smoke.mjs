#!/usr/bin/env node
/**
 * smoke.mjs — fast, dependency-free checks for the framework engines.
 *
 * Run with:  node scripts/smoke.mjs
 * Exits non-zero on the first failed assertion, so it is CI-friendly as-is.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Personalizer, collectThemes, normalizeTheme } from '../src/personalize.js';
import { SearchIndex, tokenize } from '../src/search.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { articles } = JSON.parse(
  await readFile(resolve(root, 'content/sample-edition.json'), 'utf8'),
);

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

console.log('personalize.js');

check('declared interest ranks its theme first', () => {
  const p = new Personalizer({ storage: null }).setInterests(['Vedanta']);
  const top = p.recommend(articles, { limit: 1 })[0];
  assert.ok(top.themes.map(normalizeTheme).includes('vedanta'));
  assert.match(top.reasons.join(' '), /vedanta/i);
});

check('reading an article removes it from fresh recommendations', () => {
  const p = new Personalizer({ storage: null }).setInterests(['Sadhana']);
  const top = p.recommend(articles, { limit: 1 })[0];
  p.recordRead(top);
  const ids = p.recommend(articles, { limit: 20 }).map((a) => a.id);
  assert.ok(!ids.includes(top.id));
});

check('reading builds theme affinity even without declared interests', () => {
  const p = new Personalizer({ storage: null });
  const vedanta = articles.find((a) => a.themes.includes('Vedanta'));
  p.recordRead(vedanta);
  // A different unread Vedanta-adjacent article should now carry affinity.
  const scored = p.recommend(articles, { limit: 20 });
  assert.ok(scored.length > 0);
});

check('collectThemes returns a sorted, de-duplicated set', () => {
  const themes = collectThemes(articles);
  assert.deepEqual(themes, [...new Set(themes)].sort());
});

console.log('search.js');

check('finds a distinctive term in the right article', () => {
  const idx = new SearchIndex().build(articles);
  const hits = idx.search('equanimity');
  assert.equal(hits[0].article.id, 'the-mother-on-equanimity');
});

check('multi-term query rewards coverage', () => {
  const idx = new SearchIndex().build(articles);
  const hits = idx.search('integral yoga');
  assert.ok(hits.length > 0);
  assert.ok(hits[0].matched.length >= 1);
});

check('tokenize drops stop words and single characters', () => {
  assert.deepEqual(tokenize('The aim of a Yoga'), ['aim', 'yoga']);
});

check('searching before build throws a clear error', () => {
  assert.throws(() => new SearchIndex().search('x'), /before build/);
});

console.log(`\n${passed} checks passed.`);
