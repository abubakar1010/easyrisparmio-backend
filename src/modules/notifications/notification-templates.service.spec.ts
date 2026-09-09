import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationTemplatesService } from './notification-templates.service';
import { NotificationTemplateCategory } from '../../common/enums/notification-template.enum';
import { NotificationType } from '../../common/enums/notification.enum';
import { BillType } from '../../common/enums/bill.enum';

const template = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  name: 'Promo switch luce',
  description: null,
  category: NotificationTemplateCategory.PROMOTIONAL,
  title: 'Nuova offerta, {{firstName}}',
  body: 'Ciao {{name}}, passa a {{provider}}.',
  type: NotificationType.GENERAL,
  isActive: true,
  createdBy: null,
  updatedBy: null,
  ...over,
});

const fullContext = {
  context: {
    user: {
      id: 'u1',
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario@example.it',
    },
    provider: 'Illumia',
    offerName: 'Casa Luce Fissa 12',
    utilityType: BillType.ELECTRICITY,
    caseId: 'c1',
    caseNumber: 'SW-20260731-00001',
  },
  locale: 'it' as const,
};

describe('NotificationTemplatesService', () => {
  let repo: Record<string, jest.Mock>;
  let qb: Record<string, jest.Mock>;
  let buildRenderContext: jest.Mock;
  let service: NotificationTemplatesService;

  beforeEach(() => {
    qb = {
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      skip: jest.fn(() => qb),
      take: jest.fn(() => qb),
      getManyAndCount: jest.fn().mockResolvedValue([[template()], 1]),
    };

    repo = {
      createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
      softRemove: jest.fn(async (row: unknown) => row),
      find: jest.fn().mockResolvedValue([]),
    };

    buildRenderContext = jest.fn().mockResolvedValue(fullContext);

    service = new NotificationTemplatesService(repo as any, {
      buildRenderContext,
    } as any);
  });

  describe('listing', () => {
    it('returns a paginated response and derives each row’s variables', async () => {
      const result = await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
      } as any);

      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(result.data[0].variables).toEqual(['firstName', 'name', 'provider']);
    });

    it('searches the name and the title together', async () => {
      await service.findAll({ page: 1, limit: 20, skip: 0, search: 'luce' } as any);

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(template.name ILIKE :search OR template.title ILIKE :search)',
        { search: '%luce%' },
      );
    });

    it('filters by category and active status', async () => {
      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        category: NotificationTemplateCategory.CASE_UPDATE,
        isActive: false,
      } as any);

      expect(qb.andWhere).toHaveBeenCalledWith('template.category = :category', {
        category: NotificationTemplateCategory.CASE_UPDATE,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('template.isActive = :isActive', {
        isActive: false,
      });
    });
  });

  describe('create', () => {
    it('stamps the admin as creator and editor', async () => {
      await service.create(
        { name: 'Promo', title: 'Ciao {{name}}', body: 'Testo' } as any,
        'admin-1',
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: 'admin-1', updatedBy: 'admin-1' }),
      );
    });

    it('rejects a duplicate name', async () => {
      repo.findOne.mockResolvedValue(template());

      await expect(
        service.create({ name: 'Promo switch luce', title: 'T', body: 'B' } as any, 'a1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    /** A typo must not reach a customer's notification tray as literal braces. */
    it('rejects an unknown variable', async () => {
      await expect(
        service.create(
          { name: 'Promo', title: 'Ciao {{provder}}', body: 'Testo' } as any,
          'a1',
        ),
      ).rejects.toThrow(/provder/);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      repo.findOne.mockResolvedValue(template());
    });

    it('stamps the editor without touching the creator', async () => {
      const saved = await service.update('t1', { title: 'Nuovo' } as any, 'admin-2');

      expect(saved.updatedBy).toBe('admin-2');
      expect(saved.createdBy).toBeNull();
    });

    it('rejects an unknown variable introduced by the edit', async () => {
      await expect(
        service.update('t1', { body: 'Ciao {{nome}}' } as any, 'a1'),
      ).rejects.toThrow(/nome/);
    });

    it('throws when the template does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', {} as any, 'a1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    /**
     * Soft, not hard: sent notifications reference the template by id, and the
     * customer's history resolves that id back to a name.
     */
    it('soft-deletes so history keeps naming the template', async () => {
      repo.findOne.mockResolvedValue(template());

      await service.remove('t1');

      expect(repo.softRemove).toHaveBeenCalled();
    });
  });

  describe('variables', () => {
    it('localises the palette', () => {
      const it = service.getVariables('it');
      const en = service.getVariables('en');

      expect(it.find((v) => v.key === 'utility_type')?.example).toBe('Luce');
      expect(en.find((v) => v.key === 'utility_type')?.example).toBe('Electricity');
    });

    it('marks which variables need a case', () => {
      const byKey = Object.fromEntries(
        service.getVariables('it').map((v) => [v.key, v.scope]),
      );

      expect(byKey.name).toBe('user');
      expect(byKey.provider).toBe('case');
      expect(byKey.offer_name).toBe('case');
      expect(byKey.utility_type).toBe('case');
    });
  });

  describe('preview', () => {
    it('renders raw text without touching the template repository', async () => {
      const result = await service.preview({
        userId: 'u1',
        title: 'Ciao {{firstName}}',
        body: 'La tua pratica {{utility_type}} con {{provider}}.',
      } as any);

      expect(repo.findOne).not.toHaveBeenCalled();
      expect(result.title).toBe('Ciao Mario');
      expect(result.body).toBe('La tua pratica Luce con Illumia.');
      expect(result.unresolved).toEqual([]);
    });

    it('names the case the variables resolved against', async () => {
      const result = await service.preview({
        userId: 'u1',
        title: 'T',
        body: '{{provider}}',
      } as any);

      expect(result.context).toEqual({
        caseId: 'c1',
        caseNumber: 'SW-20260731-00001',
        provider: 'Illumia',
        offerName: 'Casa Luce Fissa 12',
        utilityType: BillType.ELECTRICITY,
      });
    });

    it('reports unresolved variables for a customer with no case', async () => {
      buildRenderContext.mockResolvedValue({
        context: { user: fullContext.context.user },
        locale: 'it',
      });

      const result = await service.preview({
        userId: 'u1',
        title: 'Ciao {{firstName}}',
        body: 'Passa a {{provider}} — {{offer_name}}.',
      } as any);

      expect(result.unresolved.sort()).toEqual(['offer_name', 'provider']);
      expect(result.context).toBeNull();
    });

    it('resolves the case context exactly once per preview', async () => {
      await service.preview({
        userId: 'u1',
        title: '{{provider}}',
        body: '{{offer_name}} {{utility_type}}',
      } as any);

      expect(buildRenderContext).toHaveBeenCalledTimes(1);
    });

    it('previews a saved template by id', async () => {
      repo.findOne.mockResolvedValue(template());

      const result = await service.preview({
        userId: 'u1',
        templateId: 't1',
      } as any);

      expect(result.title).toBe('Nuova offerta, Mario');
      expect(result.body).toBe('Ciao Mario Rossi, passa a Illumia.');
    });
  });
});
