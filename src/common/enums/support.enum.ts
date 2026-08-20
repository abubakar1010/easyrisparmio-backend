export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * The FAQ categories the apps actually render. Each value maps to a card on
 * the mobile support screen (`support_screen.dart`), which requests FAQs by
 * this exact string — an FAQ filed under anything else is unreachable there,
 * so the category is a closed set rather than free text.
 *
 * Adding a value here also requires a matching card in the mobile app.
 */
export enum FaqCategory {
  SUPPLIER_SWITCH = 'Cambio Fornitore',
  BILLS = 'Bollette',
  DOCUMENTS = 'Documenti',
}
