# EasyRisparmio API

Backend server for **EasyRisparmio** — an Italian energy utility comparison and switching platform. Built with [NestJS](https://nestjs.com/), [TypeORM](https://typeorm.io/), and [PostgreSQL](https://www.postgresql.org/).

Serves a mobile app (personal and business users) and an admin web panel for managing energy offers, supplier contracts, switching cases, and commissions.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Seeding](#database-seeding)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Authentication](#authentication)
- [API Response Format](#api-response-format)

---

## Tech Stack

| Layer            | Technology                          |
| ---------------- | ----------------------------------- |
| Framework        | NestJS 11                           |
| Language         | TypeScript 5                        |
| Database         | PostgreSQL 16                       |
| ORM              | TypeORM                             |
| Authentication   | Passport.js (JWT + Local strategy)  |
| Social Login     | Firebase Admin SDK                  |
| Email            | Nodemailer (SMTP) / Resend (API)    |
| Validation       | class-validator / class-transformer |
| Documentation    | Swagger (OpenAPI)                   |
| Rate Limiting    | @nestjs/throttler                   |
| Testing          | Jest + Supertest                    |

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **PostgreSQL** 16+ (or use Docker)
- **Docker & Docker Compose** (optional, for local services)

---

## Getting Started

### 1. Clone the repository

```bash
git clone git@github.com:abubakar1010/easyrisparmio-backend.git
cd easyrisparmio-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your database credentials, JWT secrets, and other configuration values.

### 4. Start local services (PostgreSQL + MailHog)

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on port `5433`
- **MailHog** SMTP on port `1026`, Web UI on [http://localhost:4000](http://localhost:4000)

### 5. Run the development server

```bash
npm run start:dev
```

The API will be available at [http://localhost:3000/api/v1](http://localhost:3000/api/v1).

---

## Environment Variables

See [`.env.example`](.env.example) for all available variables. Key groups:

| Variable Group    | Description                                         |
| ----------------- | --------------------------------------------------- |
| `APP_*`           | Port, environment, app name                         |
| `DATABASE_URL`    | PostgreSQL connection string                        |
| `JWT_*`           | Access & refresh token secrets and expiration        |
| `SMTP_*`          | SMTP config (MailHog for dev)                       |
| `RESEND_API_KEY`  | Resend API key (production email)                   |
| `FIREBASE_*`      | Firebase service account for social login            |
| `ADMIN_EMAIL/PASSWORD` | Auto-seeded admin credentials                  |

---

## Database Seeding

Seed the database with sample data:

```bash
npm run seed
```

Reset and re-seed:

```bash
npm run seed:reset
```

> The admin account is auto-seeded on server startup using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`.

---

## API Documentation

Interactive Swagger docs are available at:

```
http://localhost:3000/api/docs
```

All endpoints are prefixed with `/api/v1`.

---

## Project Structure

```
src/
├── common/                  # Shared utilities
│   ├── decorators/          # Custom decorators (@CurrentUser, @Roles)
│   ├── dto/                 # Shared DTOs (PaginationDto)
│   ├── entities/            # Base entity (UUID PK, timestamps)
│   ├── enums/               # Centralized enum definitions
│   ├── filters/             # Global exception filter
│   ├── guards/              # JWT & Roles guards
│   ├── interceptors/        # Response transform interceptor
│   └── pipes/               # Custom validation pipes
├── config/                  # Configuration modules (app, database, jwt)
├── database/
│   └── seed/                # Database seeder
├── modules/
│   ├── activity-log/        # Activity logging (service-only, no controller)
│   ├── agreements/          # Exclusive partner agreements
│   ├── alerts/              # Admin alert system
│   ├── auth/                # Authentication & registration
│   ├── bills/               # Energy bill upload & AI analysis
│   ├── cases/               # Supplier switching case management
│   ├── commissions/         # Agent commission tracking & tiers
│   ├── contracts/           # Customer contract management
│   ├── dashboard/           # Admin analytics & KPIs
│   ├── email/               # Email service (SMTP/Resend)
│   ├── file-upload/         # File upload handling
│   ├── market-data/         # Italian energy market indices (PUN/GME)
│   ├── meters/              # Utility meter management (POD/PDR)
│   ├── notifications/       # Push & in-app notifications
│   ├── offers/              # Energy offer comparison
│   ├── reconciliation/      # CSV reconciliation processing
│   ├── referrals/           # Referral program & invite tracking
│   ├── suppliers/           # Energy supplier management
│   ├── support/             # Support tickets & FAQ
│   └── users/               # User profiles & preferences
├── app.module.ts
└── main.ts
```

Each module follows the pattern: **Entity + DTO + Service + Controller + Module**.

---

## Available Scripts

| Command                | Description                            |
| ---------------------- | -------------------------------------- |
| `npm run start:dev`    | Start dev server with hot reload       |
| `npm run build`        | Compile TypeScript                     |
| `npm run start:prod`   | Run compiled production build          |
| `npm test`             | Run unit tests                         |
| `npm run test:watch`   | Run tests in watch mode                |
| `npm run test:cov`     | Run tests with coverage report         |
| `npm run test:e2e`     | Run end-to-end tests                   |
| `npm run lint`         | Lint and auto-fix with ESLint          |
| `npm run format`       | Format code with Prettier              |
| `npm run seed`         | Seed database with sample data         |
| `npm run seed:reset`   | Reset and re-seed database             |

---

## Authentication

The API supports three authentication methods:

### Email/Password
Standard registration and login with bcrypt-hashed passwords and email verification via OTP.

### Social Login
Google, Facebook, and Apple sign-in via Firebase. The mobile app sends a Firebase ID token to `POST /api/v1/auth/social-login`, and the server verifies it using Firebase Admin SDK.

### User Roles

| Role       | Description                                      |
| ---------- | ------------------------------------------------ |
| `PERSONAL` | Individual residential energy consumers          |
| `BUSINESS` | Business/commercial energy consumers             |
| `ADMIN`    | Platform administrator (auto-seeded, cannot register) |

Protected routes use `JwtAuthGuard` + `RolesGuard` with the `@Roles()` decorator.

---

## API Response Format

All successful responses are wrapped in a consistent format:

```json
{
  "success": true,
  "data": { }
}
```

Error responses:

```json
{
  "success": false,
  "statusCode": 400,
  "message": ["Validation error details"],
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Paginated responses include metadata:

```json
{
  "success": true,
  "data": {
    "data": [],
    "meta": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10
    }
  }
}
```

---

## License

This project is proprietary and unlicensed for public use.
