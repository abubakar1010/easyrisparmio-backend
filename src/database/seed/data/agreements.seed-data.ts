import { DataSource } from 'typeorm';
import { Agreement } from '../../../modules/agreements/entities/agreement.entity';
import { UserTarget } from '../../../common/enums/offer.enum';
import { SeedContext } from '../seed-context';

export async function seedAgreements(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Agreement);
  const admin = ctx.users.admin;

  const agreementsData = [
    {
      title: 'Sconto Assicurazione Casa',
      description:
        'Convenzione esclusiva con UnipolSai per i clienti EasyRisparmio. Sconto del 15% su polizza casa e famiglia.',
      partnerName: 'UnipolSai',
      partnerLogoUrl: 'https://example.com/logos/unipolsai.png',
      discountDescription: '15% di sconto sulla polizza casa e famiglia',
      termsUrl: 'https://example.com/terms/unipolsai',
      isActive: true,
      targetAudience: UserTarget.PERSONAL,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      sortOrder: 1,
      createdBy: admin.id,
    },
    {
      title: 'Convenzione Ufficio Energia',
      description:
        'Accordo con TIM Business per tariffe agevolate su connettività e telefonia per le aziende clienti.',
      partnerName: 'TIM Business',
      partnerLogoUrl: 'https://example.com/logos/tim.png',
      discountDescription:
        'Tariffe agevolate su fibra e telefonia mobile business',
      termsUrl: 'https://example.com/terms/tim',
      isActive: true,
      targetAudience: UserTarget.BUSINESS,
      validFrom: new Date('2026-03-01'),
      sortOrder: 2,
      createdBy: admin.id,
    },
  ];

  for (const data of agreementsData) {
    const existing = await repo.findOne({
      where: { title: data.title },
      withDeleted: true,
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  Created agreement: ${data.title}`);
    } else {
      console.log(`  Agreement already exists: ${data.title}`);
    }
  }
}
