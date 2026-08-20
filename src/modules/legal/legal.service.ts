import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { StaticPage } from '../static-pages/entities/static-page.entity';
import { UserLegalAcceptance } from './entities/user-legal-acceptance.entity';
import {
  AcceptLegalDocumentsDto,
  LegalAcceptanceItemDto,
} from './dto/accept-legal-documents.dto';
import { QueryLegalAcceptancesDto } from './dto/query-legal-acceptances.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../../common/enums/role.enum';
import {
  LegalAcceptanceSource,
  LegalAudience,
  LegalSlug,
} from '../../common/enums/legal.enum';
import { compareVersions, maxVersion } from '../../common/utils/version.util';

export const DEFAULT_LOCALE = 'it';

/** Where a user stands on one document. */
export type LegalDocumentState =
  | 'accepted'
  | 'never_accepted'
  | 'update_required';

export interface LegalDocumentStatus {
  slug: string;
  title: string;
  version: string;
  locale: string;
  audience: LegalAudience;
  requiresAcceptance: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  changeSummary: string | null;
  content?: string;
  acceptedVersion: string | null;
  acceptedAt: Date | null;
  state: LegalDocumentState;
  needsAcceptance: boolean;
}

export interface AcceptanceContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class LegalService {
  private readonly logger = new Logger(LegalService.name);

  constructor(
    @InjectRepository(StaticPage)
    private readonly staticPageRepository: Repository<StaticPage>,
    @InjectRepository(UserLegalAcceptance)
    private readonly acceptanceRepository: Repository<UserLegalAcceptance>,
  ) {}

  // ─── Reads ──────────────────────────────────────────────────

  /**
   * Every legal document that binds `role`, with where `userId` stands on each.
   *
   * The current version of a slug is the newest version across its active
   * locale rows, not the version of the row being rendered: a translation that
   * lags behind must not let a user sit on an outdated agreement.
   */
  async getDocumentStatuses(
    userId: string,
    role: UserRole,
    locale = DEFAULT_LOCALE,
    options: { includeContent?: boolean; onlyPending?: boolean } = {},
  ): Promise<LegalDocumentStatus[]> {
    // Admins work in the dashboard, where the mobile consent gate does not run.
    if (role === UserRole.ADMIN) return [];

    const audiences = this.audiencesFor(role);
    const pages = await this.staticPageRepository.find({
      where: { isActive: true, requiresAcceptance: true, audience: In(audiences) },
    });

    if (pages.length === 0) return [];

    const bySlug = new Map<string, StaticPage[]>();
    for (const page of pages) {
      const bucket = bySlug.get(page.slug);
      if (bucket) bucket.push(page);
      else bySlug.set(page.slug, [page]);
    }

    const acceptances = await this.acceptanceRepository.find({
      where: { userId, slug: In([...bySlug.keys()]) },
      order: { acceptedAt: 'ASC' },
    });

    // Latest accepted version per slug — a user can hold rows for 1.0 and 2.1.
    const latestAccepted = new Map<string, UserLegalAcceptance>();
    for (const acceptance of acceptances) {
      const best = latestAccepted.get(acceptance.slug);
      if (!best || compareVersions(acceptance.version, best.version) > 0) {
        latestAccepted.set(acceptance.slug, acceptance);
      }
    }

    const statuses: LegalDocumentStatus[] = [];

    for (const [slug, localeRows] of bySlug) {
      const currentVersion = maxVersion(localeRows.map((row) => row.version));
      const page = this.pickLocale(localeRows, locale);
      const accepted = latestAccepted.get(slug) ?? null;

      let state: LegalDocumentState;
      if (!accepted) state = 'never_accepted';
      else if (compareVersions(accepted.version, currentVersion) < 0)
        state = 'update_required';
      else state = 'accepted';

      const needsAcceptance = state !== 'accepted';
      if (options.onlyPending && !needsAcceptance) continue;

      statuses.push({
        slug,
        title: page.title,
        version: currentVersion,
        locale: page.locale,
        audience: page.audience,
        requiresAcceptance: page.requiresAcceptance,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
        changeSummary: page.changeSummary,
        ...(options.includeContent ? { content: page.content } : {}),
        acceptedVersion: accepted?.version ?? null,
        acceptedAt: accepted?.acceptedAt ?? null,
        state,
        needsAcceptance,
      });
    }

    return this.sortBySlugOrder(statuses);
  }

