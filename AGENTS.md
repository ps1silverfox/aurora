# Aurora CMS — TypeScript Edition
## AGENTS.md — Ralph Operating Instructions

---

## Project Identity

**Aurora CMS TS** is a full rewrite of Aurora CMS (originally Laravel/PHP) in TypeScript using NestJS and Oracle 19c. The goal is a more type-safe, Oracle-native implementation that eliminates external search (OpenSearch replaced by Oracle Text) and external messaging (NATS replaced by Oracle Advanced Queuing).

This file is authoritative. If TASK.md conflicts with AGENTS.md, AGENTS.md wins on environment and conventions; TASK.md wins on feature scope.

---

## Runtime Environment

### Node.js
- Node: >= 20.x LTS
- npm: >= 10.x
- TypeScript: 5.x strict mode
- Detect path: `where node` (Windows) or `which node` (Linux/WSL)
- Run scripts: `npm run <script>`

### Oracle 19c
- Driver: `oracledb` npm package (Thick mode — requires Oracle Instant Client)
- Oracle Instant Client path (Windows): `C:\oracle\instantclient_21_x` (confirm with `node -e "require('oracledb').initOracleClient()"`)
- Default DSN: `localhost:1521/ORCLPDB1` (configurable via `ORACLE_DSN` env var)
- Service name: `ORCLPDB1` (or `XEPDB1` for Oracle XE)
- Default schema/user: `AURORA_CMS` (configurable via `ORACLE_USER`)
- Connection pool: min 2, max 10, increment 2
- **Never use SYS or SYSTEM credentials for app operations**
- Character set: `AL32UTF8`

### Caching
- Valkey (Redis-compatible) at `valkey:6379` (or `localhost:6379` local dev)
- Use `ioredis` npm package

### Auth
- Keycloak OIDC at `http://keycloak:8080` (dev) / configurable via `KEYCLOAK_URL`
- Realm: `aurora`
- Client ID: `aurora-cms`
- JWT validation: `@nestjs/passport` + `passport-jwt`
- Public key fetched from Keycloak JWKS endpoint

### Storage
- Local disk (dev): `storage/media/`
- S3-compatible (prod): configurable via `STORAGE_DRIVER=s3`
- Use `@aws-sdk/client-s3` (Apache 2.0)

---

## Framework Conventions

### Backend: NestJS
- Module-per-feature: `src/auth/`, `src/content/`, `src/media/`, etc.
- Each module exports: `module.ts`, `controller.ts`, `service.ts`, `entities/`, `dto/`
- Dependency injection via constructor — no service locator pattern
- Use `@Injectable()`, `@Controller()`, `@Module()` decorators
- Guards: `JwtAuthGuard`, `RolesGuard` — apply at controller or route level
- Interceptors: logging, response transformation
- Pipes: `ValidationPipe` (global, `whitelist: true, forbidNonWhitelisted: true`)
- Exception filters: global `OracleExceptionFilter` maps Oracle error codes to HTTP status

### TypeScript
- Strict mode: `"strict": true` in `tsconfig.json`
- No `any` — use `unknown` and narrow. `any` fails lint.
- Interfaces for domain models, classes for DTOs (class-validator decorators)
- Enums as `const enum` for tree-shaking
- Result types: use `Result<T, E>` pattern for service methods that can fail cleanly
- All async methods must be `async/await` — no raw `.then()` chains

### Oracle 19c Patterns
- IDs: `RAW(16)` stored as `SYS_GUID()` default — map to UUID string in app layer
- Sequences: use Oracle sequences for numeric surrogate keys where needed
- JSON: stored as `CLOB` with `IS JSON` constraint (Oracle 19c). Use `JSON_VALUE`, `JSON_QUERY`, `JSON_TABLE` for querying
- Timestamps: `TIMESTAMP WITH TIME ZONE` — always store UTC
- Soft deletes: `DELETED_AT TIMESTAMP WITH TIME ZONE` nullable column
- Cursor pagination: use `ROWNUM` or `ROW_NUMBER() OVER (ORDER BY ...)` with bind variables
- Bind variables: **always** use bind variables — no string interpolation in SQL
- Audit log: hash-chained via PL/SQL trigger on `AUDIT_LOG` table — never insert directly
- Oracle Text: use `CTXSYS.CONTEXT` index on `CONTENT_SEARCH_IDX` — sync via `CTX_DDL.SYNC_INDEX`
- Oracle AQ: use `DBMS_AQ` package for event messaging — queue per topic

### Database Migrations
- Migration tool: custom TypeScript migration runner at `src/db/migrate.ts`
- Migration files: `oracle/migrations/NNNN_description.sql` (pure SQL, DDL only)
- Up-only migrations (no down). If you need to undo, write a new migration.
- Run migrations: `npm run db:migrate`
- Check applied: `SELECT * FROM SCHEMA_MIGRATIONS ORDER BY APPLIED_AT`
- All DDL must be idempotent (use `CREATE TABLE IF NOT EXISTS` equivalent via PL/SQL: `EXECUTE IMMEDIATE ... EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF`)

