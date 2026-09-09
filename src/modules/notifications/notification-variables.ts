import { BillType } from '../../common/enums/bill.enum';

/**
 * The `{{...}}` variables an admin may write into a notification template or a
 * hand-composed message, and the single renderer that substitutes them.
 *
 * This file is deliberately the *only* place the set of variables is declared.
 * The regex is derived from the registry rather than written out, the admin
 * dashboard fetches the registry from `GET /notification-templates/variables`
 * instead of hardcoding its own copy, and both the send path and the preview
 * endpoint call `renderTemplateText`. Before this file existed the pattern lived
 * in `NotificationsService` and a second copy of it lived in the dashboard's
 * composer, which is exactly how a customer ends up reading a raw `{{provider}}`.
 *
 * Nothing here touches a repository or Nest, so it is testable with no mocks.
 */

export type TemplateVariableKey =
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'surname'
  | 'email'
  | 'provider'
  | 'offer_name'
  | 'utility_type';

/**
 * Where a variable's value comes from, and therefore whether it can fail.
 *
 * `user` variables always resolve — every account has an email, and the
 * fallback chains below make sure a missing first name still produces something
 * readable. `case` variables have no such fallback: a customer who has not yet
 * chosen an offer simply has no provider, and inventing one would be worse than
 * refusing to send. Those are the ones `renderTemplateText` reports as
 * unresolved so the caller can block the send.
 */
export type TemplateVariableScope = 'user' | 'case';

export interface TemplateVariableDef {
  key: TemplateVariableKey;
  scope: TemplateVariableScope;
  label: Record<'it' | 'en', string>;
  description: Record<'it' | 'en', string>;
  /** Stand-in used by the template editor's illustrative preview. */
  example: Record<'it' | 'en', string>;
}

export const TEMPLATE_VARIABLES: readonly TemplateVariableDef[] = [
  {
    key: 'name',
    scope: 'user',
    label: { it: 'Nome completo', en: 'Full name' },
    description: {
      it: 'Nome e cognome del cliente.',
      en: 'The customer’s first and last name.',
    },
    example: { it: 'Mario Rossi', en: 'Mario Rossi' },
  },
  {
    key: 'firstName',
    scope: 'user',
    label: { it: 'Nome', en: 'First name' },
    description: {
      it: 'Solo il nome del cliente.',
      en: 'The customer’s first name only.',
    },
    example: { it: 'Mario', en: 'Mario' },
  },
  {
    key: 'lastName',
    scope: 'user',
    label: { it: 'Cognome', en: 'Last name' },
    description: {
      it: 'Solo il cognome del cliente.',
      en: 'The customer’s last name only.',
    },
    example: { it: 'Rossi', en: 'Rossi' },
  },
  {
    key: 'surname',
    scope: 'user',
    label: { it: 'Cognome', en: 'Surname' },
    description: {
      it: 'Sinonimo di {{lastName}}.',
      en: 'Synonym of {{lastName}}.',
    },
    example: { it: 'Rossi', en: 'Rossi' },
  },
  {
    key: 'email',
    scope: 'user',
    label: { it: 'Email', en: 'Email' },
    description: {
      it: 'Indirizzo email del cliente.',
      en: 'The customer’s email address.',
    },
    example: { it: 'mario.rossi@example.it', en: 'mario.rossi@example.it' },
  },
  {
    key: 'provider',
    scope: 'case',
    label: { it: 'Nuovo fornitore', en: 'New provider' },
    description: {
      it: 'Il fornitore dell’offerta scelta nella pratica più recente.',
      en: 'The supplier of the offer selected on the most recent case.',
    },
    example: { it: 'Illumia', en: 'Illumia' },
  },
  {
    key: 'offer_name',
    scope: 'case',
    label: { it: 'Nome offerta', en: 'Offer name' },
    description: {
      it: 'Il nome dell’offerta scelta nella pratica più recente.',
      en: 'The name of the offer selected on the most recent case.',
    },
    example: { it: 'Casa Luce Fissa 12', en: 'Casa Luce Fissa 12' },
  },
  {
    key: 'utility_type',
    scope: 'case',
    label: { it: 'Tipo fornitura', en: 'Utility type' },
    description: {
      it: 'Luce o Gas, letto dalla bolletta della pratica.',
      en: 'Electricity or Gas, read from the case’s bill.',
    },
    example: { it: 'Luce', en: 'Electricity' },
  },
];

/** Derived, never hand-written, so the regex cannot drift from the registry. */
export const TEMPLATE_VARIABLE_KEYS: readonly TemplateVariableKey[] =
  TEMPLATE_VARIABLES.map((variable) => variable.key);

const KNOWN_KEYS = new Set<string>(TEMPLATE_VARIABLE_KEYS);

const CASE_SCOPED_KEYS = new Set<string>(
  TEMPLATE_VARIABLES.filter((v) => v.scope === 'case').map((v) => v.key),
);

/**
 * Matches only registry keys.
 *
 * A factory rather than a module-level constant: a `/g` RegExp carries
 * `lastIndex` between calls, so a shared one silently skips matches for the
 * second caller. `String.replace` happens to reset it, but `exec` and `test` do
 * not, and nothing should have to remember which is which.
 */
