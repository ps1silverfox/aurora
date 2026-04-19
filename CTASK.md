# Aurora CMS — TypeScript Edition
## Ralph Task List

TypeScript / NestJS / Oracle 19c rewrite of Aurora CMS (original: Laravel/PHP/PostgreSQL).

**Key improvements over original:**
- TypeScript strict mode end-to-end (backend + frontend)
- Oracle 19c native features: Oracle Text (replaces OpenSearch), Oracle Advanced Queuing (replaces NATS), materialized views for analytics, PL/SQL hash-chained audit log
- NestJS DI / decorator-based architecture
- Eliminated: OpenSearch container, NATS container
- Added: Oracle AQ consumers, Oracle Text sync jobs, PL/SQL packages for audit integrity

**Dependency order:** Each phase depends on prior phases completing. Do not skip ahead.

---

## Test Strategy: CSV Mode vs Oracle Mode

**All Oracle-specific code is built in full. Tests run against a CSV mock backend by default.**

This mirrors the BIS project pattern. The `DbService` abstraction switches backends based on the `DB_DRIVER` environment variable:

- `DB_DRIVER=csv` (default for `npm test` and `npm run test:integration`) — uses CSV files in `test/fixtures/csv/` as mock tables. No Oracle connection required.
- `DB_DRIVER=oracle` — uses real Oracle 19c connection. Required for production and for running `npm run test:oracle`.

**What this means for each task:**
- **Oracle DDL / migrations** (`oracle/migrations/*.sql`, PL/SQL packages): Write the files in full. Do NOT execute them during the task — they are built artifacts only. Verify by syntax-checking the SQL, not by running it.
- **`DbService` calls in application code**: Write against the full Oracle interface. The CSV adapter implements the same interface.
- **Unit tests** (`*.spec.ts`): Mock `DbService` entirely — no CSV or Oracle dependency.
- **Integration tests** (`*.integration.spec.ts`): Run against CSV fixtures. Annotate tests with `// @csv-mode` comment. Do not require Oracle to pass.
- **`npm run test:oracle`** (separate script): Runs integration tests with `DB_DRIVER=oracle`. Only run when Oracle is available. Do not block CI on this.

**CSV fixture format:** `test/fixtures/csv/<TABLE_NAME>.csv` — one file per table, header row matches column names. The CSV adapter reads these at test startup and holds them in memory.

---

## Phase 0: Project Scaffolding & Infrastructure

### [x] TS-0.1 — NestJS project init
- `npm i -g @nestjs/cli && nest new aurora-cms-ts --strict`
- Configure `tsconfig.json`: `strict: true`, `target: ES2022`, `experimentalDecorators: true`
- Configure `tsconfig.build.json`: excludes `test/`, `**/*.spec.ts`
- Set up `package.json` scripts: `build`, `start:dev`, `start:prod`, `typecheck`, `lint`, `format`, `test`, `test:cov`, `test:integration`, `test:e2e`, `db:migrate`, `license-check`
- Add `nest-cli.json` with `compilerOptions.deleteOutDir: true`
- Files: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`

### [x] TS-0.2 — Database abstraction layer (Oracle + CSV backends)
- Create `src/db/db.interface.ts` — `DbService` interface: `query<T>(sql, binds?): Promise<T[]>`, `execute(sql, binds?): Promise<void>`, `executeBatch(sql, binds[]): Promise<void>`
- Create `src/db/oracle.driver.ts` — Oracle 19c implementation using `oracledb` (Apache 2.0) connection pool. Only loaded when `DB_DRIVER=oracle`. Install `oracledb` but do NOT call `initOracleClient()` in this file — leave a clear `// TODO: set initOracleClient path` comment.
- Create `src/db/csv.driver.ts` — CSV implementation: on init, reads all `test/fixtures/csv/*.csv` files into memory as `Map<tableName, Row[]>`. Implements `query<T>()` by filtering in-memory rows using simple column-match parsing of the SQL WHERE clause (best-effort; sufficient for test assertions). `execute()` and `executeBatch()` mutate the in-memory maps.
- Create `src/db/db.module.ts` — global module: provides `DbService` token. Selects driver based on `process.env.DB_DRIVER` (`'csv'` = `CsvDriver`, `'oracle'` = `OracleDriver`, default `'csv'`).
- Create `src/db/migrate.ts` — reads `oracle/migrations/*.sql` ordered by filename, tracks applied migrations in memory (CSV mode) or in `SCHEMA_MIGRATIONS` table (Oracle mode), idempotent
- Create `oracle/migrations/0000_schema_migrations.sql` — DDL for `SCHEMA_MIGRATIONS` table (build only; do not execute)
- Create `test/fixtures/csv/` directory with a `.gitkeep` placeholder
- Write unit tests: mock `DbService`, verify module wires correct driver per `DB_DRIVER` value
- Verify: `npm run typecheck && npm test -- --testPathPattern=db`
- Files: `src/db/db.interface.ts`, `src/db/oracle.driver.ts`, `src/db/csv.driver.ts`, `src/db/db.module.ts`, `src/db/migrate.ts`, `oracle/migrations/0000_schema_migrations.sql`, `test/fixtures/csv/.gitkeep`

### [x] TS-0.3 — Docker Compose environment
- Create `docker-compose.yml` services: `app` (NestJS), `oracle` (gvenzl/oracle-xe:21-slim or oracle/database:19.3.0-ee), `keycloak`, `valkey`
- **NOTE:** OpenSearch and NATS removed — replaced by Oracle Text and Oracle AQ
- Create `Dockerfile` (Node 20 Alpine, multi-stage: build → production)
- Configure Oracle init scripts in `docker/oracle/init/` to create `AURORA_CMS` and `AURORA_TEST` users
- Add `nginx.conf`: `/api/*` → NestJS, `/admin/*` → frontend SPA static, `/*` → SSR endpoint
- Files: `docker-compose.yml`, `Dockerfile`, `docker/oracle/init/01_create_users.sql`, `docker/nginx/nginx.conf`

