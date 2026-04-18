-- BUILD ONLY: run npm run db:migrate when Oracle available

CREATE TABLE BLOCK_TEMPLATES (
  ID           RAW(16)                                DEFAULT SYS_GUID()  PRIMARY KEY,
  NAME         VARCHAR2(255)                          NOT NULL,
  BLOCK_TYPE   VARCHAR2(50)                           NOT NULL,
  CONTENT      CLOB                                   CHECK (CONTENT IS JSON),
  CREATED_BY   RAW(16)                                REFERENCES USERS(ID),
  CREATED_AT   TIMESTAMP WITH TIME ZONE              DEFAULT SYSTIMESTAMP
);

CREATE INDEX IDX_BLOCK_TEMPLATES_TYPE       ON BLOCK_TEMPLATES(BLOCK_TYPE);
CREATE INDEX IDX_BLOCK_TEMPLATES_CREATED_BY ON BLOCK_TEMPLATES(CREATED_BY);
