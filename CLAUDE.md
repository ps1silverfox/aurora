# CLAUDE.md — Aurora CMS TypeScript Edition

## What This Is
Full TypeScript/NestJS rewrite of Aurora CMS. Oracle 19c replaces PostgreSQL. Oracle Text replaces OpenSearch. Oracle AQ replaces NATS.

## Critical Files
- `AGENTS.md` — authoritative conventions, forbidden patterns, directory structure
- `TASK.md` / `CTASK.md` — Ralph task list (61 tasks, 13 phases)
- `CLAUDE-CONTEXT.md` — environment setup notes

## Commands
```bash
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint strict
npm run format             # Prettier
npm test                   # Jest unit tests (DB_DRIVER=csv)
npm run test:integration   # Integration tests (DB_DRIVER=csv)
npm run test:e2e           # Playwright
npm run license-check      # No GPL/AGPL/SSPL
npm run db:migrate         # Oracle migrations (when Oracle available)
npm run build              # Production build
npm run start:dev          # NestJS dev server
```

## Test Mode
All tests default to `DB_DRIVER=csv`. No Oracle connection needed.
- Oracle DDL/PL/SQL files are build-only — write them, don't execute
- Integration tests use CsvDriver (in-memory)
- `npm run test:oracle` for real Oracle testing (when available)

## Key Conventions
- TypeScript strict mode, no `any`
- Oracle bind variables always — no string interpolation in SQL
- IDs: `RAW(16)` / `SYS_GUID()` mapped to UUID strings
- API: `/api/v1/`, RFC 7807 errors, cursor pagination
- Licenses: MIT/Apache-2.0/BSD/ISC only
- One commit per task, message prefix: `feat(TS-X.Y): description`
