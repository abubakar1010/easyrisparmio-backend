import { Transform } from 'class-transformer';

/**
 * Parses a query-string boolean (`?isActive=false`) into a real boolean.
 *
 * The obvious version of this — `Transform(({ value }) => value === 'true')` —
 * is broken in this app, and silently. `main.ts` enables
 * `transformOptions.enableImplicitConversion`, so class-transformer coerces the
 * raw string to the property's declared type *before* a custom transform sees
 * it, and its boolean coercion is `Boolean(value)`. The string `'false'` is
 * truthy, so `value` arrives as `true` and every "is it 'false'?" check that
 * follows is dead code: `?isActive=false` filters for active rows instead.
 *
 * Reading `obj[key]` instead of `value` sidesteps that — `obj` is the original
 * plain object, untouched by implicit conversion.
 *
 * Anything that isn't a recognised boolean literal is passed through unchanged
 * so the accompanying `@IsBoolean()` rejects it with a 400, rather than being
 * quietly coerced to `true`.
 *
 * Apply to every optional boolean query parameter.
 */
export const ToBoolean = () =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj?.[key];

    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;

    return raw;
  });
