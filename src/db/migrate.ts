/**
 * Migration runner — execute with: npm run db:migrate
 * CSV mode: DDL is a no-op; migration names tracked in memory (resets each run).
 * Oracle mode: executes SQL, records applied migrations in SCHEMA_MIGRATIONS.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { IDbService } from './db.interface';

const appliedInMemory = new Set<string>();

async function loadDriver(): Promise<IDbService> {
  if (process.env['DB_DRIVER'] === 'oracle') {
    const { OracleDriver } = await import('./oracle.driver');
    const driver = new OracleDriver();
    await driver.onModuleInit();
    return driver;
  }
  const { CsvDriver } = await import('./csv.driver');
  const driver = new CsvDriver();
  await driver.onModuleInit();
  return driver;
}

async function getApplied(db: IDbService): Promise<Set<string>> {
  if (process.env['DB_DRIVER'] !== 'oracle') return appliedInMemory;
  const rows = await db.query<{ MIGRATION_NAME: string }>(
    'SELECT MIGRATION_NAME FROM SCHEMA_MIGRATIONS ORDER BY APPLIED_AT',
  );
  return new Set(rows.map((r) => r.MIGRATION_NAME));
}

async function markApplied(db: IDbService, name: string): Promise<void> {
  if (process.env['DB_DRIVER'] !== 'oracle') {
    appliedInMemory.add(name);
    return;
  }
  await db.execute(
    'INSERT INTO SCHEMA_MIGRATIONS (MIGRATION_NAME, APPLIED_AT) VALUES (:name, SYSTIMESTAMP)',
    { name },
  );
}

function splitStatements(sql: string): string[] {
  // Split on lines containing only "/" (PL/SQL block terminator) or ";" at end of statement.
  const statements: string[] = [];
  let current = '';
  for (const line of sql.split(/\r?\n/)) {
    if (line.trim() === '/') {
      if (current.trim()) statements.push(current.trim());
      current = '';
    } else {
      current += line + '\n';
    }
  }
  // Split remaining on ";" not inside a string
  current
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .forEach((s) => statements.push(s));
  return statements;
}

async function run(): Promise<void> {
  const migrationsDir = path.join(__dirname, '../../oracle/migrations');
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const db = await loadDriver();
  const applied = await getApplied(db);

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Already applied: ${file}`);
      continue;
    }
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    const statements = splitStatements(sql).filter(
      (s) => !s.startsWith('--') && !s.startsWith('/*'),
    );
    console.log(`Applying: ${file} (${statements.length} statement(s))`);
    for (const stmt of statements) {
      await db.execute(stmt);
    }
    await markApplied(db, file);
    console.log(`Applied: ${file}`);
  }

  console.log('All migrations complete.');
}

run().catch((err: unknown) => {
  console.error('Migration failed:', err);
  throw err;
});
