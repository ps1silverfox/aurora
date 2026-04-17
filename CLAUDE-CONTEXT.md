# Aurora CMS TS — Ralph Context

## What this project is
Full TypeScript/NestJS rewrite of Aurora CMS (original was Laravel/PHP). Database is Oracle 19c instead of PostgreSQL. Oracle Text replaces OpenSearch. Oracle AQ replaces NATS JetStream.

## Critical reading before any task
- Read `AGENTS.md` fully before starting any task — it defines Oracle conventions, forbidden patterns, directory structure, and license policy.
- All npm packages must be MIT, Apache 2.0, BSD-2, BSD-3, ISC, or 0BSD. No GPL/AGPL/SSPL/LGPL.

## Test mode: CSV is default
All tests run with `DB_DRIVER=csv` (default). No Oracle connection needed.
- Oracle DDL files (`oracle/migrations/*.sql`) and PL/SQL packages (`oracle/packages/*.sql`) are **build-only** — write them, do not execute them.
- Integration tests use `CsvDriver` (in-memory). Oracle AQ uses an in-memory queue when `DB_DRIVER=csv`.
- To test against real Oracle (when available): `DB_DRIVER=oracle npm run test:oracle`

## Verify commands by phase
- **All tasks default:** `DB_DRIVER=csv npm run typecheck && DB_DRIVER=csv npm run lint && DB_DRIVER=csv npm test -- --testPathPattern=<module>`
- **Phase 0 scaffold (no tests yet):** `npm run typecheck && npm run lint`
- **Oracle DDL / PL/SQL tasks:** Verify by opening the file and checking it has no obvious syntax errors (no `sqlplus` required). Add a comment `-- BUILD ONLY: run npm run db:migrate when Oracle available` at the top of each migration file.

## Oracle environment
- Oracle Instant Client must be initialized before `oracledb` works: `process.env.ORACLE_LIB_DIR` or call `oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_21_x' })`
- Test schema user: `AURORA_TEST` — integration tests run against this user, not AURORA_CMS
- For Docker dev: Oracle XE image `gvenzl/oracle-xe:21-slim` is the target (free, no license required for dev)

## Git setup
- Init repo in this directory if not already done: `git init && git add -A && git commit -m "chore: initial scaffold"`
- One commit per completed task (Ralph does this automatically after verify passes)
- Commit message prefix: use task ID (e.g. `feat(TS-0.1): NestJS project init`)

## Known constraints
- This is a solo developer project — no CI environment initially; run tests locally
- Oracle Instant Client path on this machine should be confirmed before TS-0.2