### [x] TS-0.4 — Frontend scaffolding
- Init Vite + React 18 + TypeScript in `frontend/`
- Configure `frontend/tsconfig.json` with `strict: true`
- Set up ESLint + Prettier for frontend
- Add Vitest + React Testing Library config
- Create basic app shell: `frontend/src/main.tsx`, `frontend/src/app/App.tsx`, React Router v6 setup
- Create typed API client base: `frontend/src/api/client.ts` (fetch wrapper with auth header injection)
- Files: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/main.tsx`, `frontend/src/app/App.tsx`, `frontend/src/api/client.ts`

### [x] TS-0.5 — Development tooling & CI
- Configure ESLint: `eslint.config.ts` — `@typescript-eslint/recommended-strict`, no `any`, no floating promises
- Configure Prettier: `prettier.config.ts`
- Add `license-policy.json`: allowed MIT/Apache-2.0/BSD-2/BSD-3/ISC, prohibited GPL/AGPL/SSPL/LGPL
- Add `license-checker` dev dependency, `npm run license-check` script
- Set up Jest config: `jest.config.ts` — unit tests only (excludes integration, e2e)
- Set up Playwright: `playwright.config.ts`
- Create `.github/workflows/ci.yml`: lint → typecheck → license-check → unit tests → integration tests → build → e2e
- Files: `eslint.config.ts`, `prettier.config.ts`, `license-policy.json`, `jest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`

### [x] TS-0.6 — Common utilities
- Create `src/common/result.ts` — `Result<T, E>` type and helpers (`ok`, `err`, `isOk`, `isErr`)
- Create `src/common/pagination.ts` — cursor encoding/decoding (base64 JSON), `CursorPage<T>` type
- Create `src/common/errors.ts` — `AppError` base class, subtypes (`NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`)
- Create `src/common/filters/oracle-exception.filter.ts` — maps Oracle error codes to RFC 7807 HTTP responses (ORA-00001 → 409, ORA-01403 → 404, etc.)
- Create `src/common/filters/app-exception.filter.ts` — maps `AppError` subtypes to RFC 7807
- Create `src/common/decorators/current-user.decorator.ts` — extracts authenticated user from request
- Files: `src/common/result.ts`, `src/common/pagination.ts`, `src/common/errors.ts`, `src/common/filters/oracle-exception.filter.ts`, `src/common/filters/app-exception.filter.ts`, `src/common/decorators/current-user.decorator.ts`

---

## Phase 1: Authentication & User Management

### [x] TS-1.1 — Keycloak JWT integration
- Install `@nestjs/passport`, `passport`, `passport-jwt` (all MIT)
- Create `src/auth/auth.module.ts`, `src/auth/jwt.strategy.ts`
- `JwtStrategy` fetches Keycloak public keys from JWKS endpoint (`{KEYCLOAK_URL}/realms/{realm}/protocol/openid-connect/certs`)
- Cache JWKS response in Valkey with 5-minute TTL (refresh on key rotation)
- Create `JwtAuthGuard` (global default — all routes protected unless decorated `@Public()`)
- Create `@Public()` decorator for unauthenticated routes
- Add login/logout redirect flows: `GET /api/v1/auth/login` → Keycloak, `GET /api/v1/auth/callback`, `GET /api/v1/auth/logout`
- Write unit tests: valid token passes, expired token 401, missing token 401, unknown issuer 401
- Files: `src/auth/auth.module.ts`, `src/auth/jwt.strategy.ts`, `src/auth/jwt-auth.guard.ts`, `src/auth/public.decorator.ts`, `src/auth/auth.controller.ts`

### [x] TS-1.2 — Users migration and model
- Create `oracle/migrations/0001_users.sql`:
  - `USERS` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `KEYCLOAK_ID VARCHAR2(255) UNIQUE NOT NULL`, `EMAIL VARCHAR2(255) UNIQUE NOT NULL`, `NAME VARCHAR2(255) NOT NULL`, `ROLE_ID NUMBER`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`, `UPDATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`, `DELETED_AT TIMESTAMP WITH TIME ZONE NULL`
  - `ROLES` table: `ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `NAME VARCHAR2(100) UNIQUE NOT NULL`, `PERMISSIONS CLOB CHECK (PERMISSIONS IS JSON)`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`
  - Seed default roles: Super Admin, Admin, Editor, Author, Viewer
- Create `src/users/entities/user.entity.ts` — TypeScript interface mapping `USERS` row
- Create `src/users/entities/role.entity.ts`
- Create `src/users/users.repository.ts` — `findById`, `findByKeycloakId`, `findByEmail`, `create`, `update`, `softDelete`, `list` (cursor-paginated)
- Write unit tests for repository methods (mock `OracleService`)
- Files: `oracle/migrations/0001_users.sql`, `src/users/entities/user.entity.ts`, `src/users/entities/role.entity.ts`, `src/users/users.repository.ts`

### [x] TS-1.3 — User sync and roles service
- Create `src/users/users.service.ts`:
  - `syncFromToken(claims)` — upsert user from Keycloak JWT claims on first login
  - `assignRole(userId, roleId)` — assign role with permission check
  - `list(cursor, limit)` — cursor-paginated user list
  - `findById(id)` — single user with role+permissions
- Create `src/users/roles.service.ts`:
  - `listRoles()`, `createRole(dto)`, `updateRole(id, dto)`, `deleteRole(id)`
  - `can(user, permission)` — check if user's role includes permission
- Create `RolesGuard` — reads `@Roles(...permissions)` decorator, calls `roles.service.can()`
- Create `@Roles()` decorator
- Write unit tests: permission granted, permission denied, role not found
- Files: `src/users/users.service.ts`, `src/users/roles.service.ts`, `src/users/roles.guard.ts`, `src/users/roles.decorator.ts`

### [x] TS-1.4 — Hash-chained audit log (Oracle PL/SQL)
- Create `oracle/migrations/0002_audit_log.sql`:
  - `AUDIT_LOG` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `ACTOR_ID RAW(16)`, `ACTION VARCHAR2(100) NOT NULL`, `ENTITY_TYPE VARCHAR2(100)`, `ENTITY_ID VARCHAR2(255)`, `DIFF CLOB CHECK (DIFF IS JSON)`, `PREV_HASH VARCHAR2(64)`, `HASH VARCHAR2(64) NOT NULL`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`
  - PL/SQL package `oracle/packages/audit_pkg.sql`: `PROCEDURE INSERT_ENTRY(p_actor_id, p_action, p_entity_type, p_entity_id, p_diff)` — computes SHA-256 hash over (prev_hash || actor_id || action || entity_type || entity_id || diff || created_at), inserts row. Hash chain is tamper-evident.
  - Grant `EXECUTE` on `audit_pkg` to `AURORA_CMS` user only
- Create `src/audit/audit.service.ts` — calls Oracle `audit_pkg.INSERT_ENTRY` via `OracleService.execute()`
- Create `src/audit/audit.module.ts` — exports `AuditService`
- Write unit tests for `AuditService` (mock OracleService, verify correct bind vars passed)
- Files: `oracle/migrations/0002_audit_log.sql`, `oracle/packages/audit_pkg.sql`, `src/audit/audit.service.ts`, `src/audit/audit.module.ts`

### [x] TS-1.5 — Users and audit API endpoints
- Create `src/users/users.controller.ts`:
  - `GET /api/v1/users` — list users (cursor-paginated, max 100). Requires `admin.users.read` permission.
  - `GET /api/v1/users/:id` — single user. Requires `admin.users.read`.
  - `PUT /api/v1/users/:id/role` — assign role. Requires `admin.users.manage`.
- Create `src/audit/audit.controller.ts`:
  - `GET /api/v1/audit-log` — list entries (filterable: entity_type, actor_id, date range). Requires `admin.audit.read`.
- DTOs with `class-validator` decorators. RFC 7807 errors on validation failure.
- Write integration tests for all endpoints (`// @csv-mode` — run against CSV fixtures via `DbService` CSV driver, no Oracle connection required)
- Files: `src/users/users.controller.ts`, `src/users/dto/assign-role.dto.ts`, `src/audit/audit.controller.ts`

