# Authentication

EasyRisparmio supports two authentication methods: **email/password** and **social login** (Google, Facebook, Apple via Firebase). OTP codes are delivered via **Resend** email service. All auth endpoints are prefixed with `/api/v1/auth`.

## Table of Contents

- [Roles](#roles)
- [Registration](#registration)
- [Email/Password Login](#emailpassword-login)
- [Social Login (Firebase)](#social-login-firebase)
- [OTP Verification](#otp-verification)
- [Password Reset](#password-reset)
- [Token Management](#token-management)
- [Admin Account](#admin-account)
- [Account Linking](#account-linking)
- [Rate Limiting](#rate-limiting)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Security Notes](#security-notes)

---

## Roles

| Role | Description |
|------|-------------|
| `PERSONAL` | Individual user (default for registration and social login) |
| `BUSINESS` | Business user with company profile (Partita IVA, PEC, etc.) |
| `ADMIN` | Platform administrator. Cannot register via API; seeded from environment variables |

Roles are enforced via `@Roles()` decorator and `RolesGuard` on protected endpoints.

---

## Registration

Users register as either `PERSONAL` or `BUSINESS` using a single endpoint. The `role` field in the request body determines which fields are required. Admin registration is blocked.

```
POST /api/v1/auth/register
```

**Rate limit:** 5 requests per minute per IP.

### Personal Registration Example

```json
{
  "email": "mario.rossi@email.com",
  "password": "StrongP@ss1",
  "firstName": "Mario",
  "lastName": "Rossi",
  "phone": "+393331234567",
  "role": "personal"
}
```

### Business Registration Example

When `role` is `business`, the business-specific fields are conditionally validated via `@ValidateIf` -- `companyName` and `partitaIva` become required.

```json
{
  "email": "info@rossi-srl.it",
  "password": "StrongP@ss1",
  "firstName": "Mario",
  "lastName": "Rossi",
  "phone": "+393331234567",
  "role": "business",
  "companyName": "Rossi S.r.l.",
  "partitaIva": "12345678901",
  "pecEmail": "rossi@pec.it",
  "legalRepresentative": "Mario Rossi",
  "companyType": "S.r.l.",
  "atecoCode": "35.11.00"
}
```

### Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Min 8 chars, must include uppercase, lowercase, number, and special character |
| `firstName` | string | Yes | Max 100 characters |
| `lastName` | string | Yes | Max 100 characters |
| `phone` | string | No | Max 20 characters |
| `role` | string | Yes | `personal` or `business` (determines which additional fields are required) |
| `referralCode` | string | No | 8-char referral code from existing user |
| `companyName` | string | Yes (if business) | Max 255 characters |
| `partitaIva` | string | Yes (if business) | Exactly 11 digits |
| `pecEmail` | string | No (business only) | Valid email format |
| `legalRepresentative` | string | No (business only) | Max 255 characters |
| `companyType` | string | No (business only) | Max 100 characters |
| `atecoCode` | string | No (business only) | Max 10 characters |

**Response (201):**

```json
{
  "success": true,
  "data": {
    "message": "Registration successful. Please verify your email.",
    "user": {
      "id": "uuid",
      "email": "mario.rossi@email.com",
      "firstName": "Mario",
      "lastName": "Rossi",
      "role": "personal",
      "status": "pending_verification",
      "emailVerified": false
    }
  }
}
```

After registration, a 6-digit OTP is generated and **sent to the user's email via Resend**. The user must call `POST /auth/verify-otp` to activate their account.

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | Role is `admin` |
| 400 | Password does not meet complexity requirements |
| 400 | Missing required business fields when `role` is `business` |
| 409 | Email already registered |
| 429 | Rate limit exceeded |

---

## Email/Password Login

```
POST /api/v1/auth/login
```

**Rate limit:** 10 requests per minute per IP.

**Request Body:**

```json
{
  "email": "mario.rossi@email.com",
  "password": "StrongP@ss1"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "mario.rossi@email.com",
      "firstName": "Mario",
      "lastName": "Rossi",
      "role": "personal",
      "status": "active",
      "authProvider": "local"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

The client IP address and User-Agent are stored with the refresh token for security auditing.

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 401 | Invalid email or password |
| 401 | Account is `pending_verification` (email not verified yet) |
| 401 | Account is `suspended` |
| 429 | Rate limit exceeded |

Social-only users (no password set) attempting email/password login will receive an "Invalid email or password" error.

---

## Social Login (Firebase)

Social login supports **Google**, **Facebook**, and **Apple** via Firebase Authentication. The mobile app handles the provider-specific auth UI and obtains a Firebase ID token, which is sent to the backend for verification.

```
POST /api/v1/auth/social-login
```

**Request Body:**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-------------|
| `idToken` | string | Yes | Firebase ID token, max 4096 characters |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "mario.rossi@gmail.com",
      "firstName": "Mario",
      "lastName": "Rossi",
      "role": "personal",
      "status": "active",
      "authProvider": "google",
      "firebaseUid": "abc123def456",
      "emailVerified": true,
      "avatar": "https://lh3.googleusercontent.com/..."
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### How It Works

1. Mobile app initiates social sign-in (Google/Facebook/Apple) using Firebase Auth SDK
2. Firebase returns an ID token to the mobile app
3. Mobile app sends the ID token to `POST /auth/social-login`
4. Server verifies the token with `firebase-admin` SDK
5. Server extracts user info (email, name, avatar, provider) from the decoded token
6. Avatar URLs are validated (HTTPS only) before storage
7. If the user exists (by `firebaseUid` or `email`), they are logged in
8. If the user is new, an account is created with `role: personal`, `status: active`, `emailVerified: true`
9. JWT access token and refresh token are returned

### Auth Providers

The `authProvider` field indicates how the user originally created their account:

| Provider | Value | Firebase `sign_in_provider` |
|----------|-------|-----------------------------|
| Email/Password | `local` | - |
| Google | `google` | `google.com` |
| Facebook | `facebook` | `facebook.com` |
| Apple | `apple` | `apple.com` |

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | Firebase ID token is invalid or expired |
| 400 | Social account has no email address |
| 401 | Account is `suspended` |
| 500 | Firebase is not configured on the server |

---

## OTP Verification

Used for email verification after registration, phone verification, and password reset. OTP codes are sent via **Resend** email service.

```
POST /api/v1/auth/verify-otp
```

**Rate limit:** 5 requests per minute per IP.

**Request Body:**

```json
{
  "email": "mario.rossi@email.com",
  "code": "123456",
  "type": "email_verification"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `email` | string | Yes | User's email |
| `code` | string | Yes | 6-digit OTP code |
| `type` | string | Yes | `email_verification`, `phone_verification`, or `password_reset` |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "OTP verified successfully"
  }
}
```

### OTP Behavior

- Codes are 6 digits, generated with `crypto.randomInt()` (cryptographically secure)
- Valid for **10 minutes**
- Single-use: marked as used after successful verification
- Generating a new OTP invalidates any previous unused OTPs of the same type
- **Brute-force protection:** Maximum 5 failed attempts per OTP code. After 5 failures, the code is locked and the user must request a new one
- **User enumeration prevention:** Returns the same error message ("Invalid or expired OTP code") whether the email exists or not
- `email_verification`: sets `emailVerified: true` and `status: active`
- `phone_verification`: sets `phoneVerified: true`

---

## Password Reset

### Step 1: Request Reset Code

```
POST /api/v1/auth/forgot-password
```

**Rate limit:** 3 requests per minute per IP.

**Request Body:**

```json
{
  "email": "mario.rossi@email.com"
}
```

**Response (200):** Always returns the same message regardless of whether the email exists (prevents user enumeration). OTP code is sent via email if user exists.

```json
{
  "success": true,
  "data": {
    "message": "If the email is registered, a password reset code has been sent"
  }
}
```

### Step 2: Reset Password with OTP

```
POST /api/v1/auth/reset-password
```

**Rate limit:** 5 requests per minute per IP.

**Request Body:**

```json
{
  "email": "mario.rossi@email.com",
  "code": "123456",
  "newPassword": "NewStrongP@ss1"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | Yes | User's email |
| `code` | string | Yes | 6-digit OTP code |
| `newPassword` | string | Yes | Min 8 chars, must include uppercase, lowercase, number, and special character |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}
```

After a successful password reset, all existing refresh tokens for the user are revoked. Brute-force protection (5 max attempts) applies to the OTP code.

---

## Token Management

### Access Token

- **Type:** JWT (JSON Web Token)
- **Sent via:** `Authorization: Bearer <token>` header
- **Expiry:** Configurable via `JWT_EXPIRES_IN_SECONDS` (default: 900 seconds / 15 minutes)
- **Payload:**
  ```json
  {
    "sub": "user-uuid",
    "email": "mario.rossi@email.com",
    "role": "personal"
  }
  ```

### Refresh Token

- **Type:** UUID string (generated with `crypto.randomUUID()`)
- **Storage:** Database (`refresh_tokens` table) with IP address and User-Agent
- **Expiry:** Configurable via `JWT_REFRESH_EXPIRATION_DAYS` (default: 7 days)
- **Revocable:** Yes, tokens have a `revoked` boolean flag

### Refresh Token Rotation

```
POST /api/v1/auth/refresh-token
```

**Request Body:**

```json
{
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "new-uuid-token"
  }
}
```

The rotation is performed within a **database transaction**: new tokens are generated before the old token is revoked, ensuring no session loss on failure. If the refresh token is invalid, expired, or already revoked, a `401 Unauthorized` is returned.

### Get Current User Profile

```
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "mario.rossi@email.com",
    "firstName": "Mario",
    "lastName": "Rossi",
    "role": "personal",
    "authProvider": "local",
    "status": "active",
    "emailVerified": true,
    "phoneVerified": false,
    "businessProfile": null
  }
}
```

The `passwordHash` field is never included in any API response.

---

## Admin Account

The admin account cannot be created through any API endpoint. It is auto-seeded on application startup using environment variables.

### How It Works

1. On application bootstrap, the `AdminSeederService` runs
2. It reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from environment variables
3. If both are set and no user with that email exists, it creates the admin account
4. If the admin already exists or env vars are missing, it skips silently

### Configuration

```env
ADMIN_EMAIL=admin@easyresparmio.it
ADMIN_PASSWORD=ChangeThisSecurePassword123!
```

The seeded admin has:
- `role: admin`
- `status: active`
- `emailVerified: true`
- `authProvider: local`

The admin logs in using the standard `POST /auth/login` endpoint with email and password.

---

## Account Linking

When a user signs in via social login with an email that already exists in the system:

| Scenario | Behavior |
|----------|----------|
| New social user (no existing account) | New account created: `authProvider` set to provider, `passwordHash: null`, `status: active` |
| Existing email/password user signs in via social | Firebase UID linked to existing account. User retains their password and can use either login method |
| Existing social user signs in again | Looked up by `firebaseUid`, logged in directly |
| Social-only user tries email/password login | Returns "Invalid email or password" (no password set) |
| Suspended user tries social login | Returns "Your account has been suspended" |

When linking, the social profile avatar is applied only if the user doesn't already have one. Avatar URLs are validated (HTTPS only).

---

## Rate Limiting

Auth endpoints have per-endpoint rate limits to prevent brute-force attacks:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/register` | 5 requests | 1 minute |
| `POST /auth/login` | 10 requests | 1 minute |
| `POST /auth/verify-otp` | 5 requests | 1 minute |
| `POST /auth/forgot-password` | 3 requests | 1 minute |
| `POST /auth/reset-password` | 5 requests | 1 minute |

Rate limits are enforced per IP via `@nestjs/throttler`. Exceeding the limit returns `429 Too Many Requests`.

---

## API Reference

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/auth/register` | No | 5/min | Register user (personal or business, determined by `role` field) |
| POST | `/auth/login` | No | 10/min | Email/password login |
| POST | `/auth/social-login` | No | Global | Social login via Firebase ID token |
| POST | `/auth/verify-otp` | No | 5/min | Verify OTP code |
| POST | `/auth/forgot-password` | No | 3/min | Request password reset OTP |
| POST | `/auth/reset-password` | No | 5/min | Reset password with OTP |
| POST | `/auth/refresh-token` | No | Global | Refresh access token |
| GET | `/auth/me` | JWT | Global | Get current user profile |

All responses follow the standard format:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "statusCode": 401, "message": ["..."], "timestamp": "..." }
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Secret key for signing JWT access tokens (use a strong random string) |
| `JWT_EXPIRES_IN_SECONDS` | No | `900` | Access token expiry in seconds (15 min) |
| `JWT_REFRESH_EXPIRATION_DAYS` | No | `7` | Refresh token expiry in days |
| `RESEND_API_KEY` | Yes* | - | Resend API key for sending OTP emails |
| `EMAIL_FROM` | No | `EasyRisparmio <noreply@easyresparmio.it>` | Sender address for emails |
| `FIREBASE_PROJECT_ID` | No** | - | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | No** | - | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | No** | - | Firebase service account private key (with `\n` for newlines) |
| `ADMIN_EMAIL` | No*** | - | Admin user email for auto-seeding |
| `ADMIN_PASSWORD` | No*** | - | Admin user password for auto-seeding |
| `OTP_EXPIRY_MINUTES` | No | `10` | OTP code expiry in minutes |

\* If not configured, OTP codes are logged to console (development mode). Email delivery will not work.
\** Required for social login to work. If missing, the app starts normally but social login returns 500.
\*** Required for admin account creation. If missing, no admin is seeded.

---

## Security Notes

- **Password hashing:** bcrypt with 10 salt rounds
- **Password policy:** Minimum 8 characters, must include uppercase, lowercase, number, and special character
- **Password never exposed:** `passwordHash` is stripped from all API responses
- **OTP generation:** Uses `crypto.randomInt()` (cryptographically secure), not `Math.random()`
- **OTP brute-force protection:** Maximum 5 failed attempts per OTP code; code is locked after exceeding limit
- **OTP delivery:** Sent via Resend email service with branded HTML templates
- **Token generation:** Refresh tokens use `crypto.randomUUID()` (cryptographically secure)
- **Token rotation:** Performed within a database transaction to prevent race conditions and session loss
- **Device tracking:** Client IP and User-Agent stored with refresh tokens for security auditing
- **Token revocation:** Refresh tokens are revoked on password reset and during token rotation
- **User enumeration prevention:** `forgot-password` and `verify-otp` return generic error messages regardless of whether the email exists
- **Admin protection:** Admin role cannot be assigned via registration or social login (always defaults to `personal`)
- **Firebase token verification:** ID tokens are verified server-side using the Firebase Admin SDK. The server never trusts the client-provided provider or claims
- **Avatar validation:** Social login avatar URLs are validated (HTTPS only) before storage
- **Input limits:** Firebase ID tokens capped at 4096 characters to prevent payload DoS
- **Nullable passwords:** Social-only users have `passwordHash: null`. The `validateUser` method handles this safely without runtime errors
- **Suspended accounts:** Both login methods check account status and reject suspended users
- **Rate limiting:** Per-endpoint throttling on all sensitive auth endpoints (registration, login, OTP, password reset)
- **CORS:** Localhost origins restricted to development environment only
