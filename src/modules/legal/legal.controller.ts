import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { LegalService } from './legal.service';
import { AcceptLegalDocumentsDto } from './dto/accept-legal-documents.dto';
import { QueryLegalAcceptancesDto } from './dto/query-legal-acceptances.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

const DOCUMENT_EXAMPLE = {
  slug: 'terms-conditions',
  title: 'Termini e Condizioni',
  version: '2.1',
  locale: 'it',
  audience: 'all',
  requiresAcceptance: true,
  publishedAt: '2026-08-20T09:00:00.000Z',
  updatedAt: '2026-08-20T09:00:00.000Z',
  changeSummary: 'Aggiornata la sezione sui tempi di recesso.',
  acceptedVersion: '2.0',
  acceptedAt: '2026-03-02T11:24:00.000Z',
  state: 'update_required',
  needsAcceptance: true,
};

const ERROR_401 = {
  success: false,
  statusCode: 401,
  message: ['Unauthorized'],
  timestamp: '2026-08-20T12:00:00.000Z',
};

const ERROR_403 = {
  success: false,
  statusCode: 403,
  message: ['Forbidden resource'],
  timestamp: '2026-08-20T12:00:00.000Z',
};

/**
 * Consent tracking for the legal documents held in `static_pages`.
 *
 * Kept off the static-pages controller on purpose: that one ends in a
 * `GET :slug` catch-all, which would swallow `/legal/pending` before it ever
 * reached a handler.
 */
@ApiTags('Legal')
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('documents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Legal documents that apply to the current account',
    description:
      'Returns every document the account is bound by — privacy policy, terms, ' +
      'and business terms for business accounts — with the version currently ' +
      'published, the version this user accepted, and when. Content is omitted; ' +
      'fetch it from `GET /static-pages/:slug`.',
  })
  @ApiQuery({
    name: 'locale',
    required: false,
    description: 'Language to return titles in (defaults to the Accept-Language locale)',
    example: 'it',
  })
  @ApiOkResponse({
    description: 'Per-document acceptance status',
    content: {
      'application/json': {
        example: { success: true, data: { documents: [DOCUMENT_EXAMPLE] } },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  async getDocuments(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Query('locale') locale?: string,
  ) {
    const documents = await this.legalService.getDocumentStatuses(
      user.id,
      user.role,
      locale || this.localeOf(req),
    );
    return { documents };
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Documents the user still has to accept',
    description:
      'The consent gate the app calls on launch. Returns only documents never ' +
      'accepted or accepted at an older version, each with its full HTML so the ' +
      'prompt can be read and accepted without a second request. ' +
      '`requiresAction: false` means the app can proceed straight to the home screen.',
  })
  @ApiQuery({ name: 'locale', required: false, example: 'it' })
  @ApiOkResponse({
    description: 'Pending documents, newest published version of each',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            requiresAction: true,
            documents: [
              {
                ...DOCUMENT_EXAMPLE,
                content: '<h2>Termini e Condizioni</h2><p>…</p>',
              },
            ],
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  getPending(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Query('locale') locale?: string,
  ) {
    return this.legalService.getPendingDocuments(
      user.id,
      user.role,
      locale || this.localeOf(req),
    );
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record acceptance of one or more documents',
    description:
      'The client echoes back the version it displayed. Sending anything other ' +
      'than the currently published version is rejected, so a screen left open ' +
      'across a publish cannot record consent to text the user never saw. ' +
      'Re-sending an acceptance already on file is a no-op, not an error.',
  })
  @ApiBody({ type: AcceptLegalDocumentsDto })
  @ApiOkResponse({
    description: 'Acceptance recorded; any documents still outstanding are returned',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            accepted: [
              {
                slug: 'terms-conditions',
                version: '2.1',
                acceptedAt: '2026-08-20T12:00:00.000Z',
              },
            ],
            requiresAction: false,
            documents: [],
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Stale version, or a slug that does not apply to this account',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: [
            'A newer version has been published, please reload: terms-conditions (sent 2.0, current 2.1)',
          ],
          timestamp: '2026-08-20T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  accept(
    @CurrentUser() user: User,
    @Body() dto: AcceptLegalDocumentsDto,
    @Req() req: Request,
  ) {
    return this.legalService.acceptDocuments(user.id, user.role, dto, {
      ipAddress: this.ipOf(req),
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "The current user's consent history",
    description:
      'Every acceptance this account has recorded, newest first. Backs the ' +
      'GDPR right to see what was agreed to and when.',
  })
  @ApiOkResponse({
    description: 'Acceptance ledger for the current user',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            history: [
              {
                id: 'la1a2b3c-d4e5-6789-abcd-ef0123456789',
                slug: 'terms-conditions',
                version: '2.1',
                locale: 'it',
                acceptedAt: '2026-08-20T12:00:00.000Z',
                source: 'reacceptance',
              },
            ],
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  async getHistory(@CurrentUser() user: User) {
    return { history: await this.legalService.getUserHistory(user.id) };
  }

  @Get('admin/acceptances')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consent audit log (admin)',
    description:
      'Paginated list of who accepted which document version and when, ' +
      'filterable by slug, version and user.',
  })
  @ApiOkResponse({
    description: 'Paginated acceptance records',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'la1a2b3c-d4e5-6789-abcd-ef0123456789',
                slug: 'terms-conditions',
                version: '2.1',
                locale: 'it',
                acceptedAt: '2026-08-20T12:00:00.000Z',
                source: 'reacceptance',
                user: {
                  id: 'u1a2b3c4-d5e6-7890-abcd-ef1234567890',
                  email: 'mario.rossi@email.com',
                  firstName: 'Mario',
                  lastName: 'Rossi',
                  role: 'personal',
                },
              },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  getAdminAcceptances(@Query() query: QueryLegalAcceptancesDto) {
    return this.legalService.getAdminAcceptances(query);
  }

  // ─── Helpers ────────────────────────────────────────────────

  private localeOf(req: Request): string {
    return (req as Request & { locale?: string }).locale || 'it';
  }

  private ipOf(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = raw?.split(',')[0].trim() || req.ip || null;
    return ip ? ip.slice(0, 64) : null;
  }
}
