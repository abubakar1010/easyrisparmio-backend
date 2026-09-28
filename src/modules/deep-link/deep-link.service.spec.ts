import { DeepLinkService } from './deep-link.service';

describe('DeepLinkService.buildLandingPageHtml', () => {
  const config = { get: (key: string) => ({ 'app.playStoreUrl': 'https://play.example/app', 'app.appStoreUrl': 'https://apps.example/app' })[key] };
  const makeService = (user: object | null = { id: 'u1' }) => {
    const users = { findByReferralCode: jest.fn().mockResolvedValue(user) };
    return { service: new DeepLinkService(config as any, users as any), users };
  };

  it('renders in Italian by default', async () => {
    const { service } = makeService();
    const html = await service.buildLandingPageHtml('ABCD1234', 'Mozilla/5.0 (Linux; Android 14)');
    expect(html).toContain('<html lang="it">');
    expect(html).toContain('Codice invito:');
    expect(html).toContain('Scarica da Google Play');
    expect(html).not.toContain('Referral code:');
  });

  it('renders in English when asked', async () => {
    const { service } = makeService();
    const html = await service.buildLandingPageHtml('ABCD1234', 'Mozilla/5.0 (iPhone)', 'en');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Referral code:');
    expect(html).toContain('Download on App Store');
  });

  it('shows the invalid-link message for an unknown code', async () => {
    const { service } = makeService(null);
    const html = await service.buildLandingPageHtml('ZZZZ9999', '');
    expect(html).toContain('potrebbe non essere valido');
    expect(html).not.toContain('copyCode');
  });

  it('never writes a malformed code into the page or looks it up', async () => {
    const { service, users } = makeService();
    const payload = "x';alert(document.cookie);//<script>";
    const html = await service.buildLandingPageHtml(payload, 'Mozilla/5.0 (Linux; Android 14)');
    expect(users.findByReferralCode).not.toHaveBeenCalled();
    expect(html).not.toContain('alert(document.cookie)');
    expect(html).not.toContain('<script>x');
  });
});
