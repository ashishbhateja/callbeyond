/**
 * reader.js — wires an edition and the year's editorial arc into a small,
 * accessible reading app.
 *
 * Responsibilities are kept thin on purpose: this module loads data, renders
 * it, and connects the reusable engines — {@link module:personalize},
 * {@link module:search}, and {@link module:journey}. The interesting logic
 * lives in those modules so they can be tested and reused without any UI.
 */
import { Personalizer, collectThemes } from '../personalize.js';
import { SearchIndex } from '../search.js';
import { asMovements, currentMonth, movementOf, mirrorOf } from '../journey.js';

const EDITION_URL = new URL('../../content/sample-edition.json', import.meta.url);
const ARC_URL = new URL('../../content/2026-arc.json', import.meta.url);

const els = {
  status: document.getElementById('status'),
  interests: document.getElementById('interests'),
  results: document.getElementById('results'),
  resultsHeading: document.getElementById('results-heading'),
  search: document.getElementById('search'),
  article: document.getElementById('article'),
  reset: document.getElementById('reset-profile'),
  arcSection: document.getElementById('arc-section'),
  arcCurrent: document.getElementById('arc-current'),
  arcMovements: document.getElementById('arc-movements'),
  arcDetail: document.getElementById('arc-detail'),
};

const personalizer = new Personalizer();
const index = new SearchIndex();
let articles = [];
let arc = null;

init();

async function init() {
  try {
    const { edition, arc: loadedArc } = await loadData();
    articles = edition.articles ?? [];
    arc = loadedArc;
    index.build(articles);

    renderInterestChips(collectThemes(articles));
    renderRecommendations();
    if (arc) renderJourney();
    else if (els.arcSection) els.arcSection.hidden = true;

    announce(`Loaded ${articles.length} articles from ${edition.edition}.`);

    els.search.addEventListener('input', debounce(onSearch, 150));
    els.reset.addEventListener('click', onReset);
  } catch (err) {
    announce(
      'Could not load the edition. If you opened this file directly, serve the ' +
        'folder over HTTP instead (see CONTRIBUTING.md), then reload.',
    );
    console.error(err);
  }
}

