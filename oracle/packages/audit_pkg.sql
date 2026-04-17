-- BUILD ONLY: run npm run db:migrate when Oracle available
-- Requires EXECUTE privilege on DBMS_CRYPTO (granted to DBA by default).
-- Grant: GRANT EXECUTE ON DBMS_CRYPTO TO AURORA_CMS;

CREATE OR REPLACE PACKAGE audit_pkg AS
  PROCEDURE INSERT_ENTRY(
    p_actor_id    IN RAW,
    p_action      IN VARCHAR2,
    p_entity_type IN VARCHAR2,
    p_entity_id   IN VARCHAR2,
    p_diff        IN CLOB
  );
END audit_pkg;
/

CREATE OR REPLACE PACKAGE BODY audit_pkg AS

  -- Builds a tamper-evident SHA-256 hash chain:
  --   hash = SHA256(prev_hash || actor_id || action || entity_type || entity_id || diff || created_at)
  -- prev_hash is the HASH of the most recently inserted row, or 64 zeros for the first row.
  PROCEDURE INSERT_ENTRY(
    p_actor_id    IN RAW,
    p_action      IN VARCHAR2,
    p_entity_type IN VARCHAR2,
    p_entity_id   IN VARCHAR2,
    p_diff        IN CLOB
  ) AS
    v_prev_hash  VARCHAR2(64);
    v_created_at VARCHAR2(40);
    v_payload    VARCHAR2(32767);
    v_hash       VARCHAR2(64);
  BEGIN
    -- Fetch the most recent hash to continue the chain.
    BEGIN
      SELECT HASH INTO v_prev_hash
      FROM   AUDIT_LOG
      WHERE  CREATED_AT = (SELECT MAX(CREATED_AT) FROM AUDIT_LOG);
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        -- Genesis entry: no prior row.
        v_prev_hash := LPAD('0', 64, '0');
    END;

    v_created_at := TO_CHAR(SYSTIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"');

    -- Concatenate all fields that the hash covers.
    v_payload :=
      NVL(v_prev_hash,                     '') ||
      NVL(RAWTOHEX(p_actor_id),            '') ||
      NVL(p_action,                        '') ||
      NVL(p_entity_type,                   '') ||
      NVL(p_entity_id,                     '') ||
      NVL(DBMS_LOB.SUBSTR(p_diff, 32000),  '') ||
      v_created_at;

    v_hash := RAWTOHEX(
      DBMS_CRYPTO.HASH(
        UTL_I18N.STRING_TO_RAW(v_payload, 'AL32UTF8'),
        DBMS_CRYPTO.HASH_SH256
      )
    );

    INSERT INTO AUDIT_LOG (
      ACTOR_ID, ACTION, ENTITY_TYPE, ENTITY_ID, DIFF,
      PREV_HASH, HASH, CREATED_AT
    ) VALUES (
      p_actor_id, p_action, p_entity_type, p_entity_id, p_diff,
      v_prev_hash, v_hash, SYSTIMESTAMP
    );

    COMMIT;
  END INSERT_ENTRY;

END audit_pkg;
/

-- Restrict execution to AURORA_CMS only.
GRANT EXECUTE ON audit_pkg TO AURORA_CMS;