---

## Phase 2: Content Management (Core)

### [x] TS-2.1 — Pages migration and repository
- Create `oracle/migrations/0003_content.sql`:
  - `PAGES` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `TITLE VARCHAR2(500) NOT NULL`, `SLUG VARCHAR2(500) UNIQUE NOT NULL`, `STATUS VARCHAR2(20) DEFAULT 'draft' CHECK (STATUS IN ('draft','review','approved','published','archived'))`, `AUTHOR_ID RAW(16) REFERENCES USERS(ID)`, `PUBLISHED_AT TIMESTAMP WITH TIME ZONE`, `SCHEDULED_AT TIMESTAMP WITH TIME ZONE`, `VIEW_COUNT NUMBER DEFAULT 0`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`, `UPDATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`, `DELETED_AT TIMESTAMP WITH TIME ZONE NULL`
  - Index: `IDX_PAGES_SLUG` on `SLUG`, `IDX_PAGES_STATUS` on `STATUS`, `IDX_PAGES_AUTHOR` on `AUTHOR_ID`
  - `BLOCKS` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `PAGE_ID RAW(16) REFERENCES PAGES(ID) ON DELETE CASCADE`, `BLOCK_TYPE VARCHAR2(50) NOT NULL`, `BLOCK_ORDER NUMBER NOT NULL`, `CONTENT CLOB CHECK (CONTENT IS JSON)`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`
  - Index: `IDX_BLOCKS_PAGE` on `PAGE_ID, BLOCK_ORDER`
- Create `src/content/entities/page.entity.ts`, `src/content/entities/block.entity.ts`
- Create `src/content/content.repository.ts` — `createPage`, `findById`, `findBySlug`, `updatePage`, `softDeletePage`, `listPages` (cursor-paginated, filterable by status/author), `upsertBlocks` (replace block set for page in single transaction)
- Write unit tests for repository
- Files: `oracle/migrations/0003_content.sql`, `src/content/entities/page.entity.ts`, `src/content/entities/block.entity.ts`, `src/content/content.repository.ts`

### [x] TS-2.2 — Block type validation
- Create `src/content/blocks/block-registry.ts` — registry mapping block type string → Zod schema for `content` JSON
- Define schemas for: `text`, `heading`, `image`, `video`, `quote`, `list`, `table`, `code`, `separator`, `columns`, `section`, `tabs`, `accordion`, `chart`, `kpi_card`, `data_table`, `embed_youtube`, `embed_vimeo`, `embed_iframe`, `reusable`
- `validateBlock(type, content)` — returns `Result<void, ValidationError>`
- Install `zod` (MIT)
- Write unit tests: valid content passes, invalid content returns error, unknown type returns error
- Files: `src/content/blocks/block-registry.ts`, `src/content/blocks/schemas/*.ts`

