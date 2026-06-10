# Support

The Support module provides a ticketing system and FAQ for the EasyRisparmio mobile app. Users create tickets and exchange messages with support agents; admins manage tickets, assign agents, and maintain FAQs. Accessed from Profile → Supporto in the mobile app. All endpoints are prefixed with `/api/v1/support`.

## Table of Contents

- [Ticket Status Lifecycle](#ticket-status-lifecycle)
- [Categories](#categories)
- [Priorities](#priorities)
- [Ticket Endpoints](#ticket-endpoints)
- [FAQ Endpoints](#faq-endpoints)
- [API Reference](#api-reference)

---

## Ticket Status Lifecycle

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
  ↓         ↓                       
CLOSED   CLOSED                    
```

| Status | Description |
|--------|-------------|
| `open` | New ticket, awaiting agent assignment |
| `in_progress` | Agent assigned and working on it (auto-set when agent assigned to open ticket) |
| `resolved` | Issue resolved by agent (`resolvedAt` timestamp set) |
| `closed` | Ticket closed permanently (`closedAt` timestamp set, terminal state) |

**Valid transitions:**
- `open` → `in_progress`, `closed`
- `in_progress` → `resolved`, `closed`
- `resolved` → `closed`
- `closed` → (none — terminal)

---

## Categories

| Category | Value | Description |
|----------|-------|-------------|
| Technical Support | `technical_support` | App issues, bugs, configuration |
| Billing & Payments | `billing_payments` | Bill uploads, payment issues |
| Switching | `switching` | Supplier switching process |
| General | `general` | General inquiries |

## Priorities

| Priority | Value |
|----------|-------|
| Low | `low` |
| Medium | `medium` (default) |
| High | `high` |
| Urgent | `urgent` |

---

## Ticket Endpoints

### Create Ticket (User)

```
POST /api/v1/support/tickets
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "subject": "Unable to upload my electricity bill",
  "category": "billing_payments",
  "priority": "medium",
  "message": "I keep getting an error when trying to upload my Enel electricity bill as PDF."
}
```

Creates a ticket with an initial message. Status starts as `open`. Available to all authenticated users.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subject` | string | Yes | Ticket subject (max 255) |
| `category` | enum | Yes | Ticket category |
| `priority` | enum | No | Priority (default: medium) |
| `message` | string | Yes | Initial message text |

### List Tickets

```
GET /api/v1/support/tickets?page=1&limit=20&status=open&priority=high
Authorization: Bearer <access_token>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `status` | enum | No | Filter by status |
| `priority` | enum | No | Filter by priority |
| `category` | enum | No | Filter by category |
| `search` | string | No | Search by subject |

Regular users see only their own tickets. Admins see all tickets.

### Get Ticket Detail

```
GET /api/v1/support/tickets/:id
Authorization: Bearer <access_token>
```

Returns ticket with full conversation thread (messages with sender details). Users can only access their own tickets; admins can access any ticket. 403 if not owner, 404 if not found.

### Update Ticket (Admin)

```
PATCH /api/v1/support/tickets/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Assign agent:**
```json
{
  "assignedAgentId": "admin-uuid"
}
```
When an agent is assigned to an `open` ticket, status auto-transitions to `in_progress`.

**Update status:**
```json
{
  "status": "resolved"
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid status transition (e.g. `closed` → `open`) |
| 404 | Ticket not found |

### Add Message

```
POST /api/v1/support/tickets/:id/messages
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "message": "I tried again and the upload still fails. Here is a screenshot.",
  "attachments": ["https://cdn.easyresparmio.it/uploads/screenshot-error.png"]
}
```

Users can only message their own tickets; admins can message any ticket. 403 if not owner.

### Get Messages

```
GET /api/v1/support/tickets/:id/messages
Authorization: Bearer <access_token>
```

Returns all messages ordered by creation date ascending. Same access control as add message.

---

## FAQ Endpoints

### List FAQs (Public)

```
GET /api/v1/support/faqs?category=billing
```

No authentication required. Returns active FAQs sorted by category and display order. Optional filter by category.

### Create FAQ (Admin)

```
POST /api/v1/support/faqs
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

```json
{
  "category": "billing",
  "question": "How does the switching process work?",
  "answer": "The switching process takes 2-4 weeks. We handle all paperwork.",
  "sortOrder": 1,
  "locale": "it",
  "targetAudience": "both"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | Yes | FAQ category (max 100) |
| `question` | string | Yes | Question text (max 500) |
| `answer` | string | Yes | Answer text |
| `sortOrder` | int | No | Display order (default: 0) |
| `locale` | string | No | Language code (default: it) |
| `targetAudience` | enum | No | personal, business, both (default: both) |
| `isActive` | boolean | No | Active flag (default: true) |

### Update FAQ (Admin)

```
PATCH /api/v1/support/faqs/:id
Authorization: Bearer <admin_access_token>
```

All fields optional (PartialType). 404 if not found.

### Delete FAQ (Admin)

```
DELETE /api/v1/support/faqs/:id
Authorization: Bearer <admin_access_token>
```

Permanently deletes the FAQ.

---

## API Reference

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| POST | `/support/tickets` | JWT | Any | Create support ticket |
| GET | `/support/tickets` | JWT | Any (filtered) | List tickets (own or all) |
| GET | `/support/tickets/:id` | JWT | Any (access check) | Get ticket detail with messages |
| PATCH | `/support/tickets/:id` | JWT | ADMIN | Update status / assign agent |
| POST | `/support/tickets/:id/messages` | JWT | Any (access check) | Add message to ticket |
| GET | `/support/tickets/:id/messages` | JWT | Any (access check) | Get ticket conversation |
| GET | `/support/faqs` | None | Public | List active FAQs |
| POST | `/support/faqs` | JWT | ADMIN | Create FAQ |
| PATCH | `/support/faqs/:id` | JWT | ADMIN | Update FAQ |
| DELETE | `/support/faqs/:id` | JWT | ADMIN | Delete FAQ |
