# Meters (Utilities)

Meters represent physical utility points (electricity POD, gas PDR, water, internet) linked to users. Admin manages the full lifecycle; users see only their active meters. All endpoints are prefixed with `/api/v1/meters`.

## Table of Contents

- [Utility Types](#utility-types)
- [Status Lifecycle](#status-lifecycle)
- [User Endpoint](#user-endpoint)
- [Admin Endpoints](#admin-endpoints)
- [API Reference](#api-reference)

---

## Utility Types

| Type | Value | Meter Code Format | Unit |
|------|-------|-------------------|------|
| Electricity | `electricity` | POD (e.g. IT001E556779) | kWh |
| Gas | `gas` | PDR (e.g. GS002C556677) | Smc / Therms |
| Water | `water` | e.g. WT004A223344 | Liters |
| Internet | `internet` | e.g. IT009B778899 | GB |

---

## Status Lifecycle

Admin controls meter visibility to users via status moderation. Users only see `active` meters.

```
PENDING → ACTIVE → INACTIVE → ACTIVE (reactivate)
   ↓         ↓         ↓
TERMINATED TERMINATED TERMINATED
```

| Status | Visible to User | Description |
|--------|----------------|-------------|
| `pending` | No | Awaiting activation by admin |
| `active` | Yes | Currently in use, visible to user |
| `inactive` | No | Temporarily hidden from user |
| `terminated` | No | Permanently closed (terminal state, no transitions) |

**Valid transitions:**
- `pending` → `active`, `terminated`
- `active` → `inactive`, `terminated`
- `inactive` → `active`, `terminated`
- `terminated` → (none — terminal)

---

## User Endpoint

Requires JWT authentication with `personal` or `business` role.

### List My Active Meters

```
GET /api/v1/meters/my-meters
Authorization: Bearer <access_token>
```

Returns the user's active meters with supplier and address details. No pagination — users typically have 2-5 utilities.

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "m1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "utilityType": "electricity",
      "meterCode": "IT001E556779",
      "status": "active",
      "annualConsumption": "12500.00",
      "consumptionUnit": "kWh",
      "contractedPowerKw": "3.00",
      "activationDate": "2025-01-15",
      "supplier": {
        "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "name": "Ener Energia"
      },
      "address": {
        "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "streetAddress": "Via Roma 42",
        "city": "Milano",
        "postalCode": "20121"
      }
    }
  ]
}
```

Only meters with `active` status are returned. `inactive`, `pending`, and `terminated` meters are hidden.

---

## Admin Endpoints

All admin endpoints require JWT authentication with `admin` role.

### Create Meter

```
POST /api/v1/meters
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

```json
{
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "utilityType": "electricity",
  "meterCode": "IT001E556779",
  "supplierId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "annualConsumption": 12500,
  "consumptionUnit": "kWh",
  "contractedPowerKw": 3.0,
  "activationDate": "2025-01-15",
  "notes": "Verified via supplier portal"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | UUID | Yes | Owner of the meter |
| `utilityType` | enum | Yes | `electricity`, `gas`, `water`, `internet` |
| `meterCode` | string | Yes | POD/PDR identifier (max 50 chars) |
| `supplierId` | UUID | No | Current supplier |
| `status` | enum | No | Defaults to `active` |
| `annualConsumption` | number | No | Annual usage |
| `consumptionUnit` | string | No | Unit (kWh, Smc, Liters, GB) |
| `contractedPowerKw` | number | No | Contracted power (electricity) |
| `addressId` | UUID | No | Meter location address |
| `activationDate` | date | No | ISO 8601 date |
| `notes` | string | No | Admin notes |

The `createdBy` and `updatedBy` fields are auto-set from the admin JWT.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Validation failed |
| 409 | Duplicate meter code + utility type combination |

### List All Meters

```
GET /api/v1/meters?page=1&limit=20&utilityType=electricity&status=active
Authorization: Bearer <admin_access_token>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `utilityType` | enum | No | Filter by utility type |
| `status` | enum | No | Filter by meter status |
| `userId` | UUID | No | Filter by user |
| `supplierId` | UUID | No | Filter by supplier |
| `search` | string | No | Search meter code, user name, or email |

Returns paginated results with user, supplier, and address relations.

### Get Meter Detail

```
GET /api/v1/meters/:id
Authorization: Bearer <admin_access_token>
```

Returns full meter with all relations. 404 if not found.

### Update Meter

```
PATCH /api/v1/meters/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

```json
{
  "annualConsumption": 15000,
  "notes": "Updated after annual review"
}
```

All fields are optional (PartialType). The `updatedBy` field is auto-set.

### Soft-Delete Meter

```
DELETE /api/v1/meters/:id
Authorization: Bearer <admin_access_token>
```

Sets `deleted_at` timestamp. The meter is hidden from all queries but preserved in the database.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Meter deleted successfully"
  }
}
```

### Change Status (Moderation)

```
PATCH /api/v1/meters/:id/status
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Activate a meter (make visible to user):**
```json
{
  "status": "active"
}
```

**Deactivate a meter (hide from user):**
```json
{
  "status": "inactive"
}
```

**Terminate a meter (permanent):**
```json
{
  "status": "terminated"
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid transition (e.g. `terminated` → `active`) |
| 404 | Meter not found |

---

## API Reference

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/meters/my-meters` | JWT | PERSONAL, BUSINESS | List user's active meters |
| POST | `/meters` | JWT | ADMIN | Create a meter |
| GET | `/meters` | JWT | ADMIN | List all meters (paginated) |
| GET | `/meters/:id` | JWT | ADMIN | Get meter detail |
| PATCH | `/meters/:id` | JWT | ADMIN | Update meter fields |
| DELETE | `/meters/:id` | JWT | ADMIN | Soft-delete meter |
| PATCH | `/meters/:id/status` | JWT | ADMIN | Change status (moderation) |
