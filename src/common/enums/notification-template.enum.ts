/**
 * What a reusable notification template is for.
 *
 * Drives the filter and the colour tag on the templates page — the wording of
 * each message is the admin's own, so the category only has to be coarse enough
 * to find things in a list. The four values are the use cases the client named.
 *
 * Postgres cannot drop an enum label while a row still uses it, so append only:
 * never reorder, never delete. Removing one would need a `pre-sync` step that
 * moves the rows off it first.
 */
export enum NotificationTemplateCategory {
  /** Offerte promozionali. */
  PROMOTIONAL = 'promotional',
  /** Documenti da ricaricare. */
  DOCUMENT_REQUEST = 'document_request',
  /** Aggiornamento sulla pratica. */
  CASE_UPDATE = 'case_update',
  /** Comunicazioni personalizzate. */
  CUSTOM = 'custom',
}