### [x] TS-2.3 — Revisions
- Create `oracle/migrations/0004_revisions.sql`:
  - `REVISIONS` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `PAGE_ID RAW(16) REFERENCES PAGES(ID) ON DELETE CASCADE`, `TITLE VARCHAR2(500)`, `BLOCKS CLOB CHECK (BLOCKS IS JSON)`, `CREATED_BY RAW(16) REFERENCES USERS(ID)`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`
  - Index: `IDX_REVISIONS_PAGE` on `PAGE_ID, CREATED_AT DESC`
- Add `RevisionRepository` to `src/content/content.repository.ts`: `createRevision`, `listRevisions` (cursor-paginated), `findRevision`, `restoreRevision` (creates new page version from revision snapshot)
- Auto-create revision in `ContentService.updatePage()` — call before applying the update
- Files: `oracle/migrations/0004_revisions.sql` (append to existing migration or new file)

### [x] TS-2.4 — Content service and workflow
- Create `src/content/content.service.ts`:
  - `createPage(dto, actor)` — validates, slugifies, inserts, emits `content.created` event, logs to audit
  - `updatePage(id, dto, actor)` — validates, creates revision, updates, emits `content.updated`, audits
  - `deletePage(id, actor)` — soft delete, emits `content.deleted`, audits
  - `listPages(filters, cursor)` — delegates to repository
  - `getPage(id)`, `getPageBySlug(slug)`
- Create `src/content/workflow.service.ts`:
  - Valid transitions: `draft → review → approved → published → archived`
  - Role-based: Author submits (`draft→review`), Editor approves (`review→approved`), Admin/Editor publishes (`approved→published`)
  - `transition(pageId, action, actor)` → updates status, emits `workflow.transition` event, audits
- Create `src/content/scheduler.service.ts` — runs every 60s via `@Cron`, publishes pages where `SCHEDULED_AT <= SYSTIMESTAMP AND STATUS = 'approved'`
- Write unit tests for all transitions (valid and invalid), scheduler logic
- Files: `src/content/content.service.ts`, `src/content/workflow.service.ts`, `src/content/scheduler.service.ts`

### [x] TS-2.5 — Content API endpoints
- Create `src/content/content.controller.ts`:
  - `POST /api/v1/pages` — create
  - `GET /api/v1/pages` — list (filterable: status, author, tag, category)
  - `GET /api/v1/pages/:id`
  - `PUT /api/v1/pages/:id` — update
  - `DELETE /api/v1/pages/:id`
  - `POST /api/v1/pages/:id/transition` — workflow action
  - `GET /api/v1/pages/:id/revisions` — list revisions
  - `GET /api/v1/pages/:id/revisions/:revId`
  - `POST /api/v1/pages/:id/revisions/:revId/restore`
- DTOs: `CreatePageDto`, `UpdatePageDto`, `TransitionDto`
- Authorization: Author edits own pages, Editor edits all, Admin manages all
- Integration tests for all endpoints
- Files: `src/content/content.controller.ts`, `src/content/dto/*.ts`

---

## Phase 3: Media Management

### [x] TS-3.1 — Media migration and upload service
- Create `oracle/migrations/0005_media.sql`:
  - `MEDIA` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `FILENAME VARCHAR2(500) NOT NULL`, `MIME_TYPE VARCHAR2(100)`, `SIZE_BYTES NUMBER`, `STORAGE_DRIVER VARCHAR2(20) DEFAULT 'local'`, `STORAGE_PATH VARCHAR2(1000) NOT NULL`, `UPLOADED_BY RAW(16) REFERENCES USERS(ID)`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`, `DELETED_AT TIMESTAMP WITH TIME ZONE NULL`
  - `MEDIA_VARIANTS` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `MEDIA_ID RAW(16) REFERENCES MEDIA(ID) ON DELETE CASCADE`, `VARIANT VARCHAR2(20) CHECK (VARIANT IN ('thumbnail','small','medium','large'))`, `STORAGE_PATH VARCHAR2(1000)`, `WIDTH NUMBER`, `HEIGHT NUMBER`
- Create `src/media/storage/` — `StorageDriver` interface, `LocalStorageDriver`, `S3StorageDriver`
- `StorageDriver` interface: `upload(file, path): Promise<string>`, `delete(path)`, `url(path): string`
- Create `src/media/media.service.ts`: `upload(file, uploader)`, `delete(id, actor)`, `list(cursor)`, `findById(id)`
- Validate: max 50MB, allowed MIME types (images, PDF, video, audio)
- Write unit tests (mock storage driver)
- Files: `oracle/migrations/0005_media.sql`, `src/media/storage/storage.interface.ts`, `src/media/storage/local.driver.ts`, `src/media/storage/s3.driver.ts`, `src/media/media.service.ts`

### [x] TS-3.2 — Image variant generation
- Install `sharp` (Apache 2.0) for image processing
- Create `src/media/variant.service.ts`: `generateVariants(mediaId, sourcePath)` — generates thumbnail (150px), small (300px), medium (768px), large (1200px), stores each via storage driver, inserts `MEDIA_VARIANTS` rows
- Create `src/media/variant.job.ts` — async job triggered on image upload (called via Oracle AQ consumer in Phase 6, or direct async call in Phase 3)
- Write unit tests for variant generation (mock sharp and storage driver)
- Files: `src/media/variant.service.ts`, `src/media/variant.job.ts`

### [x] TS-3.3 — Media API and frontend component
- Create `src/media/media.controller.ts`:
  - `POST /api/v1/media` — multipart upload
  - `GET /api/v1/media` — list (cursor-paginated, filterable by mime_type, search by filename)
  - `GET /api/v1/media/:id`
  - `DELETE /api/v1/media/:id`
- Frontend: `frontend/src/features/media/MediaBrowser.tsx` — grid thumbnails, search, pagination, upload component with drag-and-drop and progress bar, delete confirmation dialog
- `MediaPicker` modal (used by block editor to select media)
- Write integration tests for upload/list/delete
- Files: `src/media/media.controller.ts`, `frontend/src/features/media/MediaBrowser.tsx`, `frontend/src/features/media/MediaPicker.tsx`

---

## Phase 4: Block Editor (Frontend)

### [x] TS-4.1 — Lexical editor integration
- Install `lexical` and `@lexical/react` (MIT)
- Create `frontend/src/editor/AuroraEditor.tsx` — editor shell with toolbar and block canvas
- Implement core block nodes: `TextNode`, `HeadingNode`, `QuoteNode`, `ListNode`, `CodeNode`, `DividerNode`
- Implement block drag-and-drop reordering (`@dnd-kit/core` MIT)
- Serializer: `serializeToBlocks(editorState): Block[]` — converts Lexical state to Aurora block JSON for API
- Deserializer: `deserializeFromBlocks(blocks: Block[]): EditorState` — loads block JSON into Lexical
- Files: `frontend/src/editor/AuroraEditor.tsx`, `frontend/src/editor/nodes/`, `frontend/src/editor/serializer.ts`

### [x] TS-4.2 — Media and layout blocks
- Media blocks: `ImageBlockNode` (insert from MediaPicker, alt text, alignment), `VideoBlockNode`
- Layout blocks: `ColumnsBlockNode` (2-col, 3-col, custom), `SectionBlockNode`, `TabsBlockNode`, `AccordionBlockNode`
- Each block: custom render component + settings sidebar panel
- Files: `frontend/src/editor/nodes/MediaBlocks.tsx`, `frontend/src/editor/nodes/LayoutBlocks.tsx`

### [x] TS-4.3 — Table and embed blocks
- `TableBlockNode` — add/remove rows/columns, header row, striped rows
- `EmbedBlock` — YouTube, Vimeo, generic iframe, CodeSandbox/StackBlitz URL
- Files: `frontend/src/editor/nodes/TableBlock.tsx`, `frontend/src/editor/nodes/EmbedBlocks.tsx`

### [x] TS-4.4 — Reusable block templates
- Create `oracle/migrations/0006_block_templates.sql`:
  - `BLOCK_TEMPLATES` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `NAME VARCHAR2(255) NOT NULL`, `BLOCK_TYPE VARCHAR2(50) NOT NULL`, `CONTENT CLOB CHECK (CONTENT IS JSON)`, `CREATED_BY RAW(16) REFERENCES USERS(ID)`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`
- Backend: `GET/POST/DELETE /api/v1/block-templates`
- Frontend: `ReusableBlockNode` — insert from template library, detach-on-edit option
- Files: `oracle/migrations/0006_block_templates.sql`, `src/content/block-templates.controller.ts`, `frontend/src/editor/nodes/ReusableBlock.tsx`

### [x] TS-4.5 — Editor UX polish
- Undo/redo: Lexical built-in history plugin
- Keyboard shortcuts: `Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+Z` undo, `Ctrl+Shift+Z` redo, `Ctrl+S` save draft
- Block settings sidebar: slide-in panel when block selected
- Inline toolbar: text formatting (bold, italic, link, inline code)
- Autosave: debounced 30s, saves as draft, shows "Saved" / "Saving..." indicator
- Preview mode: iframe rendering SSR output via `GET /api/v1/pages/:id/preview` endpoint
- Files: `frontend/src/editor/plugins/`, `frontend/src/editor/Toolbar.tsx`, `frontend/src/editor/BlockSettingsSidebar.tsx`

---

## Phase 5: Oracle Text Search

### [x] TS-5.1 — Oracle Text index
- Create `oracle/migrations/0007_oracle_text_search.sql`:
  - Concatenated column or `CONTENT_SEARCH_VIEW` that joins `PAGES.TITLE + PAGES.SLUG + flattened block text`
  - `CONTENT_SEARCH_IDX` — Oracle Text `CTXSYS.CONTEXT` index on the search view (SYNC ON COMMIT for dev, SYNC EVERY '00:05:00' for prod)
  - PL/SQL procedure `oracle/packages/search_pkg.sql`: `PROCEDURE SYNC_INDEX` — calls `CTX_DDL.SYNC_INDEX('CONTENT_SEARCH_IDX')`
  - Grant `CTXAPP` role to `AURORA_CMS` user (required for Oracle Text)
- Create `src/search/search.service.ts`:
  - `index(pageId)` — updates `CONTENT_SEARCH_VIEW` source data, optionally calls `SYNC_INDEX`
  - `search(query, filters, cursor)` — uses `CONTAINS(column, query)` syntax, returns `SCORE()` ranked results with cursor pagination
  - `remove(pageId)` — soft-delete from index source (filter status ≠ published)
- Oracle DDL and PL/SQL: build files only — do NOT execute. Syntax-verify SQL files by inspection.
- Write unit tests (`// @csv-mode`): mock `DbService`, assert `SearchService.index()` calls `execute()` with a SQL string containing `CONTAINS`, assert `SearchService.search()` calls `query()` and returns mapped results. CSV driver returns pre-loaded fixture rows as mock search results.
- Files: `oracle/migrations/0007_oracle_text_search.sql`, `oracle/packages/search_pkg.sql`, `src/search/search.service.ts`, `src/search/search.module.ts`

### [x] TS-5.2 — Search API and UI
- Create `src/search/search.controller.ts`:
  - `GET /api/v1/search?q=...&status=...&category=...&tag=...&from=...&to=...`
  - Returns cursor-paginated results with `title`, `slug`, `snippet` (Oracle Text `CTX_DOC.SNIPPET`), `score`, `published_at`
- Frontend: `frontend/src/features/search/SearchBar.tsx` — instant results dropdown (debounced 300ms)
- `SearchResultsPage.tsx` — full results with filter sidebar, highlighted snippets, keyboard navigation
- Write integration tests for search endpoint
- Files: `src/search/search.controller.ts`, `frontend/src/features/search/SearchBar.tsx`, `frontend/src/features/search/SearchResultsPage.tsx`

---

## Phase 6: Oracle Advanced Queuing (Event System)

### [x] TS-6.1 — Oracle AQ setup and publisher
- Create `oracle/migrations/0008_oracle_aq.sql`:
  - Create AQ object type: `AQ_EVENT_TYPE OBJECT (SUBJECT VARCHAR2(200), PAYLOAD CLOB)` (or use `SYS.AQ$_JMS_TEXT_MESSAGE`)
  - Create queues via `DBMS_AQADM.CREATE_QUEUE_TABLE` and `DBMS_AQADM.CREATE_QUEUE` for topics: `content.published`, `content.updated`, `content.deleted`, `media.uploaded`, `workflow.transition`, `plugin.lifecycle`
  - Grant enqueue/dequeue privileges to `AURORA_CMS`
- Create `src/events/oracle-aq.service.ts`:
  - `publish(topic, payload)` — enqueues message to Oracle AQ queue via `DBMS_AQ.ENQUEUE`
  - Connection uses dedicated Oracle session for AQ operations
- Create `src/events/event-types.ts` — TypeScript interfaces for each event payload
- Oracle DDL (`oracle/migrations/0008_oracle_aq.sql`): build file only — do NOT execute.
- Write unit tests for publish (`// @csv-mode`): mock `DbService`, assert `OracleAqService.publish()` calls `execute()` with a SQL string referencing `DBMS_AQ.ENQUEUE`, correct topic and payload bind vars passed.
- Files: `oracle/migrations/0008_oracle_aq.sql`, `src/events/oracle-aq.service.ts`, `src/events/event-types.ts`, `src/events/events.module.ts`

### [x] TS-6.2 — AQ consumers
- Create `src/events/consumers/` — one file per consumer, all implement `AqConsumer` interface
- `content-published.consumer.ts` — dequeues `content.published` → calls `SearchService.index()`, clears Valkey page cache
- `content-updated.consumer.ts` — dequeues `content.updated` → `SearchService.index()`, audits
- `content-deleted.consumer.ts` — dequeues `content.deleted` → `SearchService.remove()`, cleans orphan media
- `media-uploaded.consumer.ts` — dequeues `media.uploaded` → `VariantService.generateVariants()`
- `workflow-transition.consumer.ts` — dequeues `workflow.transition` → webhook/notification stub (log + noop until Phase 10)
- Consumers run as background NestJS bootstrap workers using `@nestjs/schedule` or a dedicated process
- Each consumer: idempotent processing, error logged + message NACKed to DLQ on exception
- Write unit tests (`// @csv-mode`): for each consumer, mock `OracleAqService.dequeue()` to return a fixture event payload, assert the correct downstream service method is called (e.g. `SearchService.index()`, `VariantService.generateVariants()`). No Oracle connection required.
- Files: `src/events/consumers/*.consumer.ts`, `src/events/aq-consumer.interface.ts`

---

## Phase 7: Themes (SSR)

### [x] TS-7.1 — Theme engine
- Create `oracle/migrations/0009_themes.sql`:
  - `THEMES` table: `ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `NAME VARCHAR2(255)`, `SLUG VARCHAR2(100) UNIQUE`, `PATH VARCHAR2(1000)`, `IS_ACTIVE NUMBER(1) DEFAULT 0`, `SETTINGS CLOB CHECK (SETTINGS IS JSON)`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`
- Theme templates: Handlebars (MIT) files in `themes/{slug}/templates/`
- Create `src/themes/theme.service.ts`: `discover()` scans `themes/` dir, `getActive()`, `activate(id)`, `getSettings(id)`, `updateSettings(id, settings)`
- Create `src/themes/renderer.service.ts`: `renderPage(page, blocks, theme)` — resolves template, renders block partials, returns HTML string
- Each block type has a Handlebars partial: `themes/aurora-default/blocks/text.hbs`, `heading.hbs`, etc.
- Build `aurora-default` theme (minimal clean design)
- Write unit tests for renderer (mock theme files)
- Files: `oracle/migrations/0009_themes.sql`, `src/themes/theme.service.ts`, `src/themes/renderer.service.ts`, `themes/aurora-default/`

### [x] TS-7.2 — Theme API and SSR routes
- `GET /api/v1/themes` — list themes
- `PUT /api/v1/themes/:id/activate` — activate theme (non-destructive)
- `GET/PUT /api/v1/themes/:id/settings`
- SSR route: `GET /*` (catch-all, non-API) → resolve page by slug → `RendererService.renderPage()` → serve HTML
- Preview endpoint: `GET /api/v1/pages/:id/preview` — renders draft page with active theme
- Write integration tests: theme switch, SSR output contains correct block content
- Files: `src/themes/themes.controller.ts`, `src/themes/ssr.controller.ts`

---

## Phase 8: Data Visualization

### [x] TS-8.1 — Data sources migration and service
- Create `oracle/migrations/0010_data_viz.sql`:
  - `DATA_SOURCES` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `NAME VARCHAR2(255)`, `SOURCE_TYPE VARCHAR2(20) CHECK (SOURCE_TYPE IN ('oracle','postgresql','rest_api','csv'))`, `CONNECTION_CONFIG CLOB CHECK (CONNECTION_CONFIG IS JSON)` (encrypted at app layer using `node:crypto` AES-256-GCM), `CREATED_BY RAW(16)`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`
  - `DATA_QUERIES` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `SOURCE_ID RAW(16) REFERENCES DATA_SOURCES(ID)`, `QUERY_CONFIG CLOB CHECK (QUERY_CONFIG IS JSON)`, `CACHE_TTL NUMBER DEFAULT 300`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`
  - **NOTE:** Oracle type added to source types — query Oracle data sources directly without driver switching
- Create `src/data-viz/data-source.service.ts`: register, test connection, list, delete
- Encrypt/decrypt `CONNECTION_CONFIG` using `ConfigService`-provided key
- Write unit tests
- Files: `oracle/migrations/0010_data_viz.sql`, `src/data-viz/data-source.service.ts`

### [x] TS-8.2 — Query engine with Oracle-native path
- Create `src/data-viz/query-engine.service.ts`:
  - Oracle source: uses `OracleService` — parameterized read-only query (forced `SELECT` only, max 10k rows, `ROW_NUMBER()` pagination)
  - PostgreSQL source: uses `pg` driver (MIT), parameterized query, read-only connection
  - REST API source: `fetch` with configurable URL, headers, JSONPath extraction (`jsonpath-plus` MIT)
  - CSV source: `papaparse` (MIT) — parse uploaded CSV, return tabular data
  - Server-side aggregation: GROUP BY, SUM, AVG, COUNT via `QueryConfig.aggregate` spec
  - Cache results in Valkey with configurable TTL — cache key = SHA-256 of (sourceId + queryConfig JSON)
- API: `POST /api/v1/data-queries/execute` — returns `{ data: Row[], meta: { cached, query_ms } }`
- API: `GET /api/v1/data-queries/:id/export?format=csv`
- Write unit tests (`// @csv-mode`): all source drivers mocked. Oracle driver test asserts `DbService.query()` called with `SELECT` keyword + `ROW_NUMBER()`. CSV driver test asserts `papaparse` invoked and returns rows. Valkey cache test asserts second identical call returns `meta.cached = true`.
- Files: `src/data-viz/query-engine.service.ts`, `src/data-viz/drivers/`

### [x] TS-8.3 — Oracle materialized view for analytics
- **Oracle-native improvement:** Create `oracle/migrations/0011_analytics_mv.sql`
  - `CONTENT_ANALYTICS_MV` materialized view DDL — build file only, do NOT execute
  - `SIGNAL_PERFORMANCE_MV` (stub DDL) — ready for Apex integration
- Expose analytics via `GET /api/v1/analytics/content` — in CSV mode, `DbService.query()` returns rows from `test/fixtures/csv/CONTENT_ANALYTICS_MV.csv`
- Write unit tests (`// @csv-mode`): mock `DbService`, assert controller returns shaped response matching fixture data
- Files: `oracle/migrations/0011_analytics_mv.sql`, `src/data-viz/analytics.controller.ts`

### [x] TS-8.4 — Chart builder UI and data blocks
- Frontend: `frontend/src/features/data-viz/ChartBuilder.tsx`
  - Visual query builder: source picker, column picker, axis/series config
  - Chart type selector: bar, line, pie, area, KPI card, data table
  - Live preview using Apache ECharts (`echarts` Apache 2.0)
- Data blocks in editor:
  - `ChartBlockNode` — embeds chart config in block JSON, fetches data from query engine on render
  - `KpiCardBlockNode` — single-value KPI display with optional trend
  - `DataTableBlockNode` — paginated sortable table
- Files: `frontend/src/features/data-viz/ChartBuilder.tsx`, `frontend/src/editor/nodes/DataBlocks.tsx`

### [x] TS-8.5 — Cross-filtering and auto-refresh
- Cross-filter context: React context `CrossFilterContext` per page view — chart click sets filter, other data blocks re-query
- Auto-refresh: configurable polling interval per block (15s/30s/60s/5m/off), exponential backoff on error
- Export button: calls `GET /api/v1/data-queries/:id/export?format=csv`, triggers browser download
- Files: `frontend/src/features/data-viz/CrossFilterContext.tsx`, `frontend/src/features/data-viz/useDataBlock.ts`

---

## Phase 9: Plugin System

### [x] TS-9.1 — Plugin model and discovery
- Create `oracle/migrations/0012_plugins.sql`:
  - `PLUGINS` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `NAME VARCHAR2(255) UNIQUE`, `VERSION VARCHAR2(50)`, `STATUS VARCHAR2(20) CHECK (STATUS IN ('inactive','active','error'))`, `MANIFEST CLOB CHECK (MANIFEST IS JSON)`, `INSTALLED_AT TIMESTAMP WITH TIME ZONE`, `ACTIVATED_AT TIMESTAMP WITH TIME ZONE`
  - `PLUGIN_SETTINGS` table: `ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY`, `PLUGIN_ID RAW(16) REFERENCES PLUGINS(ID) ON DELETE CASCADE`, `KEY VARCHAR2(255)`, `VALUE CLOB`, UNIQUE(`PLUGIN_ID, KEY`)
- Create `src/plugins/plugin-discovery.service.ts`: scans `plugins/` directory, parses `plugin.json` manifests (`name`, `version`, `entrypoint`, `permissions`, `hooks`, `blocks`, `routes`, `settings`), syncs to DB
- Write unit tests for discovery (mock filesystem)
- Files: `oracle/migrations/0012_plugins.sql`, `src/plugins/plugin-discovery.service.ts`

### [x] TS-9.2 — Plugin lifecycle
- Create `src/plugins/plugin-lifecycle.service.ts`:
  - `install(dir)`, `activate(id)`, `deactivate(id)`, `uninstall(id)`
  - On activate: dynamic `require()` plugin entrypoint, call `plugin.activate(context)`, register hooks/blocks/routes, publish `plugin.activated` to AQ
  - On deactivate: call `plugin.deactivate()`, unregister hooks/blocks/routes, publish `plugin.deactivated`
  - Plugin `context` object: restricted service container (whitelist: `ContentService`, `AuditService`, `OracleService` read-only)
- API: `GET /api/v1/plugins`, `POST /api/v1/plugins/:id/activate`, `POST /api/v1/plugins/:id/deactivate`, `DELETE /api/v1/plugins/:id`
- Write integration tests
- Files: `src/plugins/plugin-lifecycle.service.ts`, `src/plugins/plugins.controller.ts`

### [x] TS-9.3 — Hook system
- Create `src/plugins/hook-manager.ts`:
  - `registerAction(hook, callback, priority)`, `doAction(hook, ...args)` — fires all registered callbacks in priority order
  - `registerFilter(hook, callback, priority)`, `applyFilters(hook, value, ...args)` — pipes value through callbacks
  - Initial hook points: `content.published`, `content.render`, `editor.block.register`, `admin.menu.register`, `api.request`, `api.response`
- Create `HookManagerModule` — global singleton, exported
- Write unit tests: execution order, filter chaining, error isolation (one bad hook doesn't break others)
- Files: `src/plugins/hook-manager.ts`, `src/plugins/hook-manager.module.ts`

### [x] TS-9.4 — Plugin sandboxing and custom endpoints
- Plugin API: `registerBlockType(name, renderComponent, settingsSchema)` — adds to block registry
- Plugin API: `registerRoute(method, path, handler)` — mounts under `/api/v1/plugins/{pluginName}/...`
- Permission enforcement: every plugin service call checks plugin manifest `permissions` array
- Rate limit plugin API calls: 100 req/min per plugin via Valkey counter
- Error isolation: uncaught plugin error caught, logged, plugin marked `error` status, does not crash host
- Write unit tests for permission enforcement, rate limiting, error isolation
- Files: `src/plugins/plugin-sandbox.ts`, `src/plugins/plugin-router.ts`

### [x] TS-9.5 — Plugin settings UI
- Frontend: `frontend/src/features/plugins/PluginList.tsx` — installed plugins, status badge, activate/deactivate toggle
- Per-plugin settings page: dynamic form generated from manifest `settings` array (schema: `{ key, label, type: 'text'|'number'|'boolean'|'select', options? }`)
- API: `GET/PUT /api/v1/plugins/:id/settings`
- Files: `frontend/src/features/plugins/PluginList.tsx`, `frontend/src/features/plugins/PluginSettings.tsx`

---

## Phase 10: Admin UI

### [x] TS-10.1 — Admin layout and navigation
- `frontend/src/app/AdminLayout.tsx` — sidebar + top bar with user menu (name, role, logout)
- Navigation: Dashboard, Pages, Media, Data Sources, Plugins, Themes, Users, Audit Log, Settings
- Sidebar collapse on small screens (responsive)
- Dashboard route: summary cards (published pages, open drafts, media size, active plugins, graduation metrics from Apex if integrated)
- Files: `frontend/src/app/AdminLayout.tsx`, `frontend/src/app/routes.tsx`, `frontend/src/features/dashboard/Dashboard.tsx`

### [x] TS-10.2 — Pages and content management UI
- `PageList.tsx` — table: title, status badge, author, last modified, actions (edit, publish, delete)
- `PageEditor.tsx` — block editor (Phase 4) + metadata sidebar (slug, status, scheduled_at, tags, categories)
- Workflow action buttons: Submit / Approve / Publish / Archive based on current status + user role
- Revision history sidebar: list revisions, click to view diff, restore button
- Files: `frontend/src/features/content/PageList.tsx`, `frontend/src/features/content/PageEditor.tsx`, `frontend/src/features/content/RevisionSidebar.tsx`

### [x] TS-10.3 — Users, roles, and audit log UI
- `UserList.tsx` — user table with role badge, role assignment dropdown
- `RoleEditor.tsx` — create/edit role with permission checkboxes
- `AuditLogBrowser.tsx` — filterable paginated table (filter: entity type, actor, date range), expandable row shows diff JSON
- Files: `frontend/src/features/users/UserList.tsx`, `frontend/src/features/users/RoleEditor.tsx`, `frontend/src/features/audit/AuditLogBrowser.tsx`

### [x] TS-10.4 — Data sources, themes, and settings UI
- `DataSourceList.tsx` — connection status indicator, test button, create/edit form
- `ThemeManager.tsx` — installed themes, activate button, per-theme settings form
- `SiteSettings.tsx` — site name, tagline, default language, cache management (Valkey flush button)
- Files: `frontend/src/features/data-viz/DataSourceList.tsx`, `frontend/src/features/themes/ThemeManager.tsx`, `frontend/src/features/settings/SiteSettings.tsx`

### [x] TS-10.5 — Notifications and webhook stubs
- Implement `NotificationService` — called by `workflow-transition.consumer.ts` when page published/approved
- Stub: log event + POST to configurable webhook URL (if `WEBHOOK_URL` env set)
- Frontend: `Notifications.tsx` — in-app notification bell, polling `GET /api/v1/notifications` every 30s
- Create `oracle/migrations/0013_notifications.sql`: `NOTIFICATIONS` table
- Files: `src/notifications/notification.service.ts`, `oracle/migrations/0013_notifications.sql`, `frontend/src/features/notifications/Notifications.tsx`

---

## Phase 11: Taxonomy and Knowledge Base

### [x] TS-11.1 — Categories and tags
- Create `oracle/migrations/0014_taxonomy.sql`:
  - `CATEGORIES` table: `ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `NAME VARCHAR2(255)`, `SLUG VARCHAR2(255) UNIQUE`, `PARENT_ID NUMBER REFERENCES CATEGORIES(ID)`, `SORT_ORDER NUMBER DEFAULT 0`
  - `TAGS` table: `ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `NAME VARCHAR2(255)`, `SLUG VARCHAR2(255) UNIQUE`
  - `PAGE_CATEGORIES` pivot: `PAGE_ID RAW(16)`, `CATEGORY_ID NUMBER`, PRIMARY KEY(PAGE_ID, CATEGORY_ID)
  - `PAGE_TAGS` pivot: `PAGE_ID RAW(16)`, `TAG_ID NUMBER`, PRIMARY KEY(PAGE_ID, TAG_ID)
- API: full CRUD for categories (including nested/parent), full CRUD for tags, attach/detach tags and categories on pages
- Write integration tests
- Files: `oracle/migrations/0014_taxonomy.sql`, `src/taxonomy/taxonomy.service.ts`, `src/taxonomy/taxonomy.controller.ts`

### [x] TS-11.2 — Knowledge base features
- Add `VIEW_COUNT NUMBER DEFAULT 0` to `PAGES` (in base migration or new column migration)
- Atomic increment: `UPDATE PAGES SET VIEW_COUNT = VIEW_COUNT + 1 WHERE ID = :id` (concurrency-safe in Oracle)
- `PAGE_RATINGS` table: `ID RAW(16)`, `PAGE_ID RAW(16)`, `HELPFUL NUMBER(1) CHECK (HELPFUL IN (0,1))`, `CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`
- API: `POST /api/v1/pages/:id/view` — increment view count (rate-limited: 1 per IP per hour via Valkey)
- API: `POST /api/v1/pages/:id/rate` `{ "helpful": true|false }`
- Include `view_count`, `helpful_pct` in page detail API response
- Write unit tests for helpfulness aggregation
- Files: `oracle/migrations/0015_knowledge_base.sql`, `src/content/knowledge-base.service.ts`

---

## Phase 12: Observability & Hardening

### [ ] TS-12.1 — Structured logging
- Install `pino` (MIT) as NestJS logger adapter
- Log format: JSON to stdout. Every request log includes `request_id` (generated UUID), `method`, `path`, `status`, `duration_ms`, `user_id`
- Create `src/observability/logging.interceptor.ts` — global interceptor adding request_id to all logs
- Files: `src/observability/logging.interceptor.ts`, `src/observability/logger.service.ts`

### [ ] TS-12.2 — Metrics and tracing
- Install `@opentelemetry/sdk-node` (Apache 2.0), `@opentelemetry/exporter-prometheus`
- Prometheus metrics endpoint at `/metrics`: HTTP request rate, latency histogram (p50/p95/p99), Oracle pool utilization, Valkey cache hit rate, AQ queue depth
- Distributed tracing spans: HTTP handler → service → Oracle query → Valkey
- Create Grafana dashboard definitions in `docker/grafana/dashboards/`
- Files: `src/observability/telemetry.ts`, `docker/grafana/dashboards/aurora-api.json`

### [ ] TS-12.3 — Rate limiting and security hardening
- Install `@nestjs/throttler` (MIT) — configure globally: 100 req/min standard, 10 req/min auth endpoints
- Add security headers middleware: CSP, X-Frame-Options, X-Content-Type-Options, HSTS
- Input sanitization: `class-sanitizer` on all DTOs
- `npm audit` in CI — fail on high/critical severity
- Oracle connection: enforce read-only role for query engine data sources
- Files: `src/common/middleware/security-headers.middleware.ts`, updates to `app.module.ts`

### [ ] TS-12.4 — Oracle partition strategy for large tables
- **Oracle-native improvement:** Create `oracle/migrations/0016_partitioning.sql`
  - Partition `AUDIT_LOG` by `CREATED_AT` (range-monthly) — prevents unbounded table growth
  - Partition `REVISIONS` by `CREATED_AT` (range-quarterly) — old revisions stay queryable but on cheaper tablespace
  - Partition `PAGE_RATINGS` by `CREATED_AT` (range-monthly)
  - Add local indexes on partitioned tables
- No application code changes needed — partitioning is transparent to queries
- Files: `oracle/migrations/0016_partitioning.sql`

---

## Phase 13: E2E and Integration Tests

### [ ] TS-13.1 — E2E critical paths (Playwright)
- `test/e2e/auth.spec.ts` — Login via Keycloak → redirect to admin dashboard → user is authenticated
- `test/e2e/content.spec.ts` — Create page with text+image blocks → publish → verify SSR HTML contains block content
- `test/e2e/search.spec.ts` — Publish page → search endpoint returns it (CSV mode: verify response shape and mock search result)
- `test/e2e/media.spec.ts` — Upload image → appears in media library → insert into page block
- `test/e2e/workflow.spec.ts` — Author creates draft → Editor approves → Admin publishes → page is live
- Run with `DB_DRIVER=csv` — no Oracle connection required for E2E
- Files: `test/e2e/*.spec.ts`

### [ ] TS-13.2 — Integration test: Page CRUD with blocks and revisions (`// @csv-mode`)
- `DB_DRIVER=csv` — all persistence through `CsvDriver` in-memory store
- Create page via API, add multiple blocks, verify blocks stored in `DbService` in-memory state
- Update blocks (add/reorder/remove), verify revision auto-created for each save
- Restore revision, verify block order matches snapshot
- Soft-delete page, verify `DELETED_AT` set in in-memory store, page excluded from list results
- **NOTE:** Oracle Text index calls are mocked — `SearchService.index()` spy asserts called, no SQL executed
- Files: `test/integration/content-lifecycle.integration.spec.ts`

### [ ] TS-13.3 — Integration test: Oracle AQ event flow (`// @csv-mode`)
- `DB_DRIVER=csv` — `OracleAqService` uses an in-memory queue (array) instead of Oracle AQ when CSV mode is active
- Publish event to in-memory queue via `OracleAqService.publish()`
- Run consumer poll once, verify `SearchService.index()` spy called with correct page ID
- Publish `media.uploaded` event, verify `VariantService.generateVariants()` spy called
- Verify idempotency: publish same event twice, assert downstream called only once (dedup by event ID)
- Files: `test/integration/oracle-aq.integration.spec.ts`

### [ ] TS-13.4 — Integration test: Data query with cache (`// @csv-mode`)
- `DB_DRIVER=csv` — Oracle source driver replaced by CSV driver reading `test/fixtures/csv/CONTENT_ANALYTICS_MV.csv`
- Execute query via `QueryEngine`, verify result rows match fixture data, `meta.cached = false`
- Execute same query again, verify Valkey cache hit: `meta.cached = true`, same rows returned
- Clear Valkey cache key, execute again, verify `meta.cached = false`
- Files: `test/integration/data-query.integration.spec.ts`

### [ ] TS-13.5 — Integration test: Plugin lifecycle with hook execution (`// @csv-mode`)
- `DB_DRIVER=csv` — plugin records persisted in `CsvDriver` in-memory store
- Install test plugin from `test/fixtures/test-plugin/`
- Activate via `PluginLifecycleService`, verify in-memory AQ queue received `plugin.activated` event
- Register action hook on `content.published` via test plugin's `activate()` callback
- Publish a page, verify hook callback spy was called
- Deactivate plugin, publish another page, verify hook spy NOT called again
- Files: `test/integration/plugin-lifecycle.integration.spec.ts`

---

## Summary: Task Count by Phase

| Phase | Name | Tasks |
|-------|------|-------|
| 0 | Project Scaffolding | 6 |
| 1 | Auth & Users | 5 |
| 2 | Content Management | 5 |
| 3 | Media Management | 3 |
| 4 | Block Editor | 5 |
| 5 | Oracle Text Search | 2 |
| 6 | Oracle AQ Events | 2 |
| 7 | Themes (SSR) | 2 |
| 8 | Data Visualization | 5 |
| 9 | Plugin System | 5 |
| 10 | Admin UI | 5 |
| 11 | Taxonomy & KB | 2 |
| 12 | Observability & Hardening | 4 |
| 13 | E2E & Integration Tests | 5 |
| **Total** | | **61 tasks** |

---

## Oracle 19c Feature Map

| Original PHP Stack | TypeScript/Oracle 19c Replacement |
|---|---|
| OpenSearch | Oracle Text (`CTXSYS.CONTEXT` index) |
| NATS JetStream | Oracle Advanced Queuing (`DBMS_AQ`) |
| PostgreSQL JSONB | Oracle `CLOB IS JSON` + `JSON_VALUE` / `JSON_TABLE` |
| Laravel scheduler | NestJS `@nestjs/schedule` + Oracle DBMS_SCHEDULER for DB-level jobs |
| Eloquent soft deletes | `DELETED_AT TIMESTAMP WITH TIME ZONE` nullable column |
| PostgreSQL cursor pagination | Oracle `ROW_NUMBER() OVER (ORDER BY ...)` with bind variables |
| Manual audit log | PL/SQL hash-chained `audit_pkg` — tamper-evident |
| Ad-hoc analytics queries | Oracle materialized views (`CONTENT_ANALYTICS_MV`) |
| Large table growth | Oracle range-monthly partitioning on audit/revision tables |
