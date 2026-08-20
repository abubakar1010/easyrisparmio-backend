import { BadRequestException } from '@nestjs/common';
import { LegalService } from './legal.service';
import { StaticPage } from '../static-pages/entities/static-page.entity';
import { UserLegalAcceptance } from './entities/user-legal-acceptance.entity';
import { UserRole } from '../../common/enums/role.enum';
import {
  LegalAcceptanceSource,
  LegalAudience,
  LegalSlug,
} from '../../common/enums/legal.enum';
import { compareVersions, maxVersion } from '../../common/utils/version.util';

const USER_ID = 'user-1';

function makePage(overrides: Partial<StaticPage> = {}): StaticPage {
  return {
    id: `page-${overrides.slug}-${overrides.locale ?? 'it'}`,
    slug: LegalSlug.TERMS_CONDITIONS,
    title: 'Termini e Condizioni',
    content: '<p>terms</p>',
    locale: 'it',
    isActive: true,
    version: '1.0',
    requiresAcceptance: true,
    audience: LegalAudience.ALL,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    changeSummary: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as StaticPage;
}

function makeAcceptance(
  overrides: Partial<UserLegalAcceptance> = {},
): UserLegalAcceptance {
  return {
    id: `acceptance-${overrides.slug}-${overrides.version}`,
    userId: USER_ID,
    slug: LegalSlug.TERMS_CONDITIONS,
    version: '1.0',
    locale: 'it',
    acceptedAt: new Date('2026-01-02T00:00:00Z'),
    source: LegalAcceptanceSource.REGISTRATION,
    ipAddress: null,
    userAgent: null,
    createdAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  } as UserLegalAcceptance;
}

/**
 * Stands in for the two repositories. `find` ignores the where clause for
 * acceptances — every test scopes its own fixture list — but honours the
 * audience filter for pages, which is the branch the personal/business split
 * turns on.
 */
function makeService(pages: StaticPage[], acceptances: UserLegalAcceptance[]) {
  const inserted: UserLegalAcceptance[] = [];

  const pageRepository = {
    find: jest.fn(async ({ where }: any) => {
      const audiences: LegalAudience[] = where?.audience?._value ?? [];
      return pages.filter(
        (page) =>
          page.isActive &&
          page.requiresAcceptance &&
          (audiences.length === 0 || audiences.includes(page.audience)),
      );
    }),
  };

  const acceptanceRepository = {
    find: jest.fn(async () => [...acceptances, ...inserted]),
    create: jest.fn((data: Partial<UserLegalAcceptance>) => ({ ...data })),
    createQueryBuilder: jest.fn(() => ({
      insert: () => ({
        into: () => ({
          values: (rows: UserLegalAcceptance[]) => ({
            orIgnore: () => ({
              execute: async () => {
                for (const row of rows) {
                  const clash = [...acceptances, ...inserted].some(
                    (existing) =>
                      existing.userId === row.userId &&
                      existing.slug === row.slug &&
                      existing.version === row.version,
                  );
                  if (!clash) inserted.push(row);
                }
              },
            }),
          }),
        }),
      }),
    })),
  };

  const service = new LegalService(
    pageRepository as any,
    acceptanceRepository as any,
  );

  return { service, inserted };
}

describe('compareVersions', () => {
  it('orders by numeric segment, not lexicographically', () => {
    // The whole point: as strings "2.10" < "2.9", which would stop the gate
    // firing on the tenth revision of a document.
    expect(compareVersions('2.10', '2.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0', '2')).toBe(0);
    expect(compareVersions('1.9.9', '2.0')).toBeLessThan(0);
  });

  it('picks the newest version from a mixed list', () => {
    expect(maxVersion(['1.0', '2.10', '2.9'])).toBe('2.10');
    expect(maxVersion([])).toBe('1.0');
  });
});

describe('LegalService — acceptance status', () => {
  it('asks again once a newer version is published', async () => {
    const { service } = makeService(
      [makePage({ version: '2.1' })],
      [makeAcceptance({ version: '2.0' })],
    );

    const [terms] = await service.getDocumentStatuses(USER_ID, UserRole.PERSONAL);

    expect(terms.version).toBe('2.1');
    expect(terms.acceptedVersion).toBe('2.0');
    expect(terms.state).toBe('update_required');
    expect(terms.needsAcceptance).toBe(true);
  });

  it('leaves a user alone while they hold the current version', async () => {
    const { service } = makeService(
      [makePage({ version: '2.1' })],
      [makeAcceptance({ version: '2.1' })],
    );

    const { requiresAction, documents } = await service.getPendingDocuments(
      USER_ID,
      UserRole.PERSONAL,
    );

    expect(requiresAction).toBe(false);
    expect(documents).toHaveLength(0);
  });

  it('treats a never-accepted document as pending — the social-login case', async () => {
    const { service } = makeService([makePage()], []);

    const { requiresAction, documents } = await service.getPendingDocuments(
      USER_ID,
      UserRole.PERSONAL,
    );

    expect(requiresAction).toBe(true);
    expect(documents[0].state).toBe('never_accepted');
    // The prompt has to be able to render the text it is asking about.
    expect(documents[0].content).toBe('<p>terms</p>');
  });

  it('compares against the newest accepted version, not the latest row', async () => {
    const { service } = makeService(
      [makePage({ version: '2.1' })],
      [
        makeAcceptance({ version: '2.1', acceptedAt: new Date('2026-02-01') }),
        makeAcceptance({ version: '1.0', acceptedAt: new Date('2026-03-01') }),
      ],
    );

    const [terms] = await service.getDocumentStatuses(USER_ID, UserRole.PERSONAL);

    expect(terms.acceptedVersion).toBe('2.1');
    expect(terms.needsAcceptance).toBe(false);
  });

  it('takes the newest version across locales when a translation lags', async () => {
    const { service } = makeService(
      [
        makePage({ locale: 'it', version: '2.1' }),
        makePage({ locale: 'en', version: '2.0', content: '<p>stale</p>' }),
      ],
      [makeAcceptance({ version: '2.0' })],
    );

    const [terms] = await service.getDocumentStatuses(
      USER_ID,
      UserRole.PERSONAL,
      'en',
    );

    // English text is served, but the version in force is the Italian 2.1 —
    // a lagging translation must not park the user on an old agreement.
    expect(terms.version).toBe('2.1');
    expect(terms.needsAcceptance).toBe(true);
  });
});

describe('LegalService — audience', () => {
  const pages = [
    makePage({ slug: LegalSlug.TERMS_CONDITIONS, audience: LegalAudience.ALL }),
    makePage({
      slug: LegalSlug.BUSINESS_TERMS_CONDITIONS,
      audience: LegalAudience.BUSINESS,
      title: 'Termini e Condizioni Business',
    }),
  ];

  it('never asks a personal account for the business terms', async () => {
    const { service } = makeService(pages, []);

    const slugs = (
      await service.getDocumentStatuses(USER_ID, UserRole.PERSONAL)
    ).map((doc) => doc.slug);

    expect(slugs).toEqual([LegalSlug.TERMS_CONDITIONS]);
  });

  it('asks a business account for both', async () => {
    const { service } = makeService(pages, []);

    const slugs = (
      await service.getDocumentStatuses(USER_ID, UserRole.BUSINESS)
    ).map((doc) => doc.slug);

    expect(slugs).toEqual([
      LegalSlug.TERMS_CONDITIONS,
      LegalSlug.BUSINESS_TERMS_CONDITIONS,
    ]);
  });

  it('exempts admins — the dashboard has no consent gate', async () => {
    const { service } = makeService(pages, []);
    expect(await service.getDocumentStatuses(USER_ID, UserRole.ADMIN)).toEqual([]);
  });
});

describe('LegalService — recording acceptance', () => {
  it('records the version the user was shown', async () => {
    const { service, inserted } = makeService([makePage({ version: '2.1' })], []);

    const result = await service.acceptDocuments(USER_ID, UserRole.PERSONAL, {
      acceptances: [{ slug: LegalSlug.TERMS_CONDITIONS, version: '2.1' }],
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      userId: USER_ID,
      slug: LegalSlug.TERMS_CONDITIONS,
      version: '2.1',
      source: LegalAcceptanceSource.REACCEPTANCE,
    });
    expect(result.requiresAction).toBe(false);
  });

  it('refuses a version that is no longer current', async () => {
    // The prompt was open when 2.1 went live; accepting 2.0 now would log
    // consent to text the user was never shown.
    const { service, inserted } = makeService([makePage({ version: '2.1' })], []);

    await expect(
      service.acceptDocuments(USER_ID, UserRole.PERSONAL, {
        acceptances: [{ slug: LegalSlug.TERMS_CONDITIONS, version: '2.0' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(inserted).toHaveLength(0);
  });

  it('refuses a document that does not bind this account', async () => {
    const { service } = makeService(
      [
        makePage({
          slug: LegalSlug.BUSINESS_TERMS_CONDITIONS,
          audience: LegalAudience.BUSINESS,
        }),
      ],
      [],
    );

    await expect(
      service.acceptDocuments(USER_ID, UserRole.PERSONAL, {
        acceptances: [
          { slug: LegalSlug.BUSINESS_TERMS_CONDITIONS, version: '1.0' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('is idempotent — a retried request does not duplicate consent', async () => {
    const { service, inserted } = makeService([makePage({ version: '2.1' })], []);

    const payload = {
      acceptances: [{ slug: LegalSlug.TERMS_CONDITIONS, version: '2.1' }],
    };

    await service.acceptDocuments(USER_ID, UserRole.PERSONAL, payload);
    await service.acceptDocuments(USER_ID, UserRole.PERSONAL, payload);

    expect(inserted).toHaveLength(1);
  });

  it('still reports outstanding documents when only one of two is accepted', async () => {
    const { service } = makeService(
      [
        makePage({ slug: LegalSlug.TERMS_CONDITIONS }),
        makePage({
          slug: LegalSlug.PRIVACY_POLICY,
          title: 'Informativa sulla Privacy',
        }),
      ],
      [],
    );

    const result = await service.acceptDocuments(USER_ID, UserRole.PERSONAL, {
      acceptances: [{ slug: LegalSlug.TERMS_CONDITIONS, version: '1.0' }],
    });

    expect(result.requiresAction).toBe(true);
    expect(result.documents.map((doc) => doc.slug)).toEqual([
      LegalSlug.PRIVACY_POLICY,
    ]);
  });

  it('records sign-up consent against the versions in force', async () => {
    const { service, inserted } = makeService(
      [
        makePage({ slug: LegalSlug.TERMS_CONDITIONS, version: '2.1' }),
        makePage({ slug: LegalSlug.PRIVACY_POLICY, version: '1.3' }),
      ],
      [],
    );

    await service.recordAcceptanceFor(
      USER_ID,
      UserRole.PERSONAL,
      service.registrationSlugsFor(UserRole.PERSONAL),
      LegalAcceptanceSource.REGISTRATION,
    );

    expect(
      inserted.map((row) => `${row.slug}@${row.version}`).sort(),
    ).toEqual(['privacy-policy@1.3', 'terms-conditions@2.1']);
  });

  it('never lets a consent-recording failure break the calling flow', async () => {
    const { service } = makeService([makePage()], []);
    jest
      .spyOn(service, 'getDocumentStatuses')
      .mockRejectedValueOnce(new Error('database is down'));

    // Registration has already committed the user row by this point; throwing
    // here would take the address out of circulation for an account that was
    // created successfully.
    await expect(
      service.recordAcceptanceFor(
        USER_ID,
        UserRole.PERSONAL,
        [LegalSlug.TERMS_CONDITIONS],
        LegalAcceptanceSource.REGISTRATION,
      ),
    ).resolves.toBeUndefined();
  });
});
