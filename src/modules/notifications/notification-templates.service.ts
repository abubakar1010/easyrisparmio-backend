import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationsService } from './notifications.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { QueryNotificationTemplatesDto } from './dto/query-notification-templates.dto';
import { PreviewNotificationDto } from './dto/preview-notification.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
  TEMPLATE_VARIABLES,
  TemplateVariableDef,
  extractVariables,
  renderTemplateText,
  unknownVariables,
} from './notification-variables';

/** One variable as the dashboard's chip palette needs it, already localised. */
export interface TemplateVariableResponse {
  key: string;
  scope: TemplateVariableDef['scope'];
  label: string;
  description: string;
  example: string;
}

export interface NotificationPreview {
  title: string;
  body: string;
  /** Variables that could not be filled. Non-empty means the send is refused. */
  unresolved: string[];
  /** Which case the case-scoped variables resolved against, if any. */
  context: {
    caseId: string | null;
    caseNumber: string | null;
    provider: string | null;
    offerName: string | null;
    utilityType: string | null;
  } | null;
}

@Injectable()
export class NotificationTemplatesService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    query: QueryNotificationTemplatesDto,
  ): Promise<PaginatedResponseDto<NotificationTemplate>> {
    const qb = this.templateRepository.createQueryBuilder('template');

    if (query.category) {
      qb.andWhere('template.category = :category', { category: query.category });
    }

    if (query.type) {
      qb.andWhere('template.type = :type', { type: query.type });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('template.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.search) {
      // Both, because an admin looks for a template either by what they called
      // it or by the words they remember writing in the heading.
      qb.andWhere('(template.name ILIKE :search OR template.title ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('template.updatedAt', 'DESC');
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    this.attachVariables(data);

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findById(id: string): Promise<NotificationTemplate> {
    const template = await this.templateRepository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    this.attachVariables([template]);
    return template;
  }

  async create(
    dto: CreateNotificationTemplateDto,
    adminId: string,
  ): Promise<NotificationTemplate> {
    await this.assertNameIsFree(dto.name);
    this.assertVariablesAreKnown(dto.title, dto.body);

    const template = this.templateRepository.create({
      ...dto,
      createdBy: adminId,
      updatedBy: adminId,
    });

    const saved = await this.templateRepository.save(template);
    this.attachVariables([saved]);
    return saved;
  }

  async update(
    id: string,
    dto: UpdateNotificationTemplateDto,
    adminId: string,
  ): Promise<NotificationTemplate> {
    const template = await this.findById(id);

    if (dto.name && dto.name !== template.name) {
      await this.assertNameIsFree(dto.name, id);
    }

    this.assertVariablesAreKnown(
      dto.title ?? template.title,
      dto.body ?? template.body,
    );

    Object.assign(template, dto, { updatedBy: adminId });

    const saved = await this.templateRepository.save(template);
    this.attachVariables([saved]);
    return saved;
  }

  /**
   * Soft delete. History rows reference the template by id, and resolving that
   * id back to a name is what lets a customer's profile still say which template
   * a message came from years later.
   */
  async remove(id: string): Promise<void> {
    const template = await this.findById(id);
    await this.templateRepository.softRemove(template);
  }

  getVariables(locale: 'it' | 'en'): TemplateVariableResponse[] {
    return TEMPLATE_VARIABLES.map((variable) => ({
      key: variable.key,
      scope: variable.scope,
      label: variable.label[locale],
      description: variable.description[locale],
      example: variable.example[locale],
    }));
  }

  /**
   * Renders a message against a real customer without sending it.
   *
   * The whole point is that the dashboard does not need its own renderer: it
   * used to carry a second copy of the pattern and the fallback rules, and the
   * two only had to disagree once for an admin to approve a preview that did not
   * match what was delivered.
   */
  async preview(dto: PreviewNotificationDto): Promise<NotificationPreview> {
    const template = dto.templateId
      ? await this.findById(dto.templateId)
      : null;

    const title = template ? template.title : dto.title || '';
    const body = template ? template.body : dto.body || '';

    const { context, locale } = await this.notificationsService.buildRenderContext(
      dto.userId,
      dto.caseId,
    );

    const renderedTitle = renderTemplateText(title, context, locale);
    const renderedBody = renderTemplateText(body, context, locale);

    return {
      title: renderedTitle.text,
      body: renderedBody.text,
      unresolved: [
        ...new Set([...renderedTitle.unresolved, ...renderedBody.unresolved]),
      ],
      context: context.caseId
        ? {
            caseId: context.caseId,
            caseNumber: context.caseNumber ?? null,
            provider: context.provider ?? null,
            offerName: context.offerName ?? null,
            utilityType: (context.utilityType as string) ?? null,
          }
        : null,
    };
  }

  /**
   * Derived on read rather than stored, so the list can never show a variable
   * the text no longer contains.
   */
  private attachVariables(templates: NotificationTemplate[]): void {
    for (const template of templates) {
      template.variables = extractVariables(
        `${template.title} ${template.body}`,
      );
    }
  }

  private async assertNameIsFree(name: string, exceptId?: string): Promise<void> {
    const existing = await this.templateRepository.findOne({
      where: exceptId ? { name, id: Not(exceptId) } : { name },
    });

    if (existing) {
      throw new BadRequestException(
        `A notification template named '${name}' already exists`,
      );
    }
  }

  /**
   * Catches a mistyped variable while the admin is still writing, rather than
   * at send time — or worse, in the customer's notification tray.
   */
  private assertVariablesAreKnown(title: string, body: string): void {
    const unknown = [
      ...new Set([...unknownVariables(title), ...unknownVariables(body)]),
    ];

    if (unknown.length) {
      throw new BadRequestException(
        `Unknown variable(s): ${unknown
          .map((key) => `{{${key}}}`)
          .join(', ')}. See GET /notification-templates/variables.`,
      );
    }
  }
}
