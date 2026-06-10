# Agreements

Agreements represent exclusive partner discounts shown to users in the mobile app. Admin creates and manages partner agreements, controlling which ones are visible to personal vs business users. Users access agreements from the Profile screen under "Others". All endpoints are prefixed with `/api/v1/agreements`.

## Table of Contents

- [Agreement Fields](#agreement-fields)
- [Target Audience](#target-audience)
- [User Endpoints](#user-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [API Reference](#api-reference)

---

## Agreement Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Primary key |
| `title` | string | Yes | Agreement title (max 255) |
| `description` | text | No | Agreement description |
| `partnerName` | string | Yes | Partner company name (max 255) |
| `partnerLogoUrl` | string | No | Partner logo URL (max 500) |
| `discountDescription` | text | No | Details of the discount or benefit |
| `termsUrl` | string | No | URL to full terms & conditions (max 500) |
| `isActive` | boolean | No | Whether visible to users (default: true) |
| `targetAudience` | enum | No | `personal`, `business`, `both` (default: both) |
| `validFrom` | date | Yes | Start date (ISO 8601) |
| `validUntil` | date | No | End date (null = no expiry) |
| `sortOrder` | int | No | Display order, lower first (default: 0) |
| `createdBy` | UUID | Auto | Admin who created |
| `updatedBy` | UUID | Auto | Admin who last updated |
| `createdAt` | timestamp | Auto | Creation timestamp |
| `updatedAt` | timestamp | Auto | Last update timestamp |

---

## Target Audience

| Target | Value | Description |
|--------|-------|-------------|
| Personal | `personal` | Visible only to personal (residential) users |
| Business | `business` | Visible only to business users |
| Both | `both` | Visible to all users |

---

## User Endpoints

Requires JWT authentication with `personal` or `business` role. Accessed from the Profile screen in the mobile app.

### List My Agreements

```
GET /api/v1/agreements/my-agreements
Authorization: Bearer <access_token>
```

Returns active agreements matching the user's role and within validity dates. No pagination — typically 5-15 agreements. Sorted by `sortOrder` ascending, then by creation date.

**Filtering logic:**
- `isActive = true`
- `targetAudience` matches user's role or is `both`
- `validFrom <= today`
- `validUntil` is null (no expiry) or `>= today`

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "ag1a2b3c-d5e6-7890-abcd-ef1234567890",
      "title": "20% Off on Enel Smart Home Kit",
      "description": "Exclusive discount on smart home energy monitoring devices",
      "partnerName": "Enel X",
      "partnerLogoUrl": "https://cdn.easyresparmio.it/partners/enel-x.png",
      "discountDescription": "20% off on all smart home kits. Use code EASY20 at checkout.",
      "termsUrl": "https://www.enelx.com/terms/easy-risparmio",
      "isActive": true,
      "targetAudience": "both",
      "validFrom": "2026-01-01",
      "validUntil": "2026-12-31",
      "sortOrder": 1,
      "createdAt": "2026-06-01T10:00:00.000Z"
    }
  ]
}
```

### Get Agreement Detail

```
GET /api/v1/agreements/my-agreements/:id
Authorization: Bearer <access_token>
```

Returns full details of a specific agreement. Only returns if active, matching role, and within validity. 404 otherwise.

---

## Admin Endpoints

All admin endpoints require JWT authentication with `admin` role.

### List All Agreements (Admin)

```
GET /api/v1/agreements/admin?page=1&limit=20&isActive=true&targetAudience=personal
Authorization: Bearer <admin_access_token>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `isActive` | boolean | No | Filter by active status |
| `targetAudience` | enum | No | Filter: `personal`, `business`, `both` |
| `search` | string | No | Search by title, partner name, or description |

Returns all agreements (active and inactive), sorted by sort order then creation date.

### Get Agreement Detail (Admin)

```
GET /api/v1/agreements/admin/:id
Authorization: Bearer <admin_access_token>
```

Returns any agreement regardless of status or validity dates. 404 if not found.

### Create Agreement

```
POST /api/v1/agreements
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

```json
{
  "title": "20% Off on Enel Smart Home Kit",
  "description": "Exclusive discount on smart home energy monitoring devices",
  "partnerName": "Enel X",
  "partnerLogoUrl": "https://cdn.easyresparmio.it/partners/enel-x.png",
  "discountDescription": "20% off on all smart home kits. Use code EASY20 at checkout.",
  "termsUrl": "https://www.enelx.com/terms/easy-risparmio",
  "targetAudience": "both",
  "validFrom": "2026-01-01",
  "validUntil": "2026-12-31",
  "sortOrder": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Agreement title (max 255) |
| `partnerName` | string | Yes | Partner name (max 255) |
| `validFrom` | date | Yes | Start date (ISO 8601) |
| `description` | string | No | Description |
| `partnerLogoUrl` | URL | No | Partner logo (max 500) |
| `discountDescription` | string | No | Discount details |
| `termsUrl` | URL | No | Terms URL (max 500) |
| `isActive` | boolean | No | Active flag (default: true) |
| `targetAudience` | enum | No | Target: personal, business, both (default: both) |
| `validUntil` | date | No | End date |
| `sortOrder` | int | No | Display order (default: 0) |

### Update Agreement

```
PATCH /api/v1/agreements/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

```json
{
  "discountDescription": "25% off — increased discount!",
  "sortOrder": 0
}
```

All fields are optional (PartialType). The `updatedBy` field is auto-set.

### Toggle Status (Show/Hide)

```
PATCH /api/v1/agreements/:id/toggle-status
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Show to users:**
```json
{ "isActive": true }
```

**Hide from users:**
```json
{ "isActive": false }
```

### Soft-Delete Agreement

```
DELETE /api/v1/agreements/:id
Authorization: Bearer <admin_access_token>
```

Sets `deleted_at` timestamp. Hidden from all queries but preserved in database.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Agreement deleted successfully"
  }
}
```

---

## API Reference

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/agreements/my-agreements` | JWT | PERSONAL, BUSINESS | List user's available agreements |
| GET | `/agreements/my-agreements/:id` | JWT | PERSONAL, BUSINESS | Get agreement detail (user) |
| GET | `/agreements/admin` | JWT | ADMIN | List all agreements (paginated) |
| GET | `/agreements/admin/:id` | JWT | ADMIN | Get agreement detail (admin) |
| POST | `/agreements` | JWT | ADMIN | Create agreement |
| PATCH | `/agreements/:id` | JWT | ADMIN | Update agreement fields |
| PATCH | `/agreements/:id/toggle-status` | JWT | ADMIN | Toggle active/inactive |
| DELETE | `/agreements/:id` | JWT | ADMIN | Soft-delete agreement |