### API Design
- All routes under `/api/v1/`
- Response envelope: `{ data: T, meta?: PaginationMeta }` for success
- Error format: RFC 7807 `{ type, title, status, detail, instance }`
- Pagination: cursor-based. Response includes `meta.next_cursor` (base64-encoded)
- Versioning: URL-based (`/api/v1/`, `/api/v2/`) — do not break existing versions
- Auth header: `Authorization: Bearer <jwt>`

---

## Testing

### Unit Tests
- Framework: Jest + `@nestjs/testing`
- File naming: `*.spec.ts` co-located with source
- Run: `npm test`
- Coverage: `npm run test:cov`
- Target: 80%+ line coverage on services

### Integration Tests
- File naming: `*.integration.spec.ts` in `test/integration/`
- Use real Oracle connection (test schema: `AURORA_TEST`)
- Run: `npm run test:integration`
- Setup/teardown: truncate tables via `beforeEach`, run migrations once in `globalSetup`

### E2E Tests
- Framework: Playwright
- Config: `playwright.config.ts`
- Run: `npm run test:e2e`
- Tests in: `test/e2e/`

---

## Code Quality

### Linting
- ESLint: `npm run lint`
- Config: `eslint.config.ts` — extends `@typescript-eslint/recommended-strict`
- No `any`, no unused vars, no floating promises — all errors
- Prettier for formatting: `npm run format`
- Run both before committing

### Static Analysis
- `tsc --noEmit`: `npm run typecheck`
- Must pass with zero errors

### License Policy
- Allowed: MIT, Apache 2.0, BSD-2, BSD-3, ISC, 0BSD
- Prohibited: GPL, AGPL, SSPL, LGPL (any copyleft)
- Check new packages: `npm run license-check`
- Policy file: `license-policy.json`

---

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`):
1. `npm run lint` — fail on any error
2. `npm run typecheck` — fail on any error
3. `npm run license-check` — fail on prohibited licenses
4. `npm test` — unit tests
5. `npm run test:integration` — integration tests (needs Oracle service container)
6. `npm run build` — production build
7. `npm run test:e2e` — Playwright E2E (needs full stack)

Merge blocking: all jobs must pass.

---

## Forbidden Patterns

- No raw string SQL without bind variables
- No `process.exit()` in application code
- No synchronous file I/O in request path
- No Oracle DDL in application startup (use migrations)
- No direct writes to `AUDIT_LOG` table — use `AuditService.log()`
- No business logic in controllers — controllers route, services act
- No `console.log` in production code — use `Logger` from `@nestjs/common`
- No hardcoded credentials anywhere — read from `ConfigService`
- No `any` type without `// eslint-disable-next-line` + justification comment

---

## Directory Structure

```
cms-ts/
├── AGENTS.md                    # This file
├── TASK.md                      # Ralph task list
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── eslint.config.ts
├── jest.config.ts
├── playwright.config.ts
├── license-policy.json
├── docker-compose.yml
├── Dockerfile
├── oracle/
│   ├── migrations/              # DDL migration SQL files
│   └── packages/                # PL/SQL packages and procedures
├── src/
│   ├── main.ts                  # Bootstrap
│   ├── app.module.ts            # Root module
│   ├── config/                  # ConfigModule, typed config schemas
│   ├── db/                      # OracleModule, connection pool, migration runner
│   ├── common/                  # Guards, pipes, filters, decorators, Result type
│   ├── auth/                    # Keycloak JWT, guards, current-user decorator
│   ├── users/                   # User model, sync, roles, permissions
│   ├── audit/                   # AuditService, AuditLog entity
│   ├── content/                 # Pages, blocks, revisions, workflow, scheduler
│   ├── media/                   # Upload, variants, storage drivers
│   ├── search/                  # Oracle Text indexing and search service
│   ├── events/                  # Oracle AQ publisher, consumers, event types
│   ├── themes/                  # Theme discovery, SSR rendering engine
│   ├── data-viz/                # Data sources, query engine, chart configs
│   ├── plugins/                 # Plugin discovery, lifecycle, hook system
│   ├── taxonomy/                # Categories, tags
│   └── observability/           # Metrics, tracing, structured logging
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── app/                 # App shell, routing
│   │   ├── components/          # Shared components
│   │   ├── features/            # Feature modules (pages, media, users, etc.)
│   │   ├── editor/              # Lexical block editor integration
│   │   └── api/                 # API client, typed request/response
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
└── test/
    ├── integration/             # Integration tests
    └── e2e/                     # Playwright E2E tests
```

---

## Environment Variables (`.env.example`)

```
# Oracle 19c
ORACLE_DSN=localhost:1521/ORCLPDB1
ORACLE_USER=aurora_cms
ORACLE_PASSWORD=change_me
ORACLE_TEST_DSN=localhost:1521/ORCLPDB1
ORACLE_TEST_USER=aurora_test
ORACLE_TEST_PASSWORD=change_me

# Keycloak
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=aurora
KEYCLOAK_CLIENT_ID=aurora-cms

# Valkey/Redis
REDIS_URL=redis://localhost:6379

# Storage
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./storage/media
AWS_S3_BUCKET=
AWS_S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# App
APP_PORT=3000
APP_URL=http://localhost:3000
NODE_ENV=development
```