  /**
   * The consent gate the mobile app calls on launch. Content is included so the
   * prompt can render the document inline — a user asked to accept something
   * must be able to read it without a second round trip.
   */
  async getPendingDocuments(
    userId: string,
    role: UserRole,
    locale = DEFAULT_LOCALE,
  ): Promise<{
    requiresAction: boolean;
    documents: LegalDocumentStatus[];
  }> {
    const documents = await this.getDocumentStatuses(userId, role, locale, {
      includeContent: true,
      onlyPending: true,
    });

    return { requiresAction: documents.length > 0, documents };
  }

  async getUserHistory(userId: string): Promise<UserLegalAcceptance[]> {
    return this.acceptanceRepository.find({
      where: { userId },
      order: { acceptedAt: 'DESC' },
    });
  }

  // ─── Writes ─────────────────────────────────────────────────

  /**
   * Records the user's acceptance of the documents they were just shown.
   *
   * The submitted version has to match the current one. A client that has been
   * sitting on the screen since before a publish gets a 400 telling it to
   * reload, rather than silently logging consent to superseded text.
   */
  async acceptDocuments(
    userId: string,
    role: UserRole,
    dto: AcceptLegalDocumentsDto,
    context: AcceptanceContext = {},
  ): Promise<{
    accepted: Array<{ slug: string; version: string; acceptedAt: Date }>;
    requiresAction: boolean;
    documents: LegalDocumentStatus[];
  }> {
    const applicable = await this.getDocumentStatuses(userId, role);
    const bySlug = new Map(applicable.map((doc) => [doc.slug, doc]));

    const stale: string[] = [];
    const unknown: string[] = [];

    for (const item of dto.acceptances) {
      const doc = bySlug.get(item.slug);
      if (!doc) {
        unknown.push(item.slug);
      } else if (compareVersions(item.version, doc.version) !== 0) {
        stale.push(`${item.slug} (sent ${item.version}, current ${doc.version})`);
      }
    }

    if (unknown.length > 0) {
      throw new BadRequestException(
        `Not a legal document for this account: ${unknown.join(', ')}`,
      );
    }

    if (stale.length > 0) {
      throw new BadRequestException(
        `A newer version has been published, please reload: ${stale.join(', ')}`,
      );
    }

    const accepted = await this.persistAcceptances(
      userId,
      dto.acceptances,
      LegalAcceptanceSource.REACCEPTANCE,
      context,
    );

    // Recomputed rather than assumed: the user may have accepted only some of
    // the pending documents, and the app needs to know it still has to ask.
    const documents = await this.getDocumentStatuses(userId, role, DEFAULT_LOCALE, {
      onlyPending: true,
    });

    return { accepted, requiresAction: documents.length > 0, documents };
  }

  /**
   * Records consent captured outside the gate — the sign-up checkbox, the
   * social-login sheet, the business-upgrade form. Best-effort by design: a
   * missing document must never fail a registration, it just leaves the gate
   * to ask on first launch.
   */
  async recordAcceptanceFor(
    userId: string,
    role: UserRole,
    slugs: string[],
    source: LegalAcceptanceSource,
    locale = DEFAULT_LOCALE,
    context: AcceptanceContext = {},
  ): Promise<void> {
    try {
      const applicable = await this.getDocumentStatuses(userId, role, locale);
      const items: LegalAcceptanceItemDto[] = applicable
        .filter((doc) => slugs.includes(doc.slug))
        .map((doc) => ({
          slug: doc.slug,
          version: doc.version,
          locale: doc.locale,
        }));

      if (items.length === 0) return;
      await this.persistAcceptances(userId, items, source, context);
    } catch (error) {
      this.logger.warn(
        `Could not record ${source} consent for user ${userId}: ${
          (error as Error)?.message ?? error
        }`,
      );
    }
  }

  /** The slugs a freshly registered account of `role` is consenting to. */
  registrationSlugsFor(role: UserRole): string[] {
    const slugs: string[] = [
      LegalSlug.PRIVACY_POLICY,
      LegalSlug.TERMS_CONDITIONS,
    ];
    if (role === UserRole.BUSINESS) {
      slugs.push(LegalSlug.BUSINESS_TERMS_CONDITIONS);
    }
    return slugs;
  }

