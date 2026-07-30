import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class DeepLinkService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  getAssetLinks(): object[] {
    const fingerprint = this.configService.get<string>(
      'app.androidSha256Fingerprint',
    );
    if (!fingerprint) {
      return [];
    }

    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.vyzi',
          sha256_cert_fingerprints: [fingerprint],
        },
      },
    ];
  }

  getAppleAppSiteAssociation(): object {
    const teamId = this.configService.get<string>('app.appleTeamId');

    return {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${teamId}.com.homecraft.service`,
            paths: ['/r/*'],
          },
        ],
      },
    };
  }

  async buildLandingPageHtml(
    code: string,
    userAgent: string,
  ): Promise<string> {
    const playStoreUrl =
      this.configService.get<string>('app.playStoreUrl') || '#';
    const appStoreUrl =
      this.configService.get<string>('app.appStoreUrl') || '#';
    const backendDomain =
      this.configService.get<string>('app.backendDomain') || 'http://localhost:3000';
    const deepLink = `${backendDomain}/r/${code}`;

    // Validate the referral code
    let isValid = false;
    try {
      const user = await this.usersService.findByReferralCode(code);
      isValid = !!user;
    } catch {
      isValid = false;
    }

    const ua = userAgent.toLowerCase();
    const isAndroid = ua.includes('android');
    const isIOS =
      ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod');

    const storeUrl = isIOS ? appStoreUrl : playStoreUrl;
    const storeName = isIOS ? 'App Store' : 'Google Play';

    const statusMessage = isValid
      ? `<p style="color:#10b981;font-weight:600;">Referral code: <span style="font-size:1.4em;letter-spacing:2px;">${code}</span></p>`
      : `<p style="color:#ef4444;font-weight:600;">This referral link may be invalid or expired.</p>`;

    const copySection = isValid
      ? `<button id="copyBtn" onclick="copyCode()" style="width:100%;padding:14px;background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:12px;font-size:1.1em;font-weight:700;letter-spacing:3px;color:#1e293b;cursor:pointer;margin-bottom:12px;transition:all .2s;">${code}</button>
         <p id="copyHint" style="font-size:0.85em;color:#94a3b8;margin-bottom:20px;">Tap the code to copy it</p>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <title>VYZI — Save on Your Energy Bills</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#1e293b;min-height:100vh;display:flex;align-items:center;justify-content:center;}
    .card{max-width:420px;width:90%;margin:20px auto;background:#fff;border-radius:20px;padding:40px 28px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08);}
    .logo{font-size:2.2em;font-weight:800;color:#2563eb;margin-bottom:8px;}
    .subtitle{color:#64748b;font-size:0.95em;margin-bottom:28px;}
    .store-btn{display:block;width:100%;padding:16px;border:none;border-radius:12px;font-size:1.05em;font-weight:600;cursor:pointer;text-decoration:none;margin-bottom:12px;transition:transform .15s;}
    .store-btn:active{transform:scale(.97);}
    .btn-primary{background:#2563eb;color:#fff;}
    .btn-secondary{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;}
    .footer{margin-top:24px;font-size:0.8em;color:#94a3b8;}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">VYZI</div>
    <p class="subtitle">Save on your energy bills with AI-powered analysis</p>
    ${statusMessage}
    ${copySection}
    <a href="${storeUrl}" class="store-btn btn-primary" id="storeBtn">Download on ${storeName}</a>
    ${isAndroid && isValid ? `<a href="intent://r/${code}#Intent;scheme=https;package=com.vyzi;S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end" class="store-btn btn-secondary">Open in App</a>` : ''}
    ${!isAndroid && !isIOS ? `<div style="display:flex;gap:12px;margin-top:8px;"><a href="${playStoreUrl}" class="store-btn btn-secondary" style="flex:1;">Android</a><a href="${appStoreUrl}" class="store-btn btn-secondary" style="flex:1;">iOS</a></div>` : ''}
    <p class="footer">Your friend invited you to save on energy bills with VYZI.</p>
  </div>
  <script>
    function copyCode(){
      var code='${code}';
      if(navigator.clipboard){
        navigator.clipboard.writeText(code).then(function(){
          document.getElementById('copyBtn').textContent='Copied!';
          document.getElementById('copyBtn').style.borderColor='#10b981';
          document.getElementById('copyBtn').style.color='#10b981';
          document.getElementById('copyHint').textContent='Code copied to clipboard';
          setTimeout(function(){
            document.getElementById('copyBtn').textContent=code;
            document.getElementById('copyBtn').style.borderColor='#cbd5e1';
            document.getElementById('copyBtn').style.color='#1e293b';
            document.getElementById('copyHint').textContent='Tap the code to copy it';
          },2000);
        });
      }
    }
    // Auto-redirect to store after 3 seconds on mobile
    ${isAndroid || isIOS ? `setTimeout(function(){window.location.href='${storeUrl}';},3000);` : ''}
  </script>
</body>
</html>`;
  }
}
