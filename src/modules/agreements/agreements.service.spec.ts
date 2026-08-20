import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { AgreementsService } from './agreements.service';
import { Agreement } from './entities/agreement.entity';
import { CreateAgreementDto } from './dto/create-agreement.dto';

/**
 * An agreement is only shown to a user when `validFrom <= today <= validUntil`,
 * so an inverted window saves cleanly and then silently never appears. These
 * tests pin the rejection — including the case that motivated it, a PATCH that
 * moves one end of the window past the other end already stored.
 */

const ADMIN_ID = 'admin-1';

class FakeAgreementRepository {
  rows: Agreement[] = [];
  private seq = 0;

  create(data: Partial<Agreement>): Agreement {
    return { ...data } as Agreement;
  }

  save(entity: Agreement): Promise<Agreement> {
    if (!entity.id) {
      this.seq += 1;
      entity.id = `agreement-${this.seq}`;
      this.rows.push(entity);
    }
    return Promise.resolve(entity);
  }

  findOne({ where }: { where: { id: string } }): Promise<Agreement | null> {
    return Promise.resolve(this.rows.find((r) => r.id === where.id) ?? null);
  }
}

const baseDto = (overrides: Partial<CreateAgreementDto> = {}): CreateAgreementDto =>
  ({
    title: 'Sconto Test',
    partnerName: 'Partner Test',
    validFrom: '2026-01-01',
    ...overrides,
  }) as CreateAgreementDto;

describe('AgreementsService validity window', () => {
  let repo: FakeAgreementRepository;
  let service: AgreementsService;

  beforeEach(() => {
    repo = new FakeAgreementRepository();
    service = new AgreementsService(
      repo as unknown as Repository<Agreement>,
    );
  });

  describe('create', () => {
    it('rejects an end date before the start date', async () => {
      await expect(
        service.create(
          baseDto({ validFrom: '2026-06-01', validUntil: '2026-05-31' }),
          ADMIN_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repo.rows).toHaveLength(0);
    });

    it('accepts an end date equal to the start date', async () => {
      const created = await service.create(
        baseDto({ validFrom: '2026-06-01', validUntil: '2026-06-01' }),
        ADMIN_ID,
      );

      expect(created.id).toBeDefined();
      expect(created.createdBy).toBe(ADMIN_ID);
    });

    it('accepts an open-ended window', async () => {
      const created = await service.create(
        baseDto({ validFrom: '2026-06-01' }),
        ADMIN_ID,
      );

      expect(created.id).toBeDefined();
    });
  });

  describe('update', () => {
    let id: string;

    beforeEach(async () => {
      const created = await service.create(
        baseDto({ validFrom: '2026-01-01', validUntil: '2026-12-31' }),
        ADMIN_ID,
      );
      id = created.id;
    });

    it('rejects a start date moved past the stored end date', async () => {
      await expect(
        service.update(id, { validFrom: '2027-01-01' }, ADMIN_ID),
      ).rejects.toBeInstanceOf(BadRequestException);

      const stored = await service.findById(id);
      expect(stored.validFrom).toBe('2026-01-01');
    });

    it('rejects an end date moved before the stored start date', async () => {
      await expect(
        service.update(id, { validUntil: '2025-12-31' }, ADMIN_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts both ends moved together', async () => {
      const updated = await service.update(
        id,
        { validFrom: '2027-01-01', validUntil: '2027-12-31' },
        ADMIN_ID,
      );

      expect(updated.validFrom).toBe('2027-01-01');
      expect(updated.validUntil).toBe('2027-12-31');
      expect(updated.updatedBy).toBe(ADMIN_ID);
    });

    it('accepts clearing the end date', async () => {
      const updated = await service.update(id, { validUntil: null }, ADMIN_ID);

      expect(updated.validUntil).toBeNull();
    });

    it('leaves the window alone when the patch does not touch it', async () => {
      const updated = await service.update(
        id,
        { discountCode: 'EASYBIZCAR' },
        ADMIN_ID,
      );

      expect(updated.discountCode).toBe('EASYBIZCAR');
      expect(updated.validFrom).toBe('2026-01-01');
    });
  });
});
