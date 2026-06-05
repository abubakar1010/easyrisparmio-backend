# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

EasyRisparmio backend - an Italian energy utility comparison & switching platform. NestJS + PostgreSQL (TypeORM). Serves a mobile app (personal + business users) and an admin web panel.

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

Four roles: `PERSONAL`, `BUSINESS`, `ADMIN`, `AGENT`. JWT access + refresh token rotation.

Protect routes with:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
```
Inject authenticated user with `@CurrentUser() user: User`.

### Module Pattern

Each domain module follows: Entity + DTO + Service + Controller + Module. 14 modules total under `src/modules/`.

Key cross-module imports:
- `AuthModule` imports `UsersModule`
- `OffersModule` imports `BillsModule` (for recommended offers by bill)
- `DashboardModule` imports entities from Users, Cases, Contracts, Commissions via `TypeOrmModule.forFeature()`
- `ActivityLogModule` has no controller - service-only, exported for use by other modules

### Entity Conventions

All entities extend `BaseEntity` (uuid PK, `created_at`, `updated_at`). Exceptions: `ActivityLog` (no updatedAt), `MarketIndex` (custom PK).

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

Database uses `autoLoadEntities: true` and `synchronize: true` in dev mode only.

### Italian Energy Domain Terms

POD = electricity delivery point ID. PDR = gas delivery point ID. Codice Fiscale = tax ID. Partita IVA = VAT number. PUN/GME = energy market price indices.
