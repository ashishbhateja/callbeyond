/**
 * journey.js — read the editorial arc of a year.
 *
 * The magazine's year is not twelve independent issues but a single arc in
 * three movements, with the opening and closing months deliberately mirrored.
 * This module turns that arc (see content/2026-arc.json) into a few small,
 * pure queries the UI can use to orient a reader: which movement a month
 * belongs to, what comes before and after, and which month mirrors it.
 *
 * It holds no UI and no global state — every function takes the arc explicitly
 * and returns plain data, so it is trivial to test and reuse.
 *
 * @module journey
 */

/**
 * @typedef {Object} ArcMonth
 * @property {number} number 1–12
 * @property {string} name e.g. "January"
 * @property {string} theme e.g. "Gratitude"
 * @property {string} key short editorial key, e.g. "the soil"
 * @property {string} movement movement id this month belongs to
 * @property {Array<{name: string, date?: string}>} anchors festivals/anniversaries
 * @property {string} note editorial framing
 * @property {number} [mirrors] number of the month this one mirrors, if any
 */

/** Return the month entry for a 1–12 number, or null. */
export function monthByNumber(arc, number) {
  return arc.months.find((m) => m.number === number) ?? null;
}

/** The movement object a month belongs to, or null. */
export function movementOf(arc, month) {
  const id = typeof month === 'object' ? month.movement : monthByNumber(arc, month)?.movement;
  return arc.movements.find((mv) => mv.id === id) ?? null;
}

/** All months of a movement, in calendar order. */
export function monthsOfMovement(arc, movementId) {
  return arc.months
    .filter((m) => m.movement === movementId)
    .sort((a, b) => a.number - b.number);
}

/**
 * The month that the given month mirrors (e.g. December ⇄ January), or null.
 * Resolves the relationship in either direction.
 */
export function mirrorOf(arc, number) {
  const month = monthByNumber(arc, number);
  if (!month) return null;
  if (month.mirrors) return monthByNumber(arc, month.mirrors);
  const partner = arc.months.find((m) => m.mirrors === number);
  return partner ?? null;
}

/** Previous and next months in the arc (calendar order, no wraparound). */
export function neighbors(arc, number) {
  return {
    prev: monthByNumber(arc, number - 1),
    next: monthByNumber(arc, number + 1),
  };
}

/**
 * The arc's "current" month for a given date. Themes recur by calendar month,
 * so this maps any date onto the 1–12 plan; pass a fixed date in tests.
 * @param {Date} [date]
 */
export function currentMonth(arc, date = new Date()) {
  return monthByNumber(arc, date.getMonth() + 1);
}

/** Group the whole year as movements, each with its ordered months attached. */
export function asMovements(arc) {
  return arc.movements.map((mv) => ({
    ...mv,
    monthList: monthsOfMovement(arc, mv.id),
  }));
}
