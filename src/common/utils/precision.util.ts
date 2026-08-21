/**
 * Rounding for the numeric values the API hands to its clients.
 *
 * Two things make raw aggregate output unfit to send. Postgres returns
 * `decimal` columns and `SUM`/`AVG` results as strings, so `parseFloat` is
 * unavoidable — and once a value is a JS float, summation artefacts
 * (`128.40000000000001`) and non-terminating averages (`4.333333333333333`)
 * travel to the client verbatim. The admin dashboard rendered exactly that.
 *
 * Clients decide how to display a number; the API's job is to send one that is
 * already true to its scale:
 *
 *   money    2 dp — matches every `decimal(_, 2)` money column in the schema
 *   percent  2 dp — conversion rates and their period-over-period deltas
 *
 * Unit prices are deliberately absent. They are stored at `decimal(10, 6)` and
 * are sent at full stored precision: rounding them here would destroy digits
 * the client cannot recover, and display rounding belongs to the client.
 */
export const PRECISION = {
  money: 2,
  percent: 2,
} as const;

/**
 * Rounds to `decimals` places, accepting the string form Postgres returns for
 * `decimal` columns and aggregates. Anything non-numeric — including the `null`
 * a `SUM` over no rows produces — becomes 0, which is what every caller here
 * wants for an empty bucket.
 */
export function roundTo(value: unknown, decimals: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(decimals));
}

/** A money amount at the schema's 2-decimal scale. */
export const roundMoney = (value: unknown): number =>
  roundTo(value, PRECISION.money);

/** A percentage at 2 decimals. Expects a value already scaled to 0–100. */
export const roundPercent = (value: unknown): number =>
  roundTo(value, PRECISION.percent);