/** Load the edition and (optionally) the editorial arc. */
async function loadData() {
  const [edition, loadedArc] = await Promise.all([
    fetchJSON(EDITION_URL),
    fetchJSON(ARC_URL).catch(() => null), // the arc is a nice-to-have, never fatal
  ]);
  return { edition, arc: loadedArc };
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: HTTP ${res.status}`);
  return res.json();
}

// --- the year's arc ------------------------------------------------------

function renderJourney() {
  const now = currentMonth(arc);
  els.arcCurrent.replaceChildren();
  if (now) {
    const callout = document.createElement('button');
    callout.type = 'button';
    callout.className = 'arc-now';
    callout.innerHTML = '';
    callout.append(
      tag('span', 'arc-now-label', 'This month'),
      tag('span', 'arc-now-theme', `${now.name} · ${now.theme}`),
      tag('span', 'arc-now-key', now.key),
    );
    callout.addEventListener('click', () => selectMonth(now.number));
    els.arcCurrent.append(callout);
  }

  els.arcMovements.replaceChildren();
  for (const movement of asMovements(arc)) {
    const group = document.createElement('div');
    group.className = 'arc-movement';

    group.append(tag('h3', 'arc-movement-title', movement.title));
    group.append(tag('p', 'arc-movement-blurb', movement.blurb));

    const row = document.createElement('ul');
    row.className = 'arc-months';
    for (const month of movement.monthList) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'arc-month';
      if (now && month.number === now.number) {
        btn.classList.add('is-current');
        btn.setAttribute('aria-current', 'date');
      }
      btn.append(tag('span', 'arc-month-name', month.name.slice(0, 3)));
      btn.append(tag('span', 'arc-month-theme', month.theme));
      btn.addEventListener('click', () => selectMonth(month.number));
      li.append(btn);
      row.append(li);
    }
    group.append(row);
    els.arcMovements.append(group);
  }
}

/** Show a month's editorial detail and filter the reading list to its theme. */
function selectMonth(number) {
  const month = arc.months.find((m) => m.number === number);
  if (!month) return;

  const movement = movementOf(arc, month);
  const mirror = mirrorOf(arc, number);
  const detail = els.arcDetail;
  detail.hidden = false;
  detail.replaceChildren();

  const h = tag('h3', 'arc-detail-title', `${month.name} — ${month.theme}`);
  h.tabIndex = -1;
  detail.append(h);
  detail.append(tag('p', 'arc-detail-key', `“${month.key}” · ${movement?.title ?? ''}`));
  detail.append(tag('p', 'arc-detail-note', month.note));

  if (month.anchors?.length) {
    const anchors = month.anchors
      .map((a) => (a.date ? `${a.name} (${a.date})` : a.name))
      .join(' · ');
    detail.append(tag('p', 'arc-detail-anchors', `Anchored to: ${anchors}`));
  }
  if (mirror) {
    detail.append(tag('p', 'arc-detail-mirror', `Mirrors ${mirror.name}’s ${mirror.theme}.`));
  }

  // Connect the arc to the content: show readings carrying this month's theme.
  const themed = articles.filter((a) =>
    (a.themes ?? []).some((t) => t.toLowerCase() === month.theme.toLowerCase()),
  );
  els.search.value = '';
  if (themed.length) {
    els.resultsHeading.textContent = `Readings on ${month.theme} (${themed.length})`;
    renderList(themed);
  } else {
    els.resultsHeading.textContent = `No readings tagged “${month.theme}” in this sample edition`;
    els.results.replaceChildren();
  }
  h.focus();
}

// --- recommendations, search, reading ------------------------------------

function renderInterestChips(themes) {
  els.interests.replaceChildren();
  for (const theme of themes) {
    const label = document.createElement('label');
    label.className = 'chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = theme;
    input.checked = personalizer.interests.has(theme);
    input.addEventListener('change', onInterestChange);
    label.append(input, document.createTextNode(titleCase(theme)));
    els.interests.append(label);
  }
}

function renderRecommendations() {
  const ranked = personalizer.recommend(articles, { limit: 5 });
  els.resultsHeading.textContent = 'Recommended for you';
  renderList(ranked.length ? ranked : articles.slice(0, 5));
}

function renderList(items) {
  els.results.replaceChildren();
  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'card';

    const h = document.createElement('h3');
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'link';
    link.textContent = item.title;
    link.addEventListener('click', () => openArticle(item));
    h.append(link);

    const meta = tag(
      'p',
      'meta',
      [item.author, themeText(item.themes), readingTime(item)].filter(Boolean).join(' · '),
    );
    li.append(h, meta);

    if (item.summary) li.append(tag('p', '', item.summary));
    if (item.reasons?.length) li.append(tag('p', 'why', `Why: ${item.reasons.join('; ')}.`));
    els.results.append(li);
  }
}

function openArticle(article) {
  personalizer.recordRead(article);
  els.article.hidden = false;
  els.article.replaceChildren();

  const h = tag('h2', '', article.title);
  h.tabIndex = -1;
  const meta = tag(
    'p',
    'meta',
    [article.author, themeText(article.themes), readingTime(article)].filter(Boolean).join(' · '),
  );
  const body = document.createElement('div');
  body.className = 'body';
  for (const para of String(article.body ?? '').split(/\n{2,}/)) {
    body.append(tag('p', '', para));
  }

  els.article.append(h, meta, body);
  h.focus();
  renderRecommendations();
}

// --- events --------------------------------------------------------------

function onInterestChange() {
  const checked = [...els.interests.querySelectorAll('input:checked')].map((i) => i.value);
  personalizer.setInterests(checked);
  renderRecommendations();
}

function onSearch(event) {
  const query = event.target.value.trim();
  if (!query) {
    renderRecommendations();
    return;
  }
  const hits = index.search(query);
  els.resultsHeading.textContent = `Results for “${query}” (${hits.length})`;
  renderList(hits.map((h) => h.article));
}

function onReset() {
  personalizer.reset();
  els.search.value = '';
  renderInterestChips(collectThemes(articles));
  renderRecommendations();
  announce('Your reading profile was cleared.');
}

// --- helpers -------------------------------------------------------------

function tag(name, className, text) {
  const el = document.createElement(name);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function announce(message) {
  els.status.textContent = message;
}

function themeText(themes) {
  return (themes ?? []).map(titleCase).join(', ');
}

function readingTime(article) {
  return article.readingTime ? `${article.readingTime} min read` : '';
}

function titleCase(s) {
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
