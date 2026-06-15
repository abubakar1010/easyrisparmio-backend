# Bills

Bills represent uploaded energy bills (electricity or gas) on the EasyRisparmio platform. Users upload bills for analysis, which calculates potential savings and recommends offers. Admins can view all user bills. All endpoints are prefixed with `/api/v1/bills`.

## Table of Contents

- [Bill Types](#bill-types)
- [Bill Status Lifecycle](#bill-status-lifecycle)
- [Bill Fields](#bill-fields)
- [Analysis Fields](#analysis-fields)
- [User Endpoints](#user-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [API Reference](#api-reference)

---

## Bill Types

| Type | Value | ID Format | Unit |
|------|-------|-----------|------|
| Electricity | `electricity` | POD (e.g. IT001E12345678) | kWh |
| Gas | `gas` | PDR (e.g. GS002C87654321) | Smc |

---

## Bill Status Lifecycle

```
UPLOADED → ANALYZING → ANALYZED
                    ↘ ERROR
```

| Status | Description |
|--------|-------------|
| `uploaded` | Bill file uploaded, awaiting analysis |
| `analyzing` | AI analysis in progress |
| `analyzed` | Analysis complete, savings calculated |
| `error` | Analysis failed |

---

## Bill Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `fileUrl` | string | Uploaded file path/URL |
| `billType` | enum | `electricity` or `gas` |
| `status` | enum | Bill processing status |
| `podNumber` | string | Electricity delivery point ID |
| `pdrNumber` | string | Gas delivery point ID |
| `billingPeriodStart` | date | Billing period start |
| `billingPeriodEnd` | date | Billing period end |
| `totalAmount` | decimal | Total bill amount (EUR) |
| `consumptionKwh` | decimal | Electricity consumption |
| `consumptionSmc` | decimal | Gas consumption |
| `costPerUnit` | decimal | Cost per kWh or Smc |
| `fixedCharges` | decimal | Fixed monthly charges |
| `taxes` | decimal | Tax amount |
| `userId` | UUID | Bill owner |
| `supplierId` | UUID | Current supplier |
| `meterId` | UUID | Associated meter |

## Analysis Fields

| Field | Type | Description |
|-------|------|-------------|
| `potentialSavings` | decimal | Estimated EUR savings |
| `currentMonthlyAvg` | decimal | Current monthly average cost |
| `recommendedMarketType` | enum | `fixed`, `variable`, `indexed` |
| `analysisSummary` | text | Human-readable summary |
| `analysisDetails` | jsonb | Detailed breakdown with recommended actions |
| `confidenceScore` | decimal | Analysis quality metric |
| `recommendedOffers` | jsonb | Array of recommended offer data |

---

## User Endpoints

All user endpoints require JWT authentication.

### Upload Bill

```
POST /api/v1/bills/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | Bill PDF or image |
| `billType` | enum | Yes | `electricity` or `gas` |
| `podNumber` | string | No | POD number (electricity) |
| `pdrNumber` | string | No | PDR number (gas) |

Bill starts in `uploaded` status. Use `POST /bills/:id/analyze` to trigger analysis.

### List My Bills

```
GET /api/v1/bills?page=1&limit=20&billType=electricity&status=analyzed
Authorization: Bearer <access_token>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `billType` | enum | No | Filter by type |
| `status` | enum | No | Filter by status |
| `dateFrom` | date | No | Bills from this date |
| `dateTo` | date | No | Bills until this date |

### Get Bill Detail

```
GET /api/v1/bills/:id
Authorization: Bearer <access_token>
```

Returns bill with supplier and analysis. User must own the bill (403 otherwise).

### Get Bill Analysis

```
GET /api/v1/bills/:id/analysis
Authorization: Bearer <access_token>
```

Returns analysis results. 404 if analysis not yet triggered.

### Trigger Analysis

```
POST /api/v1/bills/:id/analyze
Authorization: Bearer <access_token>
```

Triggers AI analysis. Status transitions: `uploaded` → `analyzing` → `analyzed` (or `error`).

---

## Admin Endpoints

All admin endpoints require JWT authentication with `admin` role.

### List All Bills

```
GET /api/v1/bills/admin?page=1&limit=20&billType=electricity
Authorization: Bearer <admin_access_token>
```

Returns all user bills with user and supplier details. Supports text search by user email/name and POD/PDR number.

### Get Any Bill

```
GET /api/v1/bills/admin/:id
Authorization: Bearer <admin_access_token>
```

Returns any bill with user, supplier, and analysis. No ownership check.

---

## API Reference

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| POST | `/bills/upload` | JWT | Any | Upload an energy bill |
| GET | `/bills` | JWT | Any | List user's own bills |
| GET | `/bills/:id` | JWT | Any | Get bill by ID (ownership check) |
| GET | `/bills/:id/analysis` | JWT | Any | Get analysis results |
| POST | `/bills/:id/analyze` | JWT | Any | Trigger bill analysis |
| GET | `/bills/admin` | JWT | ADMIN | List all bills |
| GET | `/bills/admin/:id` | JWT | ADMIN | Get any bill by ID |
