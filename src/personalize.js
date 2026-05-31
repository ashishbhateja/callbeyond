/**
 * personalize.js — transparent, on-device reading recommendations.
 *
 * The Call Beyond is a contemplative magazine, so the recommender is built to be
 * legible rather than clever: every score can be explained in one sentence, and
 * nothing leaves the reader's browser. There is no backend, no tracking pixel,
 * and no opaque model — affinities are derived from the themes a reader engages
 * with and stored in localStorage under the reader's own control.
 *
 * The scoring model is deliberately simple:
 *
 *   score(article) =  w_interest * interestOverlap(article)
 *                  +  w_history  * historyAffinity(article)
 *                  +  w_novelty  * novelty(article)
 *                  -  w_seen     * alreadyRead(article)
 *
 * Each term is in [0, 1] before weighting, so weights read as relative
 * importance. Tune them in DEFAULT_WEIGHTS or pass overrides to the constructor.
 *
 * @module personalize
 */

/** Relative importance of each scoring term. They need not sum to 1. */
export const DEFAULT_WEIGHTS = Object.freeze({
  interest: 1.0, // themes the reader explicitly selected
  history: 0.6, // themes the reader has read in the past
  novelty: 0.2, // gentle nudge toward themes the reader has seen less of
  seen: 0.9, // strong penalty so finished articles drop down the list
});

const STORAGE_KEY = 'callbeyond.reader.profile.v1';

/**
 * A reader profile: declared interests plus an implicit theme affinity built
 * from reading history. Persisted locally and fully resettable by the reader.
 */
export class Personalizer {
  /**
   * @param {object} [options]
   * @param {string[]} [options.interests] Initial theme interests.
   * @param {Partial<typeof DEFAULT_WEIGHTS>} [options.weights] Weight overrides.
   * @param {Storage|null} [options.storage] Defaults to window.localStorage;
   *   pass null to run purely in memory (useful for tests).
   */
  constructor({ interests, weights, storage } = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.storage = storage === undefined ? safeLocalStorage() : storage;

    const saved = this._load();
    /** @type {Set<string>} themes the reader opted into */
    this.interests = new Set(interests ?? saved.interests ?? []);
    /** @type {Record<string, number>} theme -> affinity weight from history */
    this.affinity = saved.affinity ?? {};
    /** @type {Set<string>} ids of articles the reader has finished */
    this.seen = new Set(saved.seen ?? []);
  }

  /** Replace the reader's declared interests and persist. */
  setInterests(themes) {
    this.interests = new Set(themes.map(normalizeTheme));
    this._save();
    return this;
  }

  /**
   * Record that an article was read. Each of its themes gains affinity, with
   * diminishing returns so a single theme can't dominate the profile.
   * @param {{id: string, themes?: string[]}} article
   */
  recordRead(article) {
    if (!article?.id) return this;
    this.seen.add(article.id);
    for (const theme of article.themes ?? []) {
      const key = normalizeTheme(theme);
      const current = this.affinity[key] ?? 0;
      this.affinity[key] = current + 1 / (1 + current); // concave growth
    }
    this._save();
    return this;
  }

  /** Forget everything stored for this reader. */
  reset() {
    this.interests = new Set();
    this.affinity = {};
    this.seen = new Set();
    this._save();
    return this;
  }

  /**
   * Score a single article in [0, ~weights.interest + weights.history + ...].
   * Returned alongside a human-readable `reasons` array so the UI can explain
   * *why* something was recommended — important for a reflective audience.
   *
   * @param {{id: string, themes?: string[]}} article
   * @param {{maxAffinity?: number}} [ctx] Precomputed corpus stats.
   * @returns {{ score: number, reasons: string[] }}
   */
  scoreArticle(article, ctx = {}) {
    const themes = (article.themes ?? []).map(normalizeTheme);
    const reasons = [];

    const interestOverlap = themes.length
      ? themes.filter((t) => this.interests.has(t)).length / themes.length
      : 0;
    if (interestOverlap > 0) {
      const matched = themes.filter((t) => this.interests.has(t));
      reasons.push(`matches your interest in ${formatList(matched)}`);
    }

    const maxAffinity = ctx.maxAffinity ?? this._maxAffinity();
    const historyAffinity = maxAffinity
      ? avg(themes.map((t) => (this.affinity[t] ?? 0) / maxAffinity))
      : 0;
    if (historyAffinity > 0.15) {
      reasons.push('continues themes you have been reading');
    }

    // Novelty rewards themes the reader has engaged with the least, so the
    // list stays exploratory instead of collapsing onto one subject.
    const novelty = themes.length
      ? avg(themes.map((t) => 1 - clamp01((this.affinity[t] ?? 0) / 3)))
      : 0;

    const alreadyRead = this.seen.has(article.id) ? 1 : 0;
    if (alreadyRead) reasons.push('already read');

    const score =
      this.weights.interest * interestOverlap +
      this.weights.history * historyAffinity +
      this.weights.novelty * novelty -
      this.weights.seen * alreadyRead;

    return { score, reasons };
  }

  /**
   * Rank a list of articles for this reader, best first.
   * @param {Array<{id: string, themes?: string[]}>} articles
   * @param {{limit?: number, includeSeen?: boolean}} [options]
   * @returns {Array<object & { score: number, reasons: string[] }>}
   */
  recommend(articles, { limit = Infinity, includeSeen = false } = {}) {
    const maxAffinity = this._maxAffinity();
    return articles
      .map((article) => ({ ...article, ...this.scoreArticle(article, { maxAffinity }) }))
      .filter((a) => includeSeen || !this.seen.has(a.id))
      .sort((a, b) => b.score - a.score || (a.title ?? '').localeCompare(b.title ?? ''))
      .slice(0, limit);
  }

  /** All themes the reader has any signal for (declared or read). */
  knownThemes() {
    return new Set([...this.interests, ...Object.keys(this.affinity)]);
  }

  _maxAffinity() {
    const values = Object.values(this.affinity);
    return values.length ? Math.max(...values) : 0;
  }

  _load() {
    if (!this.storage) return {};
    try {
      return JSON.parse(this.storage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  _save() {
    if (!this.storage) return;
    try {
      this.storage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          interests: [...this.interests],
          affinity: this.affinity,
          seen: [...this.seen],
        }),
      );
    } catch {
      /* storage full or unavailable — degrade to in-memory silently */
    }
  }
}

/** Collect every distinct theme across a set of articles, sorted. */
export function collectThemes(articles) {
  const themes = new Set();
  for (const article of articles) {
    for (const theme of article.themes ?? []) themes.add(normalizeTheme(theme));
  }
  return [...themes].sort();
}

// --- small helpers -------------------------------------------------------

/** Canonical form for a theme so "Integral Yoga" and "integral yoga" match. */
export function normalizeTheme(theme) {
  return String(theme).trim().toLowerCase();
}

function avg(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function formatList(items) {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function safeLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // e.g. blocked by privacy settings
  }
}