export const knownPlaceholderPattern = (): RegExp =>
  new RegExp(`\\{\\{\\s*(${TEMPLATE_VARIABLE_KEYS.join('|')})\\s*\\}\\}`, 'g');

/** Matches any `{{token}}`, including ones the admin invented. */
export const anyPlaceholderPattern = (): RegExp =>
  /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export interface TemplateRenderUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface TemplateRenderContext {
  user?: TemplateRenderUser | null;
  /** Supplier of the case's selected offer. */
  provider?: string | null;
  /** Name of the case's selected offer. */
  offerName?: string | null;
  /** The bill's `BillType` — localised at render time, never printed raw. */
  utilityType?: BillType | string | null;
  caseId?: string | null;
  caseNumber?: string | null;
}

const UTILITY_TYPE_LABELS: Record<string, Record<'it' | 'en', string>> = {
  [BillType.ELECTRICITY]: { it: 'Luce', en: 'Electricity' },
  [BillType.GAS]: { it: 'Gas', en: 'Gas' },
};

/** Every distinct `{{token}}` in the text, in first-seen order. */
export function extractVariables(text: string): string[] {
  if (!text || !text.includes('{{')) return [];

  const found = new Set<string>();
  for (const match of text.matchAll(anyPlaceholderPattern())) {
    found.add(match[1]);
  }
  return [...found];
}

/** Tokens the admin wrote that this registry does not know about. */
export function unknownVariables(text: string): string[] {
  return extractVariables(text).filter((key) => !KNOWN_KEYS.has(key));
}

/**
 * Whether the text needs a case loaded to render.
 *
 * The send path checks this before querying: a message addressing only the
 * customer's name should not cost a join across cases, offers and suppliers.
 */
export function usesCaseScopedVariables(text: string): boolean {
  return extractVariables(text).some((key) => CASE_SCOPED_KEYS.has(key));
}

function utilityTypeLabel(
  value: BillType | string | null | undefined,
  locale: 'it' | 'en',
): string {
  if (!value) return '';
  return UTILITY_TYPE_LABELS[value]?.[locale] || '';
}

/**
 * Resolves one variable, applying the fallback chains that predate this file.
 *
 * The `user` chains are unchanged on purpose — an unresolvable name falls
 * through to the next best identifier rather than leaving a hole, so a message
 * never reaches a customer reading "Ciao , abbiamo trovato...".
 */
function resolveVariable(
  key: TemplateVariableKey,
  ctx: TemplateRenderContext,
  locale: 'it' | 'en',
): string {
  const first = ctx.user?.firstName?.trim() || '';
  const last = ctx.user?.lastName?.trim() || '';
  const full = `${first} ${last}`.trim();
  const email = ctx.user?.email || '';

  switch (key) {
    case 'name':
      return full || first || email;
    case 'firstName':
      return first || full || email;
    case 'lastName':
    case 'surname':
      return last;
    case 'email':
      return email;
    case 'provider':
      return ctx.provider?.trim() || '';
    case 'offer_name':
      return ctx.offerName?.trim() || '';
    case 'utility_type':
      return utilityTypeLabel(ctx.utilityType, locale);
    default:
      return '';
  }
}

/**
 * Substitutes every known variable and reports the ones that could not be filled.
 *
 * `unresolved` collects two different problems, both of which should stop a send:
 * a token that is not in the registry (a typo — left in the text rather than
 * blanked, so the admin can see what they wrote), and a case-scoped token whose
 * value is missing because the customer has no matching case. A user-scoped
 * token that resolves to an empty string is *not* a problem: `{{lastName}}` on a
 * customer with no surname on file has always rendered empty and must keep doing so.
 */
export function renderTemplateText(
  text: string,
  ctx: TemplateRenderContext,
  locale: 'it' | 'en' = 'it',
): { text: string; unresolved: string[] } {
  if (!text || !text.includes('{{')) {
    return { text: text || '', unresolved: [] };
  }

  const unresolved = new Set<string>();

  const rendered = text.replace(
    anyPlaceholderPattern(),
    (match, key: string) => {
      if (!KNOWN_KEYS.has(key)) {
        unresolved.add(key);
        return match;
      }

      const value = resolveVariable(key as TemplateVariableKey, ctx, locale);

      if (!value && CASE_SCOPED_KEYS.has(key)) {
        unresolved.add(key);
      }

      return value;
    },
  );

  return { text: rendered, unresolved: [...unresolved] };
}

/**
 * Renders a template against its registry examples, for the authoring preview.
 *
 * Deliberately separate from `renderTemplateText`: the template editor has no
 * recipient to render against, and showing an admin a message with blanks where
 * the variables go teaches them nothing about whether the copy reads well.
 */
export function renderTemplateExample(
  text: string,
  locale: 'it' | 'en' = 'it',
): string {
  if (!text || !text.includes('{{')) return text || '';

  return text.replace(anyPlaceholderPattern(), (match, key: string) => {
    const variable = TEMPLATE_VARIABLES.find((v) => v.key === key);
    return variable ? variable.example[locale] : match;
  });
}
