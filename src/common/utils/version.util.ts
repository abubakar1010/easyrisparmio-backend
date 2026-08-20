/**
 * Document versions are dotted numbers ("1", "2.1", "3.0.2"). They are compared
 * segment by segment rather than as strings, because "2.10" sorts before "2.9"
 * lexicographically and that would silently stop asking users to re-accept.
 */
export const VERSION_PATTERN = /^\d{1,3}(\.\d{1,3}){0,2}$/;

export function isValidVersion(value: string): boolean {
  return VERSION_PATTERN.test(value);
}

function segments(value: string): number[] {
  return value
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

/** Returns a negative number when `a` is older, 0 when equal, positive when newer. */
export function compareVersions(a: string, b: string): number {
  const left = segments(a || '0');
  const right = segments(b || '0');
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

/** The newest of the given versions, or `fallback` when the list is empty. */
export function maxVersion(versions: string[], fallback = '1.0'): string {
  return versions
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .reduce<string | null>(
      (best, current) =>
        best === null || compareVersions(current, best) > 0 ? current : best,
      null,
    ) ?? fallback;
}