  // ─── Admin ──────────────────────────────────────────────────

  async getAdminAcceptances(
    query: QueryLegalAcceptancesDto,
  ): Promise<PaginatedResponseDto<UserLegalAcceptance>> {
    const qb = this.acceptanceRepository
      .createQueryBuilder('acceptance')
      .leftJoin('acceptance.user', 'user')
      .addSelect([
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.role',
      ]);

    if (query.slug) qb.andWhere('acceptance.slug = :slug', { slug: query.slug });
    if (query.version)
      qb.andWhere('acceptance.version = :version', { version: query.version });
    if (query.userId)
      qb.andWhere('acceptance.userId = :userId', { userId: query.userId });
    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('acceptance.acceptedAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  /**
   * How many users have accepted each of `slugs` at the given version. One
   * grouped query for the whole admin table rather than a count per row.
   */
  async countAcceptancesByVersion(
    pairs: Array<{ slug: string; version: string }>,
  ): Promise<Map<string, number>> {
    if (pairs.length === 0) return new Map();

    const rows = await this.acceptanceRepository
      .createQueryBuilder('acceptance')
      .select('acceptance.slug', 'slug')
      .addSelect('acceptance.version', 'version')
      .addSelect('COUNT(DISTINCT acceptance.userId)', 'count')
      .where('acceptance.slug IN (:...slugs)', {
        slugs: [...new Set(pairs.map((p) => p.slug))],
      })
      .groupBy('acceptance.slug')
      .addGroupBy('acceptance.version')
      .getRawMany<{ slug: string; version: string; count: string }>();

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(`${row.slug}@${row.version}`, Number(row.count));
    }
    return counts;
  }

  // ─── Internals ──────────────────────────────────────────────

  private audiencesFor(role: UserRole): LegalAudience[] {
    return role === UserRole.BUSINESS
      ? [LegalAudience.ALL, LegalAudience.BUSINESS]
      : [LegalAudience.ALL, LegalAudience.PERSONAL];
  }

  /** The requested locale if it exists and is active, else the Italian original. */
  private pickLocale(rows: StaticPage[], locale: string): StaticPage {
    return (
      rows.find((row) => row.locale === locale) ??
      rows.find((row) => row.locale === DEFAULT_LOCALE) ??
      rows[0]
    );
  }

  private sortBySlugOrder(
    statuses: LegalDocumentStatus[],
  ): LegalDocumentStatus[] {
    const order = [
      LegalSlug.PRIVACY_POLICY,
      LegalSlug.TERMS_CONDITIONS,
      LegalSlug.BUSINESS_TERMS_CONDITIONS,
    ] as string[];

    return statuses.sort((a, b) => {
      const ai = order.indexOf(a.slug);
      const bi = order.indexOf(b.slug);
      return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
    });
  }

  /**
   * Upsert rather than insert: re-tapping Accept, or a retried request after a
   * dropped response, must not blow up on the (user, slug, version) unique
   * index nor rewrite the original timestamp.
   */
  private async persistAcceptances(
    userId: string,
    items: LegalAcceptanceItemDto[],
    source: LegalAcceptanceSource,
    context: AcceptanceContext,
  ): Promise<Array<{ slug: string; version: string; acceptedAt: Date }>> {
    const acceptedAt = new Date();

    const rows = items.map((item) =>
      this.acceptanceRepository.create({
        userId,
        slug: item.slug,
        version: item.version,
        locale: item.locale || DEFAULT_LOCALE,
        acceptedAt,
        source,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent?.slice(0, 512) ?? null,
      }),
    );

    await this.acceptanceRepository
      .createQueryBuilder()
      .insert()
      .into(UserLegalAcceptance)
      .values(rows)
      .orIgnore()
      .execute();

    const stored = await this.acceptanceRepository.find({
      where: items.map((item) => ({
        userId,
        slug: item.slug,
        version: item.version,
      })),
    });

    return stored.map((row) => ({
      slug: row.slug,
      version: row.version,
      acceptedAt: row.acceptedAt,
    }));
  }
}
