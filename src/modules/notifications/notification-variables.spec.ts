import { BillType } from '../../common/enums/bill.enum';
import {
  TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_KEYS,
  TemplateRenderContext,
  extractVariables,
  knownPlaceholderPattern,
  renderTemplateExample,
  renderTemplateText,
  unknownVariables,
  usesCaseScopedVariables,
} from './notification-variables';

const user = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'mario@example.it',
  ...over,
});

const ctx = (over: Partial<TemplateRenderContext> = {}): TemplateRenderContext => ({
  user: user(),
  provider: 'Illumia',
  offerName: 'Casa Luce Fissa 12',
  utilityType: BillType.ELECTRICITY,
  caseId: 'c1',
  caseNumber: 'SW-20260731-00001',
  ...over,
});

describe('notification variables — registry', () => {
  it('exposes a key for every declared variable', () => {
    expect(TEMPLATE_VARIABLE_KEYS).toHaveLength(TEMPLATE_VARIABLES.length);
    expect(new Set(TEMPLATE_VARIABLE_KEYS).size).toBe(
      TEMPLATE_VARIABLE_KEYS.length,
    );
  });

  /**
   * The regex is built from the registry, so this can only fail if someone
   * reintroduces a hand-written pattern. That is the drift this file exists to
   * prevent, so it is worth an explicit test rather than a comment.
   */
  it('matches every registry key with the derived pattern', () => {
    for (const key of TEMPLATE_VARIABLE_KEYS) {
      expect(knownPlaceholderPattern().test(`{{${key}}}`)).toBe(true);
    }
  });

  it('gives every variable a label, description and example in both languages', () => {
    for (const variable of TEMPLATE_VARIABLES) {
      for (const locale of ['it', 'en'] as const) {
        expect(variable.label[locale]).toBeTruthy();
        expect(variable.description[locale]).toBeTruthy();
        expect(variable.example[locale]).toBeTruthy();
      }
    }
  });
});

describe('notification variables — extraction', () => {
  it('lists each distinct token once, in first-seen order', () => {
    expect(
      extractVariables('{{name}} — {{provider}} — {{name}}'),
    ).toEqual(['name', 'provider']);
  });

  it('tolerates whitespace inside the braces', () => {
    expect(extractVariables('{{  firstName  }}')).toEqual(['firstName']);
  });

  it('returns nothing for text with no placeholders', () => {
    expect(extractVariables('Nessun segnaposto qui.')).toEqual([]);
  });

  it('reports only the tokens the registry does not know', () => {
    expect(unknownVariables('{{name}} {{foo}} {{provider}}')).toEqual(['foo']);
  });

  it('detects whether a case has to be loaded to render the text', () => {
    expect(usesCaseScopedVariables('Ciao {{name}}')).toBe(false);
    expect(usesCaseScopedVariables('Ciao {{name}}, {{provider}}')).toBe(true);
  });

  /** A shared /g RegExp would carry `lastIndex` and skip matches on the second call. */
  it('gives identical results when called twice', () => {
    const text = '{{name}} {{provider}} {{offer_name}}';
    expect(extractVariables(text)).toEqual(extractVariables(text));
    expect(renderTemplateText(text, ctx())).toEqual(
      renderTemplateText(text, ctx()),
    );
  });
});

/**
 * These four tokens shipped before templates existed and are already asserted in
 * notifications-dedupe.service.spec.ts. Repeating them here locks the behaviour
 * to this file now that the substitution has moved into it.
 */
describe('notification variables — user scope (unchanged behaviour)', () => {
  it('renders the full name, first name, last name and email', () => {
    const { text, unresolved } = renderTemplateText(
      '{{name}} / {{firstName}} / {{lastName}} / {{email}}',
      ctx(),
    );

    expect(text).toBe('Mario Rossi / Mario / Rossi / mario@example.it');
    expect(unresolved).toEqual([]);
  });

  it('treats {{surname}} as an alias of {{lastName}}', () => {
    expect(renderTemplateText('{{surname}}', ctx()).text).toBe('Rossi');
  });

  it('falls back to the email rather than leaving a hole in the sentence', () => {
    const context = ctx({ user: user({ firstName: null, lastName: null }) });

    expect(renderTemplateText('Ciao {{name}}!', context).text).toBe(
      'Ciao mario@example.it!',
    );
    expect(renderTemplateText('Ciao {{firstName}}!', context).text).toBe(
      'Ciao mario@example.it!',
    );
  });

  it('renders an empty last name without reporting it as unresolved', () => {
    const { text, unresolved } = renderTemplateText(
      'Sig. {{lastName}}',
      ctx({ user: user({ lastName: null }) }),
    );

    expect(text).toBe('Sig. ');
    expect(unresolved).toEqual([]);
  });
});

describe('notification variables — case scope', () => {
  it('renders the provider, offer name and utility type', () => {
    const { text, unresolved } = renderTemplateText(
      'La tua pratica {{utility_type}} con {{provider}} — {{offer_name}}',
      ctx(),
    );

    expect(text).toBe(
      'La tua pratica Luce con Illumia — Casa Luce Fissa 12',
    );
    expect(unresolved).toEqual([]);
  });

  it('localises the utility type instead of printing the raw enum', () => {
    expect(renderTemplateText('{{utility_type}}', ctx(), 'it').text).toBe('Luce');
    expect(renderTemplateText('{{utility_type}}', ctx(), 'en').text).toBe(
      'Electricity',
    );
    expect(
      renderTemplateText('{{utility_type}}', ctx({ utilityType: BillType.GAS }))
        .text,
    ).toBe('Gas');
  });

  it('reports a case variable with no value as unresolved', () => {
    const { unresolved } = renderTemplateText(
      'Passa a {{provider}} con {{offer_name}}',
      ctx({ provider: null, offerName: null }),
    );

    expect(unresolved.sort()).toEqual(['offer_name', 'provider']);
  });

  it('reports every case variable as unresolved when there is no case at all', () => {
    const { unresolved } = renderTemplateText(
      '{{provider}} {{offer_name}} {{utility_type}}',
      { user: user() },
    );

    expect(unresolved.sort()).toEqual([
      'offer_name',
      'provider',
      'utility_type',
    ]);
  });
});

describe('notification variables — unknown tokens', () => {
  /**
   * Left in the text rather than blanked: the admin needs to see what they
   * actually typed, and the send is refused anyway.
   */
  it('leaves an unknown token untouched and reports it', () => {
    const { text, unresolved } = renderTemplateText(
      'Ciao {{name}}, {{foo}}',
      ctx(),
    );

    expect(text).toBe('Ciao Mario Rossi, {{foo}}');
    expect(unresolved).toEqual(['foo']);
  });

  it('leaves text with no placeholders exactly as written', () => {
    const { text, unresolved } = renderTemplateText('Nessun segnaposto.', ctx());

    expect(text).toBe('Nessun segnaposto.');
    expect(unresolved).toEqual([]);
  });
});

describe('notification variables — authoring preview', () => {
  it('substitutes the registry examples', () => {
    expect(
      renderTemplateExample('Ciao {{name}}, passa a {{provider}}', 'it'),
    ).toBe('Ciao Mario Rossi, passa a Illumia');
  });

  it('leaves an unknown token visible so the typo is obvious', () => {
    expect(renderTemplateExample('{{foo}}')).toBe('{{foo}}');
  });
});
