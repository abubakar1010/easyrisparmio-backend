import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { DeepLinkService } from './deep-link.service';
import { resolveLocale } from '../../common/middleware/locale.middleware';

@ApiExcludeController()
@Controller()
export class DeepLinkController {
  constructor(private readonly deepLinkService: DeepLinkService) {}

  @Get('.well-known/assetlinks.json')
  getAssetLinks(@Res() res: Response) {
    const data = this.deepLinkService.getAssetLinks();
    res
      .setHeader('Content-Type', 'application/json')
      .setHeader('Cache-Control', 'public, max-age=86400')
      .json(data);
  }

  @Get('.well-known/apple-app-site-association')
  getAppleAppSiteAssociation(@Res() res: Response) {
    const data = this.deepLinkService.getAppleAppSiteAssociation();
    res
      .setHeader('Content-Type', 'application/json')
      .setHeader('Cache-Control', 'public, max-age=86400')
      .json(data);
  }

  @Get('r/:code')
  async getReferralLandingPage(
    @Param('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userAgent = req.headers['user-agent'] || '';
    // Resolved here rather than read from `req.locale`: this route sits outside
    // the global prefix, and the page must still default to Italian.
    const html = await this.deepLinkService.buildLandingPageHtml(
      code,
      userAgent,
      resolveLocale(req.headers['accept-language']),
    );
    res
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Vary', 'Accept-Language, User-Agent')
      .setHeader(
        'Content-Security-Policy',
        "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      )
      .send(html);
  }
}
