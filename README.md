# Aurora

TypeScript / NestJS rewrite of Aurora CMS. Targets Oracle 19c in production; ships with a CSV driver for local dev so you can run end-to-end without a database.

- **API**: NestJS 10 + Express + `class-validator`
- **Auth**: Passport-JWT (OIDC-ready) with an `E2E_AUTH_BYPASS` shortcut for tests
- **Templating**: Handlebars themes under `themes/`
- **Search**: OpenSearch in prod, CSV-backed fallback in dev
- **Events / Cache**: NATS JetStream, Redis/Valkey
- **Storage**: S3 (AWS SDK v3), local disk fallback

See `AGENTS.md` for contributor standards and `CLAUDE.md` for the workspace-level guide.

## Quickstart (local, CSV driver)

Prereqs: Node ≥ 20, npm ≥ 10.

```bash
npm install
npm run build
DB_DRIVER=csv npm run start:prod
```

Server binds `http://127.0.0.1:3000`. Health probe:

```bash
curl -i http://127.0.0.1:3000/api/v1/pages
# HTTP/1.1 401 Unauthorized   ← auth chain is live
```

For a watch loop during development:

```bash
DB_DRIVER=csv npm run start:dev
```

## Running E2E tests

E2E relies on a header-based auth bypass (guarded so it no-ops when `NODE_ENV=production`).

Terminal 1 — server:

```bash
E2E_AUTH_BYPASS=true NODE_ENV=test DB_DRIVER=csv npm run start:prod
```

Terminal 2 — Playwright:

```bash
npm run test:e2e
```

Requests inside tests send `X-Test-User-Id: <id>` and get a mock admin user (`roles: ['admin', 'admin.*']`).

## Full stack (Docker)

A `docker-compose.yml` is included for the full stack (Postgres/Valkey/OpenSearch/NATS/Keycloak). Not exercised by the CSV quickstart above:

```bash
docker compose up -d
```

## Gates

| Gate | Command |
|------|---------|
| Build | `npm run build` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| Integration (CSV) | `npm run test:integration` |
| Integration (Oracle) | `npm run test:oracle` |
| E2E | `npm run test:e2e` |
| License audit | `npm run license-check` |

## Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DB_DRIVER` | `csv` \| `oracle` \| `postgres` | required |
| `NODE_ENV` | `development` \| `test` \| `production` | `development` |
| `E2E_AUTH_BYPASS` | Enables `X-Test-User-Id` header bypass. Ignored if `NODE_ENV=production`. | unset |
| `PORT` | HTTP listen port | `3000` |

Oracle, S3, Redis, NATS, and OIDC settings are read from env when their drivers are selected; see `src/config/` for the full surface.

## Caveats

- `DB_DRIVER=csv` is dev-only. The CSV driver is a regex-based "pretend Oracle" for fixtures — don't point it at anything you care about.
- `E2E_AUTH_BYPASS` must never be set in production. The guard in `src/auth/jwt-auth.guard.ts` refuses to honor it when `NODE_ENV=production`, but don't rely on that as the only line of defense.
- `npm run build` is required before `npm run start:prod`. Use `start:dev` for the watcher.

## License

MIT. Third-party dependencies are restricted to permissive licenses (MIT / Apache-2.0 / BSD / ISC / 0BSD) — see `license-policy.json` and the `license-check` script.
