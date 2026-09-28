import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export type Locale = 'it' | 'en';

const SUPPORTED_LOCALES: Locale[] = ['it', 'en'];

/** Italian first: every response is Italian unless the client explicitly asks for English. */
export const DEFAULT_LOCALE: Locale = 'it';

/** The locale for an `Accept-Language` header, falling back to Italian. */
export function resolveLocale(acceptLanguage: string | string[] | undefined): Locale {
  const header = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
  if (!header) return DEFAULT_LOCALE;
  const preferred = header.split(',')[0].trim().substring(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.find((locale) => locale === preferred) ?? DEFAULT_LOCALE;
}

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    (req as any).locale = resolveLocale(req.headers['accept-language']);
    next();
  }
}
