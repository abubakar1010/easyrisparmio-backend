import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { StaticPage } from './entities/static-page.entity';
import { CreateStaticPageDto } from './dto/create-static-page.dto';
import { UpdateStaticPageDto } from './dto/update-static-page.dto';
import { QueryStaticPagesDto } from './dto/query-static-pages.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { LegalService } from '../legal/legal.service';
import {
  LegalAudience,
  LegalSlug,
  LEGAL_SLUGS,
} from '../../common/enums/legal.enum';
import { compareVersions, maxVersion } from '../../common/utils/version.util';

@Injectable()
export class StaticPagesService implements OnModuleInit {
  private readonly logger = new Logger(StaticPagesService.name);

  constructor(
    @InjectRepository(StaticPage)
    private readonly staticPageRepository: Repository<StaticPage>,
    private readonly legalService: LegalService,
  ) {}

  /**
   * Marks the three legal slugs as requiring acceptance on databases created
   * before consent tracking existed.
   *
   * Only rows that have never been published are touched (`published_at IS
   * NULL`), so this is idempotent and an admin who later turns acceptance off
   * for a page does not have it turned back on at the next boot.
   */
  async onModuleInit(): Promise<void> {
    try {
      const unpublished = await this.staticPageRepository.find({
        where: { slug: In(LEGAL_SLUGS as string[]), publishedAt: IsNull() },
      });

      if (unpublished.length === 0) return;

      for (const page of unpublished) {
        page.requiresAcceptance = true;
        page.audience =
          page.slug === LegalSlug.BUSINESS_TERMS_CONDITIONS
            ? LegalAudience.BUSINESS
            : LegalAudience.ALL;
        page.version = page.version || '1.0';
        page.publishedAt = page.createdAt ?? new Date();
      }

      await this.staticPageRepository.save(unpublished);
      this.logger.log(
        `Marked ${unpublished.length} legal page(s) as requiring acceptance`,
      );
    } catch (error) {
      // Never block boot on a backfill — a fresh database has no table yet.
      this.logger.warn(
        `Legal page backfill skipped: ${(error as Error)?.message ?? error}`,
      );
    }
  }

  async getPageBySlug(slug: string, locale?: string): Promise<StaticPage> {
    const requestedLocale = locale || 'it';

    let page = await this.staticPageRepository.findOne({
      where: { slug, locale: requestedLocale, isActive: true },
    });

    // Fall back to Italian if not found for the requested locale
    if (!page && requestedLocale !== 'it') {
      page = await this.staticPageRepository.findOne({
        where: { slug, locale: 'it', isActive: true },
      });
    }

    if (!page) {
      throw new NotFoundException(`Page '${slug}' not found`);
    }

    return page;
  }

