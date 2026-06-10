# Suppliers

Suppliers represent energy providers on the EasyRisparmio platform. Public users browse active suppliers; admins manage the full lifecycle including creation, updates, activation/deactivation, and soft-deletion. All endpoints are prefixed with `/api/v1/suppliers`.

## Table of Contents

- [Supplier Fields](#supplier-fields)
- [Public Endpoints](#public-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [API Reference](#api-reference)

---

## Supplier Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Primary key |
| `name` | string | Yes | Supplier name (max 255) |
| `logoUrl` | string | No | URL of the supplier logo (max 500) |
| `description` | text | No | Supplier description |
| `rating` | decimal(3,2) | No | Rating from 0 to 5 (default: 0) |
| `isActive` | boolean | No | Whether the supplier is active (default: true) |
| `contactEmail` | string | No | Contact email (max 255) |
| `contactPhone` | string | No | Contact phone number (max 20) |
| `website` | string | No | Website URL (max 500) |
| `supplierCode` | string | No | Unique supplier code (max 50) |
| `createdBy` | UUID | Auto | Admin who created the supplier |
| `updatedBy` | UUID | Auto | Admin who last updated the supplier |
| `createdAt` | timestamp | Auto | Creation timestamp |
| `updatedAt` | timestamp | Auto | Last update timestamp |
| `deletedAt` | timestamp | Auto | Soft-delete timestamp (null if not deleted) |

---

## Public Endpoints

No authentication required.

### List Active Suppliers

```
GET /api/v1/suppliers?page=1&limit=20&search=enel
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `search` | string | No | Search by supplier name or supplier code |

Returns only active suppliers (`isActive = true`), ordered alphabetically by name.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "s1a2b3c4-d5e6-7890-abcd-ef1234567890",
        "name": "Enel Energia",
        "logoUrl": "https://cdn.easyresparmio.it/logos/enel-energia.png",
        "description": "Leading Italian energy supplier since 1962",
        "rating": "4.50",
        "isActive": true,
        "contactEmail": "info@enelenergia.it",
        "contactPhone": "+39023456789",
        "website": "https://www.enelenergia.it",
        "supplierCode": "ENEL-001",
        "createdAt": "2026-06-01T10:00:00.000Z",
        "updatedAt": "2026-06-01T10:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### Get Supplier Detail

```
GET /api/v1/suppliers/:id
```

Returns a single supplier with its associated offers. 404 if not found.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "s1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "name": "Enel Energia",
    "logoUrl": "https://cdn.easyresparmio.it/logos/enel-energia.png",
    "description": "Leading Italian energy supplier since 1962",
    "rating": "4.50",
    "isActive": true,
    "contactEmail": "info@enelenergia.it",
    "contactPhone": "+39023456789",
    "website": "https://www.enelenergia.it",
    "supplierCode": "ENEL-001",
    "createdAt": "2026-06-01T10:00:00.000Z",
    "updatedAt": "2026-06-01T10:00:00.000Z",
    "offers": [
      {
        "id": "o1a2b3c4-d5e6-7890-abcd-ef1234567890",
        "name": "Casa Luce Fix",
        "energyType": "electricity",
        "status": "active"
      }
    ]
  }
}
```

**Error (404):**

```json
{
  "success": false,
  "statusCode": 404,
  "message": ["Supplier not found"],
  "timestamp": "2026-06-10T12:00:00.000Z"
}
```

---

## Admin Endpoints

All admin endpoints require JWT authentication with `admin` role.

### List All Suppliers (Admin)

```
GET /api/v1/suppliers/admin?page=1&limit=20&isActive=true&search=enel
Authorization: Bearer <admin_access_token>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `isActive` | boolean | No | Filter by active status |
| `search` | string | No | Search by name, email, or supplier code |

Returns all suppliers (active and inactive), ordered by creation date descending.

### Create Supplier

```
POST /api/v1/suppliers
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

```json
{
  "name": "Enel Energia",
  "logoUrl": "https://cdn.easyresparmio.it/logos/enel-energia.png",
  "description": "Leading Italian energy supplier since 1962",
  "rating": 4.5,
  "contactEmail": "info@enelenergia.it",
  "contactPhone": "+39023456789",
  "website": "https://www.enelenergia.it",
  "supplierCode": "ENEL-001"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Supplier name (max 255) |
| `logoUrl` | URL | No | Logo URL (max 500) |
| `description` | string | No | Supplier description |
| `rating` | number | No | Rating 0-5 (default: 0) |
| `contactEmail` | email | No | Contact email (max 255) |
| `contactPhone` | string | No | Contact phone (max 20) |
| `website` | URL | No | Website URL (max 500) |
| `supplierCode` | string | No | Unique supplier code (max 50) |

The `createdBy` and `updatedBy` fields are auto-set from the admin JWT.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Validation failed |
| 409 | Duplicate supplier code |

### Update Supplier

```
PATCH /api/v1/suppliers/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

```json
{
  "description": "Updated description after rebrand",
  "rating": 4.7
}
```

All fields are optional (PartialType). The `updatedBy` field is auto-set.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | Supplier not found |
| 409 | Duplicate supplier code after update |

### Soft-Delete Supplier

```
DELETE /api/v1/suppliers/:id
Authorization: Bearer <admin_access_token>
```

Sets `deleted_at` timestamp. The supplier is hidden from all queries but preserved in the database.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Supplier deleted successfully"
  }
}
```

### Toggle Status (Activate/Deactivate)

```
PATCH /api/v1/suppliers/:id/toggle-status
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Activate a supplier (make visible to public):**

```json
{
  "isActive": true
}
```

**Deactivate a supplier (hide from public):**

```json
{
  "isActive": false
}
```

Active suppliers appear in the public listing (`GET /suppliers`). Inactive suppliers are hidden from public but still visible to admins via `GET /suppliers/admin`.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | Supplier not found |

---

## API Reference

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/suppliers` | None | Public | List active suppliers (paginated) |
| GET | `/suppliers/:id` | None | Public | Get supplier detail with offers |
| GET | `/suppliers/admin` | JWT | ADMIN | List all suppliers with filtering |
| POST | `/suppliers` | JWT | ADMIN | Create a supplier |
| PATCH | `/suppliers/:id` | JWT | ADMIN | Update supplier fields |
| DELETE | `/suppliers/:id` | JWT | ADMIN | Soft-delete supplier |
| PATCH | `/suppliers/:id/toggle-status` | JWT | ADMIN | Toggle active/inactive status |
