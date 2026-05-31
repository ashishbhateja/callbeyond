/**
 * reader.js — wires an edition manifest into a small, accessible reading app.
 *
 * Responsibilities are kept thin on purpose: this module loads content, renders
 * it, and connects the two reusable engines — {@link module:personalize} and
 * {@link module:search}. All of the interesting logic lives in those modules so
 * they can be tested and reused independently of any UI.
 */
import { Personalizer, collectThemes } from '../personalize.js';
import { SearchIndex } from '../search.js';

const EDITION_URL = new URL('../../content/sample-edition.json', import.meta.url);

const els = {
  status: document.getElementById('status'),
  interests: document.getElementById('interests'),
  recommendations: document.getElementById('recommendations'),
  results: document.getElementById('results'),
  resultsHeading: document.getElementById('results-heading'),
  search: document.getElementById('search'),
  article: document.getElementById('article'),
  reset: document.getElementById('reset-profile'),
};

const personalizer = new Personalizer();
const index = new SearchIndex();
let articles = [];

init();

async function init() {
  try {
    const edition = await loadEdition(EDITION_URL);
    articles = edition.articles ?? [];
    index.build(articles);

    renderInterestChips(collectThemes(articles));
    renderRecommendations();
    announce(`Loaded ${articles.length} articles from ${edition.edition}.`);

    els.search.addEventListener('input', debounce(onSearch, 150));
    els.reset.addEventListener('click', onReset);
  } catch (err) {
    // Most commonly this is a file:// fetch being blocked — guide the reader.
    announce(
      'Could not load the edition. If you opened this file directly, serve the ' +
        'folder over HTTP instead (see CONTRIBUTING.md), then reload.',
    );
    console.error(err);
  }
}

async function loadEdition(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load edition: HTTP ${res.status}`);
  return res.json();
}

// --- rendering -----------------------------------------------------------

function renderInterestChips(themes) {
  els.interests.replaceChildren();
  for (const theme of themes) {
    const id = `interest-${slug(theme)}`;
    const label = document.createElement('label');
    label.className = 'chip';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = theme;
    input.id = id;
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

/**
 * Render a list of articles. Each entry shows its themes and, when present, the
 * recommender's plain-language reasons — so the reader can see *why* it surfaced.
 */
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

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = [item.author, themeText(item.themes), readingTime(item)]
      .filter(Boolean)
      .join(' · ');

    li.append(h, meta);

    if (item.summary) {
      const summary = document.createElement('p');
      summary.textContent = item.summary;
      li.append(summary);
    }
    if (item.reasons?.length) {
      const why = document.createElement('p');
      why.className = 'why';
      why.textContent = `Why: ${item.reasons.join('; ')}.`;
      li.append(why);
    }
    els.results.append(li);
  }
}

function openArticle(article) {
  personalizer.recordRead(article);
  els.article.hidden = false;
  els.article.replaceChildren();

  const h = document.createElement('h2');
  h.textContent = article.title;
  h.tabIndex = -1;

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = [article.author, themeText(article.themes), readingTime(article)]
    .filter(Boolean)
    .join(' · ');

  const body = document.createElement('div');
  body.className = 'body';
  // Body may be plain text in the sample; split into paragraphs for readability.
  for (const para of String(article.body ?? '').split(/\n{2,}/)) {
    const p = document.createElement('p');
    p.textContent = para;
    body.append(p);
  }

  els.article.append(h, meta, body);
  h.focus(); // move keyboard + screen-reader focus to the opened article
  renderRecommendations(); // reading shifts affinities; refresh suggestions
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

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
