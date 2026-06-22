# Referrals (Invite & Earn)

The referral program lets users invite friends and earn €10 per qualified referral. All referral endpoints are prefixed with `/api/v1/referrals`.

## Table of Contents

- [How It Works](#how-it-works)
- [Referral Lifecycle](#referral-lifecycle)
- [User Endpoints](#user-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [Registration Integration](#registration-integration)
- [API Reference](#api-reference)

---

## How It Works

1. User opens Profile → "Invite & Earn" on the mobile app
2. Gets a unique 8-character referral code and shareable link
3. Shares the link or sends targeted invites (email/phone)
4. When the referred person registers with the code, the referral status updates automatically
5. Admin qualifies and rewards the referral (€10 per qualified referral)

---

## Referral Lifecycle

```
PENDING → REGISTERED → QUALIFIED → REWARDED
   ↓          ↓            ↓
 EXPIRED    EXPIRED      EXPIRED
```

| Status | Description |
|--------|-------------|
| `pending` | Invite created, awaiting referred person's registration |
| `registered` | Referred person signed up using the code |
| `qualified` | Admin confirmed the referral meets qualification criteria |
| `rewarded` | Reward credited (€10). `rewardAmount` and `rewardCreditedAt` are set |
| `expired` | Referral expired or was manually expired by admin |

- `rewarded` and `expired` are **terminal states** — no further transitions allowed
- Invites expire after **90 days** if not used
- Referral codes are 8-character alphanumeric (uppercase, ambiguity-free charset)

---

## User Endpoints

All user endpoints require JWT authentication and `personal` or `business` role.

### Get My Referral Code

```
GET /api/v1/referrals/my-code
Authorization: Bearer <access_token>
```

Returns the user's referral code, share link, and stats. Auto-generates a code on first call.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "referralCode": "AB3KX7WN",
    "shareLink": "http://localhost:3001/register?ref=AB3KX7WN",
    "stats": {
      "totalInvites": 5,
      "registered": 3,
      "qualified": 1,
      "rewarded": 1,
      "totalEarnings": 10
    }
  }
}
```

### List My Referrals

```
GET /api/v1/referrals/my-referrals?page=1&limit=20&status=registered
Authorization: Bearer <access_token>
```

Returns paginated list of the user's referrals with referred user details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `status` | string | No | Filter: `pending`, `registered`, `qualified`, `rewarded`, `expired` |

### Create Invite

```
POST /api/v1/referrals/invite
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "referredEmail": "friend@email.com",
  "referredPhone": "+393339876543"
}
```

Both fields are optional:
- **With email/phone** — targeted invite for a specific person
- **Without** — generic invite, anyone with the code can use it

Creates a `pending` referral that expires in 90 days. The user's referral code is auto-generated if they don't have one.

---

## Admin Endpoints

All admin endpoints require JWT authentication and `admin` role.

### Get Referral Stats

```
GET /api/v1/referrals/stats
Authorization: Bearer <admin_access_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "totalReferrals": 150,
    "pending": 45,
    "registered": 60,
    "qualified": 25,
    "rewarded": 15,
    "expired": 5,
    "totalRewardsPaid": 150
  }
}
```

### List All Referrals

```
GET /api/v1/referrals?page=1&limit=20&status=registered&search=mario
Authorization: Bearer <admin_access_token>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `status` | string | No | Filter by status |
| `referrerId` | uuid | No | Filter by referrer user ID |
| `dateFrom` | string | No | ISO 8601 start date |
| `dateTo` | string | No | ISO 8601 end date |
| `search` | string | No | Search referrer name/email or referral code |

### Get Referral Detail

```
GET /api/v1/referrals/:id
Authorization: Bearer <admin_access_token>
```

Returns full referral with referrer and referred user relations.

### Update Referral Status

```
PATCH /api/v1/referrals/:id/status
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Qualify a referral:**
```json
{
  "status": "qualified"
}
```

**Reward a referral (€10):**
```json
{
  "status": "rewarded",
  "rewardAmount": 10
}
```

**Expire a referral:**
```json
{
  "status": "expired"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | Target status |
| `rewardAmount` | number | When REWARDED | Reward amount in EUR |

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid status transition (e.g., `pending` → `rewarded`) |
| 400 | Missing `rewardAmount` when setting `rewarded` |
| 404 | Referral not found |

---

## Registration Integration

The `POST /auth/register` endpoint accepts an optional `referralCode` field. The same endpoint handles both personal and business registration (the `role` field determines which fields are required):

```json
{
  "email": "newuser@email.com",
  "password": "StrongP@ss1",
  "firstName": "Giulia",
  "lastName": "Bianchi",
  "role": "personal",
  "referralCode": "AB3KX7WN"
}
```

When a valid referral code is provided:
1. The system finds a matching pending referral (targeted by email or generic)
2. If no pending referral exists but the code belongs to a user, a new referral record is created
3. The referral status is updated to `registered` and `referredUserId` is linked
4. If the code is invalid, registration still succeeds — the referral just isn't linked

---

## API Reference

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/referrals/my-code` | JWT | PERSONAL, BUSINESS | Get/generate referral code + stats |
| GET | `/referrals/my-referrals` | JWT | PERSONAL, BUSINESS | List user's referrals (paginated) |
| POST | `/referrals/invite` | JWT | PERSONAL, BUSINESS | Create referral invite |
| GET | `/referrals/stats` | JWT | ADMIN | Referral program KPIs |
| GET | `/referrals` | JWT | ADMIN | List all referrals (paginated) |
| GET | `/referrals/:id` | JWT | ADMIN | Get referral detail |
| PATCH | `/referrals/:id/status` | JWT | ADMIN | Update referral status |
