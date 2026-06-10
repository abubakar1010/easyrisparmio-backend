# Offers

Offers represent energy plans from suppliers on the EasyRisparmio platform. Public users browse active offers and compare them; authenticated users get bill-based recommendations; admins manage the full lifecycle. All endpoints are prefixed with `/api/v1/offers`.

## Table of Contents

- [Energy Types](#energy-types)
- [Market Types](#market-types)
- [Target Audience](#target-audience)
- [Status Lifecycle](#status-lifecycle)
- [Offer Fields](#offer-fields)
- [Public Endpoints](#public-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [API Reference](#api-reference)

---

## Energy Types

| Type | Value | Description |
|------|-------|-------------|
| Electricity | `electricity` | Electricity-only plans (price in kWh) |
| Gas | `gas` | Gas-only plans (price in Smc) |
| Dual | `dual` | Combined electricity + gas plans |

## Market Types

| Type | Value | Description |
|------|-------|-------------|
| Fixed | `fixed` | Price locked for the contract duration |
| Variable | `variable` | Price follows market fluctuations |
| Indexed | `indexed` | Price tied to PUN/GME market indices |

## Target Audience

| Target | Value | Description |
|--------|-------|-------------|
| Personal | `personal` | Residential customers only |
| Business | `business` | Business customers only |
| Both | `both` | Available to all customer types |

---

## Status Lifecycle

Admin controls the offer lifecycle via status moderation.

```
DRAFT → ACTIVE → EXPIRING → EXPIRED
  ↓        ↓         ↓          ↓
ARCHIVED ARCHIVED  ARCHIVED  ARCHIVED
```

| Status | Visible to Public | Description |
|--------|------------------|-------------|
| `draft` | No | New offer, not yet published |
| `active` | Yes | Published and available to users |
| `expiring` | Yes | Still available but ending soon |
| `expired` | No | Validity period ended |
| `archived` | No | Permanently removed (terminal state) |

**Valid transitions:**
- `draft` → `active`, `archived`
- `active` → `expiring`, `archived`
- `expiring` → `expired`, `archived`
- `expired` → `archived`
- `archived` → (none — terminal)

---

## Offer Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Primary key |
| `name` | string | Yes | Offer name (max 255) |
| `description` | text | No | Offer description |
| `energyType` | enum | Yes | `electricity`, `gas`, `dual` |
| `marketType` | enum | Yes | `fixed`, `variable`, `indexed` |
| `pricePerKwh` | decimal(10,6) | No | Electricity price per kWh |
| `pricePerSmc` | decimal(10,6) | No | Gas price per standard cubic meter |
| `fixedMonthlyFee` | decimal(10,2) | Yes | Monthly fixed fee (default: 0) |
| `activationCost` | decimal(10,2) | Yes | One-time activation cost (default: 0) |
| `contractDurationMonths` | int | Yes | Contract duration in months |
| `isGreenEnergy` | boolean | No | Green energy certified (default: false) |
| `isActive` | boolean | No | Active flag (default: true) |
| `validFrom` | date | Yes | Offer validity start (ISO 8601) |
| `validUntil` | date | No | Offer validity end (ISO 8601) |
| `termsUrl` | string | No | Terms & conditions URL (max 500) |
| `target` | enum | No | `personal`, `business`, `both` (default: both) |
| `highlights` | string[] | No | Bullet-point highlights (JSONB) |
| `offerCode` | string | No | Unique offer code (max 50) |
| `offerStatus` | enum | No | `draft`, `active`, `expiring`, `expired`, `archived` (default: draft) |
| `version` | int | Auto | Version number (default: 1) |
| `parentOfferId` | UUID | Auto | Parent offer for versioning |
| `supplierId` | UUID | Yes | Linked supplier |
| `createdBy` | UUID | Auto | Admin who created |
| `updatedBy` | UUID | Auto | Admin who last updated |
| `createdAt` | timestamp | Auto | Creation timestamp |
| `updatedAt` | timestamp | Auto | Last update timestamp |

---

## Public Endpoints

No authentication required.

### List Active Offers

```
GET /api/v1/offers?page=1&limit=20&search=luce
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `search` | string | No | Search by name, description, or offer code |

Returns only offers with `offerStatus = active` and `isActive = true`, with supplier details.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "o1a2b3c4-d5e6-7890-abcd-ef1234567890",
        "name": "Casa Luce Fix 12",
        "description": "Fixed-price electricity plan for residential customers",
        "energyType": "electricity",
        "marketType": "fixed",
        "pricePerKwh": "0.085000",
        "fixedMonthlyFee": "9.90",
        "contractDurationMonths": 12,
        "isGreenEnergy": true,
        "offerStatus": "active",
        "target": "personal",
        "highlights": ["Fixed price for 12 months", "No activation fee"],
        "supplier": {
          "id": "s1a2b3c4...",
          "name": "Enel Energia",
          "logoUrl": "https://cdn.easyresparmio.it/logos/enel-energia.png"
        }
      }
    ],
    "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

### Get Offer Detail

```
GET /api/v1/offers/:id
```

Returns a single offer with full supplier details. 404 if not found.

### Compare Offers

```
GET /api/v1/offers/compare?ids=uuid1,uuid2,uuid3
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | string | Yes | Comma-separated offer UUIDs |

Returns an array of full offer objects for side-by-side comparison.

### Recommended Offers (Authenticated)

```
GET /api/v1/offers/recommended/:billId
Authorization: Bearer <access_token>
```

Returns up to 10 recommended offers based on the user's energy bill:
- Matches energy type from the bill (electricity/gas)
- Excludes the user's current supplier
- Sorted by price ascending (cheapest first)

---

## Admin Endpoints

All admin endpoints require JWT authentication with `admin` role.

### List All Offers (Admin)

```
GET /api/v1/offers/admin?page=1&limit=20&energyType=electricity&offerStatus=draft
Authorization: Bearer <admin_access_token>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `energyType` | enum | No | Filter: `electricity`, `gas`, `dual` |
| `marketType` | enum | No | Filter: `fixed`, `variable`, `indexed` |
| `target` | enum | No | Filter: `personal`, `business`, `both` |
| `isActive` | boolean | No | Filter by active flag |
| `offerStatus` | enum | No | Filter: `draft`, `active`, `expiring`, `expired`, `archived` |
| `supplierId` | UUID | No | Filter by supplier |
| `search` | string | No | Search name, description, or offer code |

### Create Offer

```
POST /api/v1/offers
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

```json
{
  "name": "Casa Luce Fix 12",
  "description": "Fixed-price electricity plan for residential customers",
  "energyType": "electricity",
  "marketType": "fixed",
  "pricePerKwh": 0.085,
  "fixedMonthlyFee": 9.9,
  "activationCost": 0,
  "contractDurationMonths": 12,
  "isGreenEnergy": true,
  "validFrom": "2026-01-01",
  "validUntil": "2026-12-31",
  "target": "personal",
  "highlights": ["Fixed price for 12 months", "No activation fee", "100% green energy"],
  "supplierId": "s1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "offerCode": "CLF-12-2026"
}
```

The `createdBy` and `updatedBy` fields are auto-set from the admin JWT.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Validation failed |
| 409 | Duplicate offer code |

### Update Offer

```
PATCH /api/v1/offers/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

```json
{
  "pricePerKwh": 0.079,
  "description": "Updated price after market review"
}
```

All fields are optional (PartialType). The `updatedBy` field is auto-set.

### Soft-Delete Offer

```
DELETE /api/v1/offers/:id
Authorization: Bearer <admin_access_token>
```

Sets `deleted_at` timestamp. The offer is hidden from all queries but preserved in the database.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Offer deleted successfully"
  }
}
```

### Change Status (Moderation)

```
PATCH /api/v1/offers/:id/status
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Publish a draft offer:**
```json
{
  "offerStatus": "active"
}
```

**Archive an offer:**
```json
{
  "offerStatus": "archived"
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid transition (e.g. `archived` → `active`) |
| 404 | Offer not found |

---

## API Reference

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/offers` | None | Public | List active offers (paginated) |
| GET | `/offers/compare?ids=...` | None | Public | Compare multiple offers |
| GET | `/offers/recommended/:billId` | JWT | User | Get bill-based recommendations |
| GET | `/offers/admin` | JWT | ADMIN | List all offers with filtering |
| GET | `/offers/:id` | None | Public | Get offer detail |
| POST | `/offers` | JWT | ADMIN | Create an offer |
| PATCH | `/offers/:id` | JWT | ADMIN | Update offer fields |
| DELETE | `/offers/:id` | JWT | ADMIN | Soft-delete offer |
| PATCH | `/offers/:id/status` | JWT | ADMIN | Change offer status (moderation) |
