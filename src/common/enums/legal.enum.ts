/**
 * Which accounts a legal document applies to. Drives both what the mobile app
 * lists under Settings and what the re-acceptance gate blocks on, so a document
 * that only concerns companies never interrupts a personal user.
 */
export enum LegalAudience {
  ALL = 'all',
  PERSONAL = 'personal',
  BUSINESS = 'business',
}

/**
 * Where an acceptance came from. Kept because a GDPR/consent audit has to be
 * able to say *how* consent was given, not just that it was.
 */
export enum LegalAcceptanceSource {
  REGISTRATION = 'registration',
  SOCIAL_LOGIN = 'social_login',
  BUSINESS_UPGRADE = 'business_upgrade',
  REACCEPTANCE = 'reacceptance',
}

/** Slugs the platform treats as legal documents. */
export const LegalSlug = {
  PRIVACY_POLICY: 'privacy-policy',
  TERMS_CONDITIONS: 'terms-conditions',
  BUSINESS_TERMS_CONDITIONS: 'business-terms-conditions',
} as const;

export type LegalSlugValue = (typeof LegalSlug)[keyof typeof LegalSlug];

/** Every legal slug, in the order a user should be asked to review them. */
export const LEGAL_SLUGS: LegalSlugValue[] = [
  LegalSlug.PRIVACY_POLICY,
  LegalSlug.TERMS_CONDITIONS,
  LegalSlug.BUSINESS_TERMS_CONDITIONS,
];
