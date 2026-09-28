import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SupplierStatus } from '../../common/enums/supplier.enum';

describe('SuppliersService — supplier FAQs', () => {
  const makeService = (supplier: { id: string; status: SupplierStatus } | null) => {
    const supplierRepo = {
      findOne: jest.fn().mockResolvedValue(supplier),
      exists: jest.fn().mockResolvedValue(!!supplier),
    };
    const faqRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'f1', supplierId: 's1', question: 'Q', answer: 'A' }),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ id: 'f1', ...v })),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SuppliersService(supplierRepo as any, faqRepo as any, {} as any, {} as any);
    return { service, faqRepo };
  };

  const active = { id: 's1', status: SupplierStatus.ACTIVE };
  const pending = { id: 's1', status: SupplierStatus.PENDING_DELETION };

  it('creates a FAQ on an active supplier', async () => {
    const { service, faqRepo } = makeService(active);
    const faq = await service.createFaq('s1', { question: 'Q', answer: 'A' });
    expect(faq).toMatchObject({ supplierId: 's1', question: 'Q' });
    expect(faqRepo.save).toHaveBeenCalled();
  });

  it('rejects FAQ writes while the supplier is pending deletion', async () => {
    const { service, faqRepo } = makeService(pending);
    await expect(service.createFaq('s1', { question: 'Q', answer: 'A' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateFaq('s1', 'f1', { answer: 'B' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.deleteFaq('s1', 'f1')).rejects.toBeInstanceOf(BadRequestException);
    expect(faqRepo.save).not.toHaveBeenCalled();
    expect(faqRepo.remove).not.toHaveBeenCalled();
  });

  it('still lists the FAQs of a supplier pending deletion', async () => {
    const { service } = makeService(pending);
    await expect(service.findFaqs('s1')).resolves.toEqual([]);
  });

  it('reports a missing supplier as not found', async () => {
    const { service } = makeService(null);
    await expect(service.createFaq('s1', { question: 'Q', answer: 'A' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not find a FAQ through another supplier', async () => {
    const { service, faqRepo } = makeService(active);
    faqRepo.findOne.mockResolvedValue(null);
    await expect(service.updateFaq('s1', 'other', { answer: 'B' })).rejects.toBeInstanceOf(NotFoundException);
    expect(faqRepo.findOne).toHaveBeenCalledWith({ where: { id: 'other', supplierId: 's1' } });
  });
});
