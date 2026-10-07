# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VYZI backend - an Italian energy utility comparison & switching platform. NestJS + PostgreSQL (TypeORM). Serves a mobile app (personal + business users) and an admin web panel.

## Commands

```bash
npm run start:dev        # Dev server with watch mode
npm run build            # TypeScript compilation (nest build)
npm test                 # Jest unit tests
npm run test:e2e         # E2E tests
npm run lint             # ESLint with auto-fix
npm run format           # Prettier
```

## Commit Guideline
 - never use `Co-Authored-By: Claude` or something like this.
 - always commit and push after your work
 - commit message should be in the format: `feat: add new feature` or `fix: fix bug` etc.
 - use conventional commits.
 - never commit everything at once, do commit for each feature, module or fix. always follow conventional commits, principles and standards. always make sure your changes are tested before committing.
 
## Architecture

### API

- Global prefix: `api/v1`
- Swagger docs: `http://localhost:3000/api/docs`
- All responses wrapped in `{ success: true, data }` by `TransformInterceptor`
- Errors return `{ success: false, statusCode, message[], timestamp }` via `AllExceptionsFilter`

### Auth & Authorization

Three roles: `PERSONAL`, `BUSINESS`, `ADMIN`. JWT access + refresh token rotation.

- **Email/password**: Local strategy with bcrypt. Users register as PERSONAL or BUSINESS (admin cannot register).
- **Social login**: Google and Apple via Firebase; tokens from any other provider are refused. Mobile app sends Firebase ID token to `POST /auth/social-login`. Server verifies with `firebase-admin`.
- **Admin**: Single admin auto-seeded on startup from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars. Cannot register via API.
- **Account linking**: Social login with an existing email links the Firebase account to the existing user.

Protect routes with:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
```
Inject authenticated user with `@CurrentUser() user: User`.

### Module Pattern

Each domain module follows: Entity + DTO + Service + Controller + Module. 20 modules total under `src/modules/`.

Key cross-module imports:
- `AuthModule` imports `UsersModule`
- `OffersModule` imports `BillsModule` (for recommended offers by bill)
- `DashboardModule` imports entities from Users, Cases, Bills, Alerts and ActivityLog via `TypeOrmModule.forFeature()`
- `ActivityLogModule` has no controller - service-only, exported for use by other modules

There is no `commissions` module — `SYSTEM_FLOW.md` Phase 10 describes a feature
that was never built.

### Entity Conventions

All entities extend `BaseEntity` (uuid PK, `created_at`, `updated_at`). Exceptions: `ActivityLog` (no updatedAt).

- TypeScript: camelCase properties. DB: snake_case columns via `{ name: 'column_name' }`
- Enums stored as Postgres `enum` type
- Decimals: `{ type: 'decimal', precision: 10, scale: 2 }` for currency
- Nullable fields must be typed as `T | null` in the entity (strict null checks enabled)

### Enums

Centralized in `src/common/enums/`, barrel-exported from `index.ts`. Import as:
```typescript
import { UserRole, BillStatus } from '../../common/enums';
```

### Pagination

Query DTOs extend `PaginationDto` (page, limit, search). Services return `PaginatedResponseDto<T>` with `{ data, meta: { total, page, limit, totalPages } }`.

### Configuration

`@nestjs/config` with `registerAs()` pattern. Three config namespaces: `app`, `database`, `jwt`. Accessed via `configService.get('database.host')`. Environment variables defined in `.env.example`.

Database uses `autoLoadEntities: true`. `synchronize` runs in dev mode, and in production only when `DB_SYNCHRONIZE=true` (the production compose file sets it, since there are no migrations).

### Schema changes without migrations

There is no migrations directory. `AppModule` takes synchronisation over from
TypeORM via `dataSourceFactory` so that `src/database/pre-sync/index.ts` can run
raw SQL *between* connecting and syncing. Anything that must happen before the
schema is rewritten belongs there — in particular, removing a value from a
Postgres enum fails unless the rows using it have already been moved, and a
module's `onModuleInit` hook is far too late (sync happens inside `initialize()`).

Everything in `pre-sync` must be idempotent and must tolerate a database where
the table or column does not exist yet — it runs on empty databases too.
Destructive operations go in `scripts/` as documented manual SQL instead; see
`scripts/drop-legacy-contract-tables.sql`.

### Language (Italian first)

Italian is the default for every user-facing output: `resolveLocale()` in `src/common/middleware/locale.middleware.ts` returns `'it'` unless `Accept-Language` asks for English, and emails, push notifications and the `/r/:code` referral page follow it. Exception and validation messages stay in English because the mobile app matches some of them verbatim; the clients translate them. When you add or reword one, update the dashboard's catalogue in `vyzi_dashboard/src/utils/apiError.ts`.

### Italian Energy Domain Terms

POD = electricity delivery point ID. PDR = gas delivery point ID. Codice Fiscale = tax ID. Partita IVA = VAT number. PUN/GME = energy market price indices.
