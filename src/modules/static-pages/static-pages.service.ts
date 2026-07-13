import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaticPage } from './entities/static-page.entity';
import { CreateStaticPageDto } from './dto/create-static-page.dto';
import { UpdateStaticPageDto } from './dto/update-static-page.dto';
import { QueryStaticPagesDto } from './dto/query-static-pages.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

@Injectable()
export class StaticPagesService {
  constructor(
    @InjectRepository(StaticPage)
    private readonly staticPageRepository: Repository<StaticPage>,
  ) {}

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
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async createPage(dto: CreateStaticPageDto): Promise<StaticPage> {
    const existing = await this.staticPageRepository.findOne({
      where: { slug: dto.slug, locale: dto.locale || 'it' },
    });

    if (existing) {
      throw new BadRequestException(
        `A page with slug '${dto.slug}' already exists for locale '${dto.locale || 'it'}'`,
      );
    }

    const page = this.staticPageRepository.create(dto);
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

    Object.assign(page, dto);
    return this.staticPageRepository.save(page);
  }

  async deletePage(id: string): Promise<void> {
    const page = await this.staticPageRepository.findOne({ where: { id } });

    if (!page) {
      throw new NotFoundException('Static page not found');
    }

    await this.staticPageRepository.remove(page);
  }
}
