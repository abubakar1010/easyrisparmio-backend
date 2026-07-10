import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const SUPPORTED_LOCALES = ['it', 'en'];
const DEFAULT_LOCALE = 'it';

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const acceptLanguage = req.headers['accept-language'];
    let locale = DEFAULT_LOCALE;

    if (acceptLanguage) {
      const preferred = acceptLanguage.split(',')[0].trim().substring(0, 2).toLowerCase();
      if (SUPPORTED_LOCALES.includes(preferred)) {
        locale = preferred;
      }
    }

    (req as any).locale = locale;
    next();
  }
}
