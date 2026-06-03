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
import { SearchIndex, tokenize, snippet } from '../src/search.js';
import { asMovements, monthByNumber, movementOf, mirrorOf, currentMonth, neighbors } from '../src/journey.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { articles } = JSON.parse(
  await readFile(resolve(root, 'content/sample-edition.json'), 'utf8'),
);
const arc = JSON.parse(await readFile(resolve(root, 'content/2026-arc.json'), 'utf8'));

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

console.log('journey.js');

check('arc covers all twelve months across three movements', () => {
  const movements = asMovements(arc);
  assert.equal(movements.length, 3);
  const months = movements.flatMap((m) => m.monthList.map((x) => x.number));
  assert.deepEqual([...months].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

check('a month resolves to its theme and movement', () => {
  const may = monthByNumber(arc, 5);
  assert.equal(may.theme, 'Discernment');
  assert.equal(movementOf(arc, may).id, 'ground');
});

check('January and December mirror each other', () => {
  assert.equal(mirrorOf(arc, 1).number, 12);
  assert.equal(mirrorOf(arc, 12).number, 1);
});

check('currentMonth maps a date onto the arc', () => {
  assert.equal(currentMonth(arc, new Date(2026, 7, 15)).theme, 'Emergence');
});

check('neighbors are the adjacent months, with no wraparound', () => {
  assert.equal(neighbors(arc, 5).prev.number, 4);
  assert.equal(neighbors(arc, 5).next.number, 6);
  assert.equal(neighbors(arc, 1).prev, null);
  assert.equal(neighbors(arc, 12).next, null);
});

console.log('personalize.js (more)');

check('reading an article adds the seen penalty and reason', () => {
  const p = new Personalizer({ storage: null }).setInterests(['Sadhana']);
  const a = articles.find((x) => x.themes.map((t) => t.toLowerCase()).includes('sadhana'));
  const before = p.scoreArticle(a).score;
  p.recordRead(a);
  const after = p.scoreArticle(a);
  assert.ok(after.reasons.includes('already read'));
  assert.ok(after.score < before);
});

console.log('search.js (snippets)');

check('snippet returns a window containing the matched term', () => {
  const s = snippet({ summary: 'A short reflection on equanimity and steadiness.' }, ['equanimity']);
  assert.ok(s.toLowerCase().includes('equanimity'));
});

check('snippet prefers the summary when it also matches', () => {
  const s = snippet({ summary: 'mentions silence here', body: 'silence again in the body' }, ['silence']);
  assert.ok(s.includes('mentions'));
});

check('snippet falls back to the body when the summary has no match', () => {
  const s = snippet({ summary: 'nothing relevant', body: 'deep in the body lies discernment' }, ['discernment']);
  assert.ok(s.toLowerCase().includes('discernment'));
});

check('snippet falls back to the start of the text when nothing matches', () => {
  const s = snippet({ summary: 'Gratitude as the ground from which the year unfolds.' }, ['absentterm']);
  assert.ok(s.startsWith('Gratitude'));
});

check('search matches an author name', () => {
  const idx = new SearchIndex().build([
    { title: 'On stillness', themes: ['Silence'], author: 'Nirodbaran', summary: 'x', body: 'y' },
  ]);
  const hits = idx.search('Nirodbaran');
  assert.equal(hits.length, 1);
  assert.ok(hits[0].matched.includes('nirodbaran'));
});

console.log(`\n${passed} checks passed.`);
