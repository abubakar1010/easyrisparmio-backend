import { LocaleMiddleware, resolveLocale } from './locale.middleware';

describe('resolveLocale', () => {
  it('defaults to Italian without a header', () => {
    expect(resolveLocale(undefined)).toBe('it');
    expect(resolveLocale('')).toBe('it');
  });

  it('uses English only when the client asks for it first', () => {
    expect(resolveLocale('en-GB,en;q=0.9')).toBe('en');
    expect(resolveLocale('it-IT,en;q=0.8')).toBe('it');
  });

  it('falls back to Italian for unsupported languages', () => {
    expect(resolveLocale('de-DE,de;q=0.9')).toBe('it');
  });

  it('reads the first value of a repeated header', () => {
    expect(resolveLocale(['en-US', 'it-IT'])).toBe('en');
  });
});

describe('LocaleMiddleware', () => {
  it('stores the resolved locale on the request', () => {
    const req: any = { headers: {} };
    const next = jest.fn();
    new LocaleMiddleware().use(req, {} as any, next);
    expect(req.locale).toBe('it');
    expect(next).toHaveBeenCalled();
  });
});