  async getAdminPages(query: QueryStaticPagesDto): Promise<PaginatedResponseDto<StaticPage>> {
    const qb = this.staticPageRepository.createQueryBuilder('page');

    if (query.slug) {
      qb.andWhere('page.slug = :slug', { slug: query.slug });
    }

    if (query.locale) {
      qb.andWhere('page.locale = :locale', { locale: query.locale });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('page.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.search) {
      qb.andWhere('page.title ILIKE :search', { search: `%${query.search}%` });
    }

    qb.orderBy('page.slug', 'ASC').addOrderBy('page.locale', 'ASC');
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    await this.attachAcceptanceCounts(data);

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async createPage(dto: CreateStaticPageDto): Promise<StaticPage> {
    const locale = dto.locale || 'it';

    const existing = await this.staticPageRepository.findOne({
      where: { slug: dto.slug, locale },
    });

    if (existing) {
      throw new BadRequestException(
        `A page with slug '${dto.slug}' already exists for locale '${locale}'`,
      );
    }

    // A new translation of an existing legal document joins it at the version
    // already in force, otherwise publishing an English copy at 1.0 would drag
    // the document backwards and un-ask everyone who accepted 2.1.
    const siblings = await this.staticPageRepository.find({
      where: { slug: dto.slug },
    });

    const page = this.staticPageRepository.create({
      ...dto,
      locale,
      version:
        siblings.length > 0
          ? maxVersion(siblings.map((row) => row.version))
          : dto.version || '1.0',
      requiresAcceptance:
        dto.requiresAcceptance ??
        siblings[0]?.requiresAcceptance ??
        (LEGAL_SLUGS as string[]).includes(dto.slug),
      audience: dto.audience ?? siblings[0]?.audience ?? this.defaultAudience(dto.slug),
    });

    if (page.requiresAcceptance) {
      page.publishedAt = siblings[0]?.publishedAt ?? new Date();
    }

    return this.staticPageRepository.save(page);
  }

  async updatePage(id: string, dto: UpdateStaticPageDto): Promise<StaticPage> {
    const page = await this.staticPageRepository.findOne({ where: { id } });

    if (!page) {
      throw new NotFoundException('Static page not found');
    }

    // Check uniqueness if slug or locale is being changed
    if (dto.slug || dto.locale) {
      const newSlug = dto.slug || page.slug;
      const newLocale = dto.locale || page.locale;

      if (newSlug !== page.slug || newLocale !== page.locale) {
        const existing = await this.staticPageRepository.findOne({
          where: { slug: newSlug, locale: newLocale },
        });

        if (existing && existing.id !== id) {
          throw new BadRequestException(
            `A page with slug '${newSlug}' already exists for locale '${newLocale}'`,
          );
        }
      }
    }

    const previousVersion = page.version;
    const versionChanged =
      dto.version !== undefined && compareVersions(dto.version, previousVersion) !== 0;

    if (versionChanged && compareVersions(dto.version!, previousVersion) < 0) {
      throw new BadRequestException(
        `Version cannot go backwards: '${previousVersion}' is already published`,
      );
    }

    Object.assign(page, dto);

    if (versionChanged) {
      page.publishedAt = new Date();
    }

    const saved = await this.staticPageRepository.save(page);

    // A legal document has one version, not one per translation. Bumping it on
    // any locale carries the new version, publication date and change summary
    // across every translation of the same slug, so the re-acceptance prompt
    // fires once for everyone rather than only for Italian readers.
    if (versionChanged && saved.requiresAcceptance) {
      await this.staticPageRepository
        .createQueryBuilder()
        .update(StaticPage)
        .set({
          version: saved.version,
          publishedAt: saved.publishedAt,
          ...(dto.changeSummary !== undefined
            ? { changeSummary: saved.changeSummary }
            : {}),
        })
        .where('slug = :slug AND id != :id', { slug: saved.slug, id: saved.id })
        .execute();

      this.logger.log(
        `Published ${saved.slug} v${saved.version} (was v${previousVersion}) — users will be asked to accept again`,
      );
    }

    return saved;
  }

  async deletePage(id: string): Promise<void> {
    const page = await this.staticPageRepository.findOne({ where: { id } });

    if (!page) {
      throw new NotFoundException('Static page not found');
    }

    await this.staticPageRepository.remove(page);
  }

  // ─── Internals ──────────────────────────────────────────────

  private defaultAudience(slug: string): LegalAudience {
    return slug === LegalSlug.BUSINESS_TERMS_CONDITIONS
      ? LegalAudience.BUSINESS
      : LegalAudience.ALL;
  }

  /** Fills `acceptedCount` so the admin table can show consent uptake per version. */
  private async attachAcceptanceCounts(pages: StaticPage[]): Promise<void> {
    const legal = pages.filter((page) => page.requiresAcceptance);
    if (legal.length === 0) return;

    const counts = await this.legalService.countAcceptancesByVersion(
      legal.map((page) => ({ slug: page.slug, version: page.version })),
    );

    for (const page of legal) {
      page.acceptedCount = counts.get(`${page.slug}@${page.version}`) ?? 0;
    }
  }
}
