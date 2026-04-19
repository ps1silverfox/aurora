-- BUILD ONLY: run npm run db:migrate when Oracle available

-- ============================================================
-- TS-12.4: Oracle Range Partitioning for high-growth tables
--
-- Strategy:
--   AUDIT_LOG     → range-monthly   (unbounded append-only log)
--   REVISIONS     → range-quarterly (older revisions age to cheap tablespace)
--   PAGE_RATINGS  → range-monthly   (feedback data grows with traffic)
--
-- All existing tables are recreated as partitioned; data migration
-- is handled by the migration runner (INSERT INTO ... SELECT).
--
-- LOCAL indexes keep partition independence: dropping a partition
-- (archiving old months) does not require global index rebuild.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. AUDIT_LOG — range-monthly on CREATED_AT
-- ----------------------------------------------------------------
-- Drop original table (rename to _OLD first for safety in migration runner)
RENAME AUDIT_LOG TO AUDIT_LOG_OLD;

CREATE TABLE AUDIT_LOG (
    ID              RAW(16)                     DEFAULT SYS_GUID() NOT NULL,
    ACTOR_ID        RAW(16),
    ACTION          VARCHAR2(100)               NOT NULL,
    ENTITY_TYPE     VARCHAR2(100),
    ENTITY_ID       VARCHAR2(255),
    DIFF            CLOB                        CONSTRAINT CHK_AUDIT_DIFF_JSON   CHECK (DIFF IS JSON),
    PREV_HASH       VARCHAR2(64),
    HASH            VARCHAR2(64)                NOT NULL,
    CREATED_AT      TIMESTAMP WITH TIME ZONE    DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_AUDIT_LOG PRIMARY KEY (ID, CREATED_AT)
)
PARTITION BY RANGE (CREATED_AT) INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'))
(
    -- Seed partition; INTERVAL clause auto-creates subsequent monthly partitions
    PARTITION P_AUDIT_INITIAL VALUES LESS THAN (TIMESTAMP '2025-01-01 00:00:00 UTC')
);

-- Migrate data from old table
INSERT /*+ APPEND */ INTO AUDIT_LOG
    SELECT ID, ACTOR_ID, ACTION, ENTITY_TYPE, ENTITY_ID, DIFF,
           PREV_HASH, HASH, CREATED_AT
    FROM   AUDIT_LOG_OLD;
COMMIT;

-- Local index: hash-chain lookups by ID; partition-aligned
CREATE UNIQUE INDEX IDX_AUDIT_ID_PART ON AUDIT_LOG (ID, CREATED_AT) LOCAL;

-- Local index: actor-based filter queries
CREATE INDEX IDX_AUDIT_ACTOR_PART ON AUDIT_LOG (ACTOR_ID, CREATED_AT) LOCAL;

-- Local index: entity-type + entity-id filter
CREATE INDEX IDX_AUDIT_ENTITY_PART ON AUDIT_LOG (ENTITY_TYPE, ENTITY_ID, CREATED_AT) LOCAL;

-- Drop old table once migration is verified
-- DROP TABLE AUDIT_LOG_OLD PURGE;

-- ----------------------------------------------------------------
-- 2. REVISIONS — range-quarterly on CREATED_AT
-- ----------------------------------------------------------------
RENAME REVISIONS TO REVISIONS_OLD;

CREATE TABLE REVISIONS (
    ID          RAW(16)                     DEFAULT SYS_GUID() NOT NULL,
    PAGE_ID     RAW(16)                     NOT NULL,
    TITLE       VARCHAR2(500),
    BLOCKS      CLOB                        CONSTRAINT CHK_REV_BLOCKS_JSON CHECK (BLOCKS IS JSON),
    CREATED_BY  RAW(16),
    CREATED_AT  TIMESTAMP WITH TIME ZONE    DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_REVISIONS PRIMARY KEY (ID, CREATED_AT)
)
PARTITION BY RANGE (CREATED_AT) INTERVAL (NUMTOYMINTERVAL(3, 'MONTH'))
(
    PARTITION P_REV_INITIAL VALUES LESS THAN (TIMESTAMP '2025-01-01 00:00:00 UTC')
);

INSERT /*+ APPEND */ INTO REVISIONS
    SELECT ID, PAGE_ID, TITLE, BLOCKS, CREATED_BY, CREATED_AT
    FROM   REVISIONS_OLD;
COMMIT;

-- Local index for page-level revision lookups (most common query)
CREATE INDEX IDX_REV_PAGE_PART ON REVISIONS (PAGE_ID, CREATED_AT DESC) LOCAL;

-- Local index for user-level audit of revision authorship
CREATE INDEX IDX_REV_AUTHOR_PART ON REVISIONS (CREATED_BY, CREATED_AT) LOCAL;

-- DROP TABLE REVISIONS_OLD PURGE;

-- ----------------------------------------------------------------
-- 3. PAGE_RATINGS — range-monthly on CREATED_AT
-- ----------------------------------------------------------------
RENAME PAGE_RATINGS TO PAGE_RATINGS_OLD;

CREATE TABLE PAGE_RATINGS (
    ID          RAW(16)                     DEFAULT SYS_GUID() NOT NULL,
    PAGE_ID     RAW(16)                     NOT NULL,
    HELPFUL     NUMBER(1)                   NOT NULL CONSTRAINT CHK_RATING_HELPFUL CHECK (HELPFUL IN (0, 1)),
    CREATED_AT  TIMESTAMP WITH TIME ZONE    DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_PAGE_RATINGS PRIMARY KEY (ID, CREATED_AT)
)
PARTITION BY RANGE (CREATED_AT) INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'))
(
    PARTITION P_RATINGS_INITIAL VALUES LESS THAN (TIMESTAMP '2025-01-01 00:00:00 UTC')
);

INSERT /*+ APPEND */ INTO PAGE_RATINGS
    SELECT ID, PAGE_ID, HELPFUL, CREATED_AT
    FROM   PAGE_RATINGS_OLD;
COMMIT;

-- Local index: aggregate helpful/unhelpful per page (used by knowledge-base.service)
CREATE INDEX IDX_RATINGS_PAGE_PART ON PAGE_RATINGS (PAGE_ID, HELPFUL, CREATED_AT) LOCAL;

-- DROP TABLE PAGE_RATINGS_OLD PURGE;

-- ----------------------------------------------------------------
-- Archival helper: example procedure to drop old monthly partition
-- Call this from DBMS_SCHEDULER to enforce a 24-month retention window.
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE DROP_OLD_AUDIT_PARTITION (p_months_back IN NUMBER DEFAULT 24) AS
    v_cutoff   TIMESTAMP WITH TIME ZONE;
    v_part     VARCHAR2(100);
BEGIN
    v_cutoff := SYSTIMESTAMP - NUMTOYMINTERVAL(p_months_back, 'MONTH');
    SELECT PARTITION_NAME INTO v_part
    FROM   USER_TAB_PARTITIONS
    WHERE  TABLE_NAME   = 'AUDIT_LOG'
      AND  HIGH_VALUE   < SYS_XMLGEN(v_cutoff)
    FETCH FIRST 1 ROW ONLY;
    EXECUTE IMMEDIATE 'ALTER TABLE AUDIT_LOG DROP PARTITION ' || v_part || ' UPDATE GLOBAL INDEXES';
EXCEPTION
    WHEN NO_DATA_FOUND THEN NULL;  -- nothing old enough to drop
END DROP_OLD_AUDIT_PARTITION;
/
