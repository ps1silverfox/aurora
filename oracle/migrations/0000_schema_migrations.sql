-- BUILD ONLY: run npm run db:migrate when Oracle available
-- Creates the SCHEMA_MIGRATIONS table used by the migration runner.
-- Idempotent: skips creation if the table already exists.

BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE SCHEMA_MIGRATIONS (
      MIGRATION_NAME  VARCHAR2(255)           NOT NULL,
      APPLIED_AT      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT PK_SCHEMA_MIGRATIONS PRIMARY KEY (MIGRATION_NAME)
    )
  ';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
