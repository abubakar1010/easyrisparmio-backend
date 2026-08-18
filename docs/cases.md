# Cases (Switch Requests)

Cases represent supplier-switching requests on the EasyRisparmio platform. Users create a case by selecting an offer for their uploaded bill. The case tracks the full lifecycle from request through document collection to activation. Contract signing itself happens with the supplier, outside this application — the case only records that it was handed over and, once the supplier confirms, the activation and expiry dates. All endpoints are prefixed with `/api/v1/cases`.

## Table of Contents

- [Case Status Lifecycle](#case-status-lifecycle)
- [Case Types](#case-types)
- [Priorities](#priorities)
- [Document Types](#document-types)
- [Case Fields](#case-fields)
- [Document Fields](#document-fields)
- [User Endpoints](#user-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [API Reference](#api-reference)

---

## Case Status Lifecycle

```
NEW → IN_PROGRESS → DOCUMENTS_PENDING → CONTRACT_SENT → AWAITING_ACTIVATION → ACTIVATED
 ↓        ↓              ↓
CANCELLED  REJECTED     CANCELLED
```

| Status | Description |
|--------|-------------|
| `new` | Case created, awaiting admin review |
| `in_progress` | Admin assigned and working on it |
| `documents_pending` | Waiting for user to upload required documents |
| `contract_sent` | Handed over for signing — the customer signs with the supplier, outside the app |
| `awaiting_activation` | Signed and accepted; the switch is running. `activation_date` and `expiry_date` are set |
| `activated` | Switch completed, new supplier active |
| `rejected` | Admin rejected the request |
| `cancelled` | Cancelled by user or system |

`LIVE_UTILITY_CASE_STATUSES` (`src/common/enums/case.enum.ts`) is
`[awaiting_activation, activated]` — the one definition of "this utility belongs
to the customer". The my-services list, the utilities count, the savings total
and the app badge all read it, so they can never disagree.

The case status is mirrored from the bill status; the bill is the pipeline that
drives everything (`CASE_STATUS_BY_BILL_STATUS` in `bills.service.ts`).

## Case Types

| Type | Value | Description |
|------|-------|-------------|
| Switch | `switch` | Change energy supplier |
| Transfer | `transfer` | Transfer account to new address |
| Takeover | `takeover` | Take over existing supply point |
| New Activation | `new_activation` | New supply point activation |

## Priorities

| Priority | Value |
|----------|-------|
| Low | `low` |
| Medium | `medium` (default) |
| High | `high` |
| Urgent | `urgent` |

## Document Types

| Type | Value | Description |
|------|-------|-------------|
| Bill | `bill` | Energy bill document |
| ID Card | `id_card` | Identity document |
| Codice Fiscale | `codice_fiscale` | Italian tax ID card |
| Contract | `contract` | Contract document |
| Signed Contract | `signed_contract` | Signed contract |
| Partita IVA | `partita_iva` | VAT registration document |

---

## Case Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `caseNumber` | string | Auto-generated (SW-YYYYMMDD-XXXXX) |
| `userId` | UUID | Customer who created the case |
| `billId` | UUID | Energy bill for this switch |
| `selectedOfferId` | UUID | Chosen energy offer |
| `assignedAgentId` | UUID | Admin agent handling the case |
| `status` | enum | Case status |
| `priority` | enum | Case priority |
| `caseType` | enum | Type of case (default: switch) |
| `notes` | text | Customer-visible notes |
| `internalNotes` | text | Admin-only notes |
| `fromSupplierId` | UUID | Current supplier (auto-populated from bill) |
| `toSupplierId` | UUID | Target supplier (auto-populated from offer) |
| `estimatedAnnualValue` | decimal | Estimated annual savings |
| `contractSentAt` | timestamptz | When the contract went out for signing |
| `activationDate` | date | When the new supply goes live — admin-entered |
| `expiryDate` | date | When the new supply contract expires — admin-entered |

### Activation dates

Contracts are signed with the supplier, outside this application, so nothing here
is ever derived from a signing event. When the supplier confirms, the admin moves
the case to `awaiting_activation` through
`POST /bills/admin/:billId/transition { targetStatus, activationDate, expiryDate }`
— **both dates are required for that target**, and the expiry must fall after the
activation. Moving a case back before activation clears both, so a called-off
switch stops looking live in the customer's utilities.

Suppliers move activation dates around, so both stay editable afterwards through
`PATCH /cases/:id { activationDate, expiryDate }`, which enforces the same rules.

## Document Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `caseId` | UUID | Parent case |
| `documentType` | enum | Document classification |
| `fileUrl` | string | File storage URL |
| `fileName` | string | Original filename |
| `uploadedById` | UUID | User who uploaded |
| `verified` | boolean | Admin verification status |
| `verifiedById` | UUID | Admin who verified |
| `verifiedAt` | timestamp | Verification timestamp |

---

## User Endpoints

All endpoints require JWT authentication. Users can only access their own cases.

### Create Case

```
POST /api/v1/cases
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "billId": "bl1a2b3c-d5e6-7890-abcd-ef1234567890",
  "selectedOfferId": "o1a2b3c4-d5e6-7890-abcd-ef1234567890"
}
```

Creates a switching request. A case number is auto-generated. The `fromSupplierId` (current) and `toSupplierId` (target) are populated automatically from the bill and offer.

### List My Cases

```
GET /api/v1/cases?page=1&limit=20&status=in_progress
Authorization: Bearer <access_token>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `status` | enum | No | Filter by case status |
| `priority` | enum | No | Filter by priority |
| `search` | string | No | Search by case number |

### Get Case Detail

```
GET /api/v1/cases/:id
Authorization: Bearer <access_token>
```

Returns the full case with its user, bill, offer, agent and documents, plus the
activation dates.

### Upload Document

```
POST /api/v1/cases/:id/documents
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "documentType": "id_card",
  "fileUrl": "https://storage.easyresparmio.it/docs/id-card-front.pdf",
  "fileName": "carta-identita-fronte.pdf"
}
```

### List Documents

```
GET /api/v1/cases/:id/documents
Authorization: Bearer <access_token>
```

Returns all documents for a case with uploader and verifier details.

---

## Admin Endpoints

### List All Cases

```
GET /api/v1/cases?page=1&limit=20&status=new&assignedAgentId=uuid
Authorization: Bearer <admin_access_token>
```

Admins see all cases. Additional filters: `assignedAgentId`, `userId`.

### Update Case

```
PATCH /api/v1/cases/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

```json
{
  "status": "in_progress",
  "assignedAgentId": "admin-uuid",
  "priority": "high",
  "notes": "Documents received, processing switch."
}
```

Status changes and agent assignments are logged as case events.

### Verify Document

```
PATCH /api/v1/cases/:id/documents/:docId/verify
Authorization: Bearer <admin_access_token>
```

Sets `verified: true`, `verifiedById`, and `verifiedAt`. Logged as a case event.

---

## API Reference

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| POST | `/cases` | JWT | Any | Create case from bill + offer |
| GET | `/cases` | JWT | Any/ADMIN | List cases (user: own, admin: all) |
| GET | `/cases/:id` | JWT | Any/ADMIN | Get case detail |
| PATCH | `/cases/:id` | JWT | ADMIN | Update case status/agent/notes |
| POST | `/cases/:id/documents` | JWT | Any | Upload document |
| GET | `/cases/:id/documents` | JWT | Any | List case documents |
| PATCH | `/cases/:id/documents/:docId/verify` | JWT | ADMIN | Verify document |
