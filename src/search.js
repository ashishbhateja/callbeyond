/**
 * search.js — small, dependency-free full-text search for an edition.
 *
 * Builds an in-memory inverted index over each article's title, themes,
 * summary, and body, then ranks matches with TF-IDF plus light field
 * weighting (a hit in the title counts for more than one in the body). It is
 * meant for a single edition's worth of articles — hundreds, not millions —
 * which is exactly the scale of a monthly magazine, and it keeps the whole
 * search experience on the client with no server round-trip.
 *
 * @module search
 */

/** How much a match in each field contributes to the score. */
const FIELD_WEIGHTS = Object.freeze({
  title: 3,
  themes: 2,
  summary: 1.5,
  body: 1,
});

/** Words too common to be worth indexing. Trimmed on purpose — short. */
const STOP_WORDS = new Set(
  'a an and are as at be by for from has he in is it its of on that the to was were will with'.split(' '),
);

export class SearchIndex {
  constructor() {
    /** @type {Map<string, Map<number, number>>} token -> (docId -> weighted tf) */
    this._postings = new Map();
    /** @type {Array<object>} original articles, indexed by docId */
    this._docs = [];
    this._built = false;
  }

  /**
   * Build the index from an edition's articles. Returns `this` for chaining.
   * @param {Array<{title?: string, themes?: string[], summary?: string, body?: string}>} articles
   */
  build(articles) {
    this._postings.clear();
    this._docs = articles.slice();

    articles.forEach((article, docId) => {
      for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
        const value = article[field];
        const text = Array.isArray(value) ? value.join(' ') : value ?? '';
        for (const token of tokenize(text)) {
          const postings = this._postings.get(token) ?? new Map();
          postings.set(docId, (postings.get(docId) ?? 0) + weight);
          this._postings.set(token, postings);
        }
      }
    });

    this._built = true;
    return this;
  }

  /**
   * Rank articles against a query. AND-biased: documents matching more of the
   * query terms rank above those matching fewer.
   * @param {string} query
   * @param {{limit?: number}} [options]
   * @returns {Array<{ article: object, score: number, matched: string[] }>}
   */
  search(query, { limit = 20 } = {}) {
    if (!this._built) throw new Error('SearchIndex.search called before build()');
    const terms = tokenize(query);
    if (terms.length === 0) return [];

    const N = this._docs.length;
    /** @type {Map<number, { score: number, matched: Set<string> }>} */
    const hits = new Map();

    for (const term of terms) {
      const postings = this._postings.get(term);
      if (!postings) continue;
      const idf = Math.log(1 + N / postings.size); // rarer term -> higher idf
      for (const [docId, tf] of postings) {
        const hit = hits.get(docId) ?? { score: 0, matched: new Set() };
        hit.score += tf * idf;
        hit.matched.add(term);
        hits.set(docId, hit);
      }
    }

    return [...hits.entries()]
      .map(([docId, { score, matched }]) => ({
        article: this._docs[docId],
        // Reward coverage of the query so multi-term matches win.
        score: score * (matched.size / terms.length),
        matched: [...matched],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

/** Lowercase, split on non-word characters, drop stop words and single chars. */
export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Build a short contextual snippet around the first matched term, for display
 * beneath a search result. Looks in the summary first, then the body; if no
 * term is found, falls back to the start of the text.
 *
 * @param {{summary?: string, body?: string}} article
 * @param {string[]} terms lowercased query terms (as returned in `matched`)
 * @param {{contextChars?: number}} [options]
 * @returns {string} a trimmed window, with … marking where text was cut
 */
export function snippet(article, terms = [], { contextChars = 120 } = {}) {
  const half = Math.floor(contextChars / 2);
  for (const text of [article.summary, article.body]) {
    if (!text) continue;
    const lower = text.toLowerCase();
    let idx = -1;
    for (const t of terms) {
      const at = lower.indexOf(t);
      if (at !== -1 && (idx === -1 || at < idx)) idx = at;
    }
    if (idx === -1) continue;
    const start = Math.max(0, idx - half);
    const end = Math.min(text.length, idx + half);
    let s = text.slice(start, end).trim();
    if (start > 0) s = `… ${s}`;
    if (end < text.length) s = `${s} …`;
    return s;
  }
  const fallback = (article.summary || article.body || '').trim();
  return fallback.length > contextChars ? `${fallback.slice(0, contextChars).trim()} …` : fallback;
}
