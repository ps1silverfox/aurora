-- BUILD ONLY: run npm run db:migrate when Oracle available

-- Materialized view aggregating content engagement metrics.
-- Refreshed on commit so dashboards always reflect the latest published state.
CREATE MATERIALIZED VIEW CONTENT_ANALYTICS_MV
  BUILD IMMEDIATE
  REFRESH FAST ON COMMIT
  ENABLE QUERY REWRITE
AS
SELECT
  cp.ID                                                        AS CONTENT_ID,
  cp.SLUG,
  cp.STATUS,
  cp.PUBLISHED_AT,
  cp.AUTHOR_ID,
  cp.CONTENT_TYPE,
  COUNT(DISTINCT cr.ID)                                        AS REVISION_COUNT,
  MAX(cr.CREATED_AT)                                           AS LAST_REVISED_AT,
  CAST(SYSTIMESTAMP AS TIMESTAMP WITH TIME ZONE)               AS REFRESHED_AT
FROM CONTENT_PAGES cp
LEFT JOIN CONTENT_REVISIONS cr ON cr.CONTENT_ID = cp.ID
GROUP BY
  cp.ID,
  cp.SLUG,
  cp.STATUS,
  cp.PUBLISHED_AT,
  cp.AUTHOR_ID,
  cp.CONTENT_TYPE;

CREATE INDEX IDX_CAMV_STATUS       ON CONTENT_ANALYTICS_MV (STATUS);
CREATE INDEX IDX_CAMV_PUBLISHED_AT ON CONTENT_ANALYTICS_MV (PUBLISHED_AT);
CREATE INDEX IDX_CAMV_AUTHOR_ID    ON CONTENT_ANALYTICS_MV (AUTHOR_ID);

-- Stub MV for signal/performance tracking — ready for Apex integration.
-- Populated from a future CONTENT_SIGNALS table (click events, dwell time, etc.).
CREATE MATERIALIZED VIEW SIGNAL_PERFORMANCE_MV
  BUILD DEFERRED
  REFRESH COMPLETE ON DEMAND
AS
SELECT
  NULL AS CONTENT_ID,
  NULL AS SIGNAL_TYPE,
  0    AS EVENT_COUNT,
  NULL AS WINDOW_START,
  NULL AS WINDOW_END
FROM DUAL
WHERE 1 = 0;
