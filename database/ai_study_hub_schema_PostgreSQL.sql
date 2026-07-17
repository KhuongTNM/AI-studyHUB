-- ============================================================
-- AI Study Hub — Full Schema (PostgreSQL)
-- Schemas: payment | core | docs | ai | group_chat
-- ============================================================

CREATE SCHEMA IF NOT EXISTS payment;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS docs;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS group_chat;

-- Extension pgvector (cần cho ai.document_chunks)
CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;

-- ============================================================
-- Schema: payment
-- ============================================================

CREATE TABLE payment.subscription_plans (
  id                    SERIAL         PRIMARY KEY,
  name                  VARCHAR(20)    UNIQUE NOT NULL,
  display_name          VARCHAR(50)    NOT NULL,
  price                 DECIMAL(10,2)  NOT NULL DEFAULT 0,
  max_room_members      SMALLINT       NOT NULL DEFAULT 0,
  default_storage_bytes BIGINT         NOT NULL DEFAULT 536870912,
  create_group_limit    INT            NOT NULL DEFAULT 0,
  join_group_limit      INT            NOT NULL DEFAULT 5,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE payment.subscription_purchases (
  id                    BIGSERIAL      PRIMARY KEY,
  order_code            BIGINT         UNIQUE NOT NULL,
  order_id              VARCHAR(20)    UNIQUE NOT NULL,
  user_id               UUID           NOT NULL,
  plan_id               INT            NOT NULL,
  plan_name             VARCHAR(20)    NOT NULL,
  display_name          VARCHAR(100)   NOT NULL,
  amount                DECIMAL(10,2)  NOT NULL,
  storage_limit_bytes   BIGINT         NOT NULL,
  status                VARCHAR(20)    NOT NULL DEFAULT 'PENDING'
                                      CHECK (status IN ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED')),
  payment_link_id       VARCHAR(100),
  qr_code               TEXT,
  checkout_url          TEXT,
  bank_code             VARCHAR(20),
  bank_account          VARCHAR(50),
  account_name          VARCHAR(100),
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ    NOT NULL,
  paid_at               TIMESTAMPTZ
);

-- ============================================================
-- Schema: core
-- ============================================================

CREATE TABLE core.users (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   VARCHAR(255) UNIQUE NOT NULL,
  password_hash           VARCHAR(255) NOT NULL,
  display_name            VARCHAR(50)  NOT NULL,
  role                    VARCHAR(10)  NOT NULL CHECK (role IN ('user', 'admin', 'sub_admin')) DEFAULT 'user',
  is_locked               BOOLEAN      NOT NULL DEFAULT FALSE,
  login_attempts          SMALLINT     NOT NULL DEFAULT 0,
  storage_limit_bytes     BIGINT       NOT NULL DEFAULT 536870912,
  storage_used_bytes      BIGINT       NOT NULL DEFAULT 0,
  subscription_plan_id    INT,
  subscription_expires_at TIMESTAMPTZ,
  language_pref           VARCHAR(5)   NOT NULL CHECK (language_pref IN ('vi', 'en')) DEFAULT 'vi',
  theme_pref              VARCHAR(10)  NOT NULL CHECK (theme_pref IN ('light', 'dark')) DEFAULT 'light',
  created_by_admin_id     UUID,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ
);

CREATE TABLE core.activity_logs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID         NOT NULL,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   VARCHAR(255),
  details     JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE core.password_reset_tokens (
  id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email   VARCHAR(255) NOT NULL,
  token   VARCHAR(36)  UNIQUE NOT NULL,
  expiry  TIMESTAMPTZ  NOT NULL,
  used    BOOLEAN      NOT NULL DEFAULT FALSE,
  user_id UUID
);

-- ============================================================
-- Schema: docs
-- ============================================================

CREATE TABLE docs.folders (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL,
  parent_id  UUID,
  name       VARCHAR(255) NOT NULL,
  subject    VARCHAR(100),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE docs.documents (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL,
  folder_id       UUID,
  original_name   VARCHAR(255) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  file_url        TEXT         NOT NULL,
  file_size_bytes BIGINT       NOT NULL,
  file_type       VARCHAR(10)  NOT NULL CHECK (file_type IN ('pdf', 'docx', 'pptx')),
  subject         VARCHAR(100) NOT NULL,
  description     TEXT,
  tags            VARCHAR(500),
  status          VARCHAR(20)  NOT NULL CHECK (status IN ('uploading', 'scanning', 'ready', 'failed', 'deleted')) DEFAULT 'uploading',
  embedding_status VARCHAR(20) NOT NULL CHECK (embedding_status IN ('none', 'processing', 'done', 'failed')) DEFAULT 'none',
  visibility      VARCHAR(10)  NOT NULL CHECK (visibility IN ('private', 'public')) DEFAULT 'private',
  share_status    VARCHAR(10)  NOT NULL CHECK (share_status IN ('none', 'pending', 'approved', 'rejected')) DEFAULT 'none',
  share_note      TEXT,
  download_count  INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE docs.tags (
  id   BIGSERIAL    PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE docs.document_tags (
  document_id UUID   NOT NULL,
  tag_id      BIGINT NOT NULL,
  PRIMARY KEY (document_id, tag_id)
);

CREATE TABLE docs.chat_sessions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL,
  title       VARCHAR(255),
  document_id UUID,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE docs.chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL,
  role       VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Schema: ai
-- ============================================================

CREATE TABLE ai.flashcards (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL,
  document_id     UUID,
  question        TEXT        NOT NULL,
  answer          TEXT        NOT NULL,
  status          VARCHAR(10) NOT NULL CHECK (status IN ('new', 'learning', 'mastered')) DEFAULT 'new',
  is_ai_generated BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai.document_chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        NOT NULL,
  user_id     UUID        NOT NULL,
  chunk_index INT         NOT NULL,
  content     TEXT        NOT NULL,
  token_count INT,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

-- ============================================================
-- Schema: group_chat
-- ============================================================

CREATE TABLE group_chat.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code VARCHAR(32)  UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  owner_id  UUID NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE group_chat.group_members (
  group_id  UUID        NOT NULL,
  user_id   UUID        NOT NULL,
  role      VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  muted     BOOLEAN     NOT NULL DEFAULT FALSE,
  pinned    BOOLEAN     NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status    VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'JOINED')) DEFAULT 'JOINED',
  PRIMARY KEY (group_id, user_id),
  CONSTRAINT fk_group_member_group FOREIGN KEY (group_id) REFERENCES group_chat.groups(id) ON DELETE CASCADE
);

CREATE TABLE group_chat.group_messages (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID         NOT NULL,
  sender_id    UUID,
  content      TEXT         NOT NULL,
  message_type VARCHAR(20)  NOT NULL CHECK (message_type IN ('text', 'document', 'image', 'system')),
  document_id  UUID,
  image_url    VARCHAR(1000),
  image_name   VARCHAR(255),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_group_message_group FOREIGN KEY (group_id) REFERENCES group_chat.groups(id) ON DELETE CASCADE
);


CREATE TABLE group_chat.group_reports (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID         NOT NULL,
  reporter_id UUID         NOT NULL,
  reason      VARCHAR(500) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_group_report_group FOREIGN KEY (group_id) REFERENCES group_chat.groups(id) ON DELETE CASCADE
);

-- ============================================================
-- Indexes
-- ============================================================

-- core
CREATE INDEX idx_users_email      ON core.users (email);
CREATE INDEX idx_users_role       ON core.users (role);
CREATE INDEX idx_users_plan       ON core.users (subscription_plan_id);
CREATE INDEX idx_users_is_locked  ON core.users (is_locked);
CREATE INDEX idx_al_actor_id      ON core.activity_logs (actor_id, created_at);
CREATE INDEX idx_al_target        ON core.activity_logs (target_type, target_id);
CREATE INDEX idx_al_created_at    ON core.activity_logs (created_at);
CREATE INDEX idx_prt_email        ON core.password_reset_tokens (email);
CREATE INDEX idx_prt_token        ON core.password_reset_tokens (token);
CREATE INDEX idx_prt_user_id      ON core.password_reset_tokens (user_id);

-- payment
CREATE INDEX idx_sub_purchases_user_id    ON payment.subscription_purchases (user_id);
CREATE INDEX idx_sub_purchases_plan_id    ON payment.subscription_purchases (plan_id);
CREATE INDEX idx_sub_purchases_status     ON payment.subscription_purchases (status);
CREATE INDEX idx_sub_purchases_created_at ON payment.subscription_purchases (created_at);
CREATE INDEX idx_sub_purchases_expires_at ON payment.subscription_purchases (expires_at);

-- docs
CREATE INDEX idx_folders_user_id    ON docs.folders (user_id);
CREATE INDEX idx_folders_parent_id  ON docs.folders (parent_id);
CREATE INDEX idx_folders_subject    ON docs.folders (subject);
CREATE INDEX idx_docs_user_id       ON docs.documents (user_id);
CREATE INDEX idx_docs_subject       ON docs.documents (subject);
CREATE INDEX idx_docs_status        ON docs.documents (status);
CREATE INDEX idx_docs_visibility    ON docs.documents (visibility, share_status);
CREATE INDEX idx_docs_deleted_at    ON docs.documents (deleted_at);
CREATE INDEX idx_docs_title_subject ON docs.documents (title, subject);
CREATE INDEX idx_dt_document        ON docs.document_tags (document_id);
CREATE INDEX idx_dt_tag             ON docs.document_tags (tag_id);
CREATE INDEX idx_cs_user_id         ON docs.chat_sessions (user_id, created_at);
CREATE INDEX idx_cm_session         ON docs.chat_messages (session_id, created_at);

-- ai
CREATE INDEX idx_fc_user_id     ON ai.flashcards (user_id);
CREATE INDEX idx_fc_document_id ON ai.flashcards (document_id);
CREATE INDEX idx_fc_status      ON ai.flashcards (user_id, status);
CREATE INDEX idx_dc_document_id ON ai.document_chunks (document_id);
CREATE INDEX idx_dc_user_id     ON ai.document_chunks (user_id);
CREATE INDEX idx_dc_embedding   ON ai.document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- group_chat
CREATE INDEX idx_groups_code      ON group_chat.groups (group_code);
CREATE INDEX idx_groups_owner_id  ON group_chat.groups (owner_id);
CREATE INDEX idx_gmem_group_id    ON group_chat.group_members (group_id);
CREATE INDEX idx_gmem_user_id     ON group_chat.group_members (user_id);
CREATE INDEX idx_gmsg_group_id    ON group_chat.group_messages (group_id, created_at);
CREATE INDEX idx_greports_group   ON group_chat.group_reports (group_id);

-- ============================================================
-- Foreign Keys
-- ============================================================

-- core → payment
ALTER TABLE core.users ADD FOREIGN KEY (subscription_plan_id)
  REFERENCES payment.subscription_plans (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payment.subscription_purchases ADD FOREIGN KEY (user_id)
  REFERENCES core.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payment.subscription_purchases ADD FOREIGN KEY (plan_id)
  REFERENCES payment.subscription_plans (id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

-- core → core
ALTER TABLE core.users ADD FOREIGN KEY (created_by_admin_id)
  REFERENCES core.users (id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE core.activity_logs ADD FOREIGN KEY (actor_id)
  REFERENCES core.users (id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE core.password_reset_tokens ADD FOREIGN KEY (user_id)
  REFERENCES core.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- docs → core
ALTER TABLE docs.folders ADD FOREIGN KEY (user_id)
  REFERENCES core.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE docs.documents ADD FOREIGN KEY (user_id)
  REFERENCES core.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE docs.chat_sessions ADD FOREIGN KEY (user_id)
  REFERENCES core.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- docs → docs
ALTER TABLE docs.folders ADD FOREIGN KEY (parent_id)
  REFERENCES docs.folders (id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE docs.documents ADD FOREIGN KEY (folder_id)
  REFERENCES docs.folders (id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE docs.document_tags ADD FOREIGN KEY (document_id)
  REFERENCES docs.documents (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE docs.document_tags ADD FOREIGN KEY (tag_id)
  REFERENCES docs.tags (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE docs.chat_sessions ADD FOREIGN KEY (document_id)
  REFERENCES docs.documents (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE docs.chat_messages ADD FOREIGN KEY (session_id)
  REFERENCES docs.chat_sessions (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- ai → core + docs
ALTER TABLE ai.flashcards ADD FOREIGN KEY (user_id)
  REFERENCES core.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai.flashcards ADD FOREIGN KEY (document_id)
  REFERENCES docs.documents (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai.document_chunks ADD FOREIGN KEY (document_id)
  REFERENCES docs.documents (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai.document_chunks ADD FOREIGN KEY (user_id)
  REFERENCES core.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- group_chat → core + docs
ALTER TABLE group_chat.groups ADD FOREIGN KEY (owner_id)
  REFERENCES core.users (id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE group_chat.group_members ADD FOREIGN KEY (user_id)
  REFERENCES core.users (id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE group_chat.group_messages ADD FOREIGN KEY (sender_id)
  REFERENCES core.users (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE group_chat.group_reports ADD FOREIGN KEY (reporter_id)
  REFERENCES core.users (id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE group_chat.group_messages ADD FOREIGN KEY (document_id)
  REFERENCES docs.documents (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

-- group_chat → group_chat
ALTER TABLE group_chat.group_members ADD FOREIGN KEY (group_id)
  REFERENCES group_chat.groups (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE group_chat.group_messages ADD FOREIGN KEY (group_id)
  REFERENCES group_chat.groups (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE group_chat.group_reports ADD FOREIGN KEY (group_id)
  REFERENCES group_chat.groups (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- ============================================================
-- Seed Data
-- ============================================================

INSERT INTO payment.subscription_plans
  (name, display_name, price, max_room_members, default_storage_bytes, create_group_limit, join_group_limit)
VALUES
  ('free',        'Gói Miễn Phí',  0,     0,  536870912,  0,  5),
  ('plan_2_4',    'Gói 2-4 Người', 49000, 4,  1073741824, 20, 30),
  ('plan_5_plus', 'Gói 5+ Người',  99000, 99, 5368709120, 50, 60);

-- ============================================================
-- Advanced RAG: Hybrid Search (FTS)
-- ============================================================
ALTER TABLE ai.document_chunks ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;
CREATE INDEX IF NOT EXISTS idx_dc_fts ON ai.document_chunks USING GIN (fts);
