-- =============================================================
-- AI STUDY HUB — Database Schema (Microsoft SQL Server / T-SQL)
-- Group 07 | SU26SWP391
-- Dựa trên 70 Business Rules + Functional Requirements
-- Đã cập nhật: Thay thế Study Room bằng Group Chat (Task 18)
-- =============================================================

USE master;
GO

-- Tạo database (bỏ qua nếu đã có sẵn)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'AIStudyHub')
CREATE DATABASE AIStudyHub COLLATE Vietnamese_CI_AS;
GO

USE AIStudyHub;
GO


-- =============================================================
-- 1. SUBSCRIPTION_PLANS
-- Gói dịch vụ: Free / 2-4 người / 5+ người
-- =============================================================

CREATE TABLE subscription_plans (
                                    id                    INT           IDENTITY(1,1) PRIMARY KEY,
                                    name                  NVARCHAR(20)  NOT NULL UNIQUE
                                        CONSTRAINT chk_sp_name
                                            CHECK (name IN (N'free', N'plan_2_4', N'plan_5_plus')),
                                    display_name          NVARCHAR(50)  NOT NULL,
                                    price                 DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                                    max_room_members      SMALLINT      NOT NULL DEFAULT 0,
                                    default_storage_bytes BIGINT        NOT NULL DEFAULT 536870912,
                                    created_at            DATETIME2     NOT NULL DEFAULT GETDATE(),
                                    updated_at            DATETIME2     NOT NULL DEFAULT GETDATE()
);
GO

-- Seed data
INSERT INTO subscription_plans (name, display_name, price, max_room_members, default_storage_bytes)
VALUES
    (N'free',        N'Gói Miễn Phí',  0.00,   0,  536870912),   -- 512 MB
    (N'plan_2_4',    N'Gói 2-4 Người', 49000,  4,  1073741824),  -- 1 GB
    (N'plan_5_plus', N'Gói 5+ Người',  99000,  99, 5368709120);  -- 5 GB
GO


-- =============================================================
-- 2. USERS
-- Tất cả tài khoản: user / admin / sub_admin
-- =============================================================

CREATE TABLE users (
                       id                      UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                       email                   NVARCHAR(255)    NOT NULL UNIQUE,
                       password_hash           NVARCHAR(255)    NOT NULL,
                       display_name            NVARCHAR(50)     NOT NULL,
                       role                    NVARCHAR(10)     NOT NULL DEFAULT N'user'
                           CONSTRAINT chk_users_role
                               CHECK (role IN (N'user', N'admin', N'sub_admin')),
                       is_locked               BIT              NOT NULL DEFAULT 0,
                       login_attempts          SMALLINT         NOT NULL DEFAULT 0,
                       storage_limit_bytes     BIGINT           NOT NULL DEFAULT 536870912,
                       storage_used_bytes      BIGINT           NOT NULL DEFAULT 0,
                       subscription_plan_id    INT              NULL
                           CONSTRAINT fk_users_plan
                               REFERENCES subscription_plans(id) ON DELETE SET NULL,
                       subscription_expires_at DATETIME2        NULL,
                       language_pref           NVARCHAR(5)      NOT NULL DEFAULT N'vi'
                           CONSTRAINT chk_users_lang
                               CHECK (language_pref IN (N'vi', N'en')),
                       theme_pref              NVARCHAR(10)     NOT NULL DEFAULT N'light'
                           CONSTRAINT chk_users_theme
                               CHECK (theme_pref IN (N'light', N'dark')),
                       created_by_admin_id     UNIQUEIDENTIFIER NULL
                           CONSTRAINT fk_users_creator
                               REFERENCES users(id) ON DELETE NO ACTION,
                       created_at              DATETIME2        NOT NULL DEFAULT GETDATE(),
                       updated_at              DATETIME2        NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_users_role         ON users(role);
CREATE INDEX idx_users_plan         ON users(subscription_plan_id);
CREATE INDEX idx_users_is_locked    ON users(is_locked);
GO

-- Seed: tài khoản Admin mặc định
INSERT INTO users (email, password_hash, display_name, role, storage_limit_bytes, subscription_plan_id)
SELECT N'admin@gmail.com', N'$2a$10$lL3v90wAqtnydXcSzNdGJOP3MKCEiIbzXDf1vqsUArj9tLBUHEdpm', N'System Admin', N'admin', 1073741824, sp.id
FROM subscription_plans sp WHERE sp.name = N'free';
GO

INSERT INTO users (email, password_hash, display_name, role, storage_limit_bytes, subscription_plan_id)
SELECT N'subAdmin@gmail.com', N'$2a$10$lL3v90wAqtnydXcSzNdGJOP3MKCEiIbzXDf1vqsUArj9tLBUHEdpm', N'Sub Admin', N'sub_admin', 1073741824, sp.id
FROM subscription_plans sp WHERE sp.name = N'free';
GO

INSERT INTO users (email, password_hash, display_name, role, storage_limit_bytes, subscription_plan_id)
SELECT N'student@gmail.com', N'$2a$10$lL3v90wAqtnydXcSzNdGJOP3MKCEiIbzXDf1vqsUArj9tLBUHEdpm', N'Student', N'user', 536870912, sp.id
FROM subscription_plans sp WHERE sp.name = N'free';
GO


-- =============================================================
-- 3. FOLDERS
-- Lưu trữ cấu trúc thư mục của người dùng
-- =============================================================

CREATE TABLE folders (
                         id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                         user_id         UNIQUEIDENTIFIER NOT NULL
                             CONSTRAINT fk_folders_user
                                 REFERENCES users(id) ON DELETE CASCADE,
                         parent_id       UNIQUEIDENTIFIER NULL
                             CONSTRAINT fk_folders_parent
                                 REFERENCES folders(id) ON DELETE NO ACTION,
                         name            NVARCHAR(255)    NOT NULL,
                         subject         NVARCHAR(100)    NULL,
                         created_at      DATETIME2        NOT NULL DEFAULT GETDATE(),
                         updated_at      DATETIME2        NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_folders_subject ON folders(subject);
GO


-- =============================================================
-- 4. DOCUMENTS
-- Tài liệu học tập: PDF / DOCX / PPTX
-- =============================================================

CREATE TABLE documents (
                           id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                           user_id         UNIQUEIDENTIFIER NOT NULL
                               CONSTRAINT fk_docs_user
                                   REFERENCES users(id) ON DELETE CASCADE,
                           folder_id       UNIQUEIDENTIFIER NULL
                               CONSTRAINT fk_docs_folder
                                   REFERENCES folders(id) ON DELETE NO ACTION,
                           original_name   NVARCHAR(255)    NOT NULL,
                           title           NVARCHAR(255)    NOT NULL,
                           file_url        NVARCHAR(MAX)    NOT NULL,
                           file_size_bytes BIGINT           NOT NULL,
                           file_type       NVARCHAR(10)     NOT NULL
                               CONSTRAINT chk_docs_file_type
                                   CHECK (file_type IN (N'pdf', N'docx', N'pptx')),
                           subject         NVARCHAR(100)    NOT NULL,
                           description     NVARCHAR(MAX)    NULL,
                           tags            NVARCHAR(500)    NULL,
                           status          NVARCHAR(20)     NOT NULL DEFAULT N'uploading'
                               CONSTRAINT chk_docs_status
                                   CHECK (status IN (N'uploading', N'scanning', N'ready', N'failed', N'deleted')),
                           visibility      NVARCHAR(10)     NOT NULL DEFAULT N'private'
                               CONSTRAINT chk_docs_visibility
                                   CHECK (visibility IN (N'private', N'public')),
                           share_status    NVARCHAR(10)     NOT NULL DEFAULT N'none'
                               CONSTRAINT chk_docs_share_status
                                   CHECK (share_status IN (N'none', N'pending', N'approved', N'rejected')),
                           share_note      NVARCHAR(MAX)    NULL,
                           download_count  INT              NOT NULL DEFAULT 0,
                           created_at      DATETIME2        NOT NULL DEFAULT GETDATE(),
                           updated_at      DATETIME2        NOT NULL DEFAULT GETDATE(),
                           deleted_at      DATETIME2        NULL
);
GO

CREATE INDEX idx_docs_user_id    ON documents(user_id);
CREATE INDEX idx_docs_subject    ON documents(subject);
CREATE INDEX idx_docs_status     ON documents(status);
CREATE INDEX idx_docs_visibility ON documents(visibility, share_status);
CREATE INDEX idx_docs_deleted_at ON documents(deleted_at);
CREATE INDEX idx_docs_title_subject ON documents(title, subject);
GO


-- =============================================================
-- tags & document_tags
-- =============================================================

CREATE TABLE tags (
                      id   BIGINT IDENTITY(1,1) PRIMARY KEY,
                      name NVARCHAR(100) NOT NULL UNIQUE
);
GO

CREATE TABLE document_tags (
                               document_id UNIQUEIDENTIFIER NOT NULL
                                   CONSTRAINT fk_dt_document REFERENCES documents(id) ON DELETE CASCADE,
                               tag_id      BIGINT NOT NULL
                                   CONSTRAINT fk_dt_tag REFERENCES tags(id) ON DELETE CASCADE,
                               CONSTRAINT pk_document_tags PRIMARY KEY (document_id, tag_id)
);
GO

CREATE INDEX idx_dt_document ON document_tags(document_id);
CREATE INDEX idx_dt_tag ON document_tags(tag_id);
GO


-- =============================================================
-- 5. CHAT_SESSIONS
-- Phiên trò chuyện với AI Chatbot
-- =============================================================

CREATE TABLE chat_sessions (
                               id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                               user_id     UNIQUEIDENTIFIER NOT NULL
                                   CONSTRAINT fk_cs_user
                                       REFERENCES users(id) ON DELETE CASCADE,
                               title       NVARCHAR(255)    NULL,
                               document_id UNIQUEIDENTIFIER NULL
                                   CONSTRAINT fk_cs_doc
                                       REFERENCES documents(id) ON DELETE NO ACTION,
                               created_at  DATETIME2        NOT NULL DEFAULT GETDATE(),
                               updated_at  DATETIME2        NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_cs_user_id ON chat_sessions(user_id, created_at DESC);
GO


-- =============================================================
-- 6. CHAT_MESSAGES
-- Tin nhắn trong một chat session
-- =============================================================

CREATE TABLE chat_messages (
                               id         UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                               session_id UNIQUEIDENTIFIER NOT NULL
                                   CONSTRAINT fk_cm_session
                                       REFERENCES chat_sessions(id) ON DELETE CASCADE,
                               role       NVARCHAR(10)     NOT NULL
                                   CONSTRAINT chk_cm_role
                                       CHECK (role IN (N'user', N'assistant')),
                               content    NVARCHAR(MAX)    NOT NULL,
                               created_at DATETIME2        NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_cm_session ON chat_messages(session_id, created_at ASC);
GO


-- =============================================================
-- 7. FLASHCARDS
-- Thẻ ghi nhớ: thủ công hoặc AI tạo từ tài liệu
-- =============================================================

CREATE TABLE flashcards (
                            id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                            user_id         UNIQUEIDENTIFIER NOT NULL
                                CONSTRAINT fk_fc_user
                                    REFERENCES users(id) ON DELETE CASCADE,
                            document_id     UNIQUEIDENTIFIER NULL
                                CONSTRAINT fk_fc_doc
                                    REFERENCES documents(id) ON DELETE NO ACTION,
                            question        NVARCHAR(MAX)    NOT NULL,
                            answer          NVARCHAR(MAX)    NOT NULL,
                            status          NVARCHAR(10)     NOT NULL DEFAULT N'new'
                                CONSTRAINT chk_fc_status
                                    CHECK (status IN (N'new', N'learning', N'mastered')),
                            is_ai_generated BIT              NOT NULL DEFAULT 0,
                            created_at      DATETIME2        NOT NULL DEFAULT GETDATE(),
                            updated_at      DATETIME2        NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_fc_user_id     ON flashcards(user_id);
CREATE INDEX idx_fc_document_id ON flashcards(document_id);
CREATE INDEX idx_fc_status      ON flashcards(user_id, status);
GO


-- =============================================================
-- 8. GROUPS (Thay thế Study Rooms)
-- Phòng học nhóm / Chat nhóm
-- =============================================================

CREATE TABLE groups (
                        id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                        group_code      NVARCHAR(32)        NOT NULL UNIQUE, -- Đã update thành NVARCHAR(32)
                        password_hash   NVARCHAR(255)       NOT NULL,
                        name            NVARCHAR(120)       NOT NULL,
                        description     NVARCHAR(500)       NULL,
                        owner_id        UNIQUEIDENTIFIER    NOT NULL
                            CONSTRAINT fk_groups_owner
                                REFERENCES users(id) ON DELETE NO ACTION,
                        created_at      DATETIME2           NOT NULL DEFAULT GETDATE(),
                        updated_at      DATETIME2           NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_groups_code     ON groups(group_code);
CREATE INDEX idx_groups_owner_id ON groups(owner_id);
GO


-- =============================================================
-- 9. GROUP_MEMBERS (Thay thế Study Room Members)
-- Danh sách thành viên trong nhóm
-- =============================================================

CREATE TABLE group_members (
                               group_id    UNIQUEIDENTIFIER    NOT NULL
                                   CONSTRAINT fk_group_members_group
                                       REFERENCES groups(id) ON DELETE CASCADE,
                               user_id     UNIQUEIDENTIFIER    NOT NULL
                                   CONSTRAINT fk_group_members_user
                                       REFERENCES users(id) ON DELETE NO ACTION,
                               role        NVARCHAR(20)        NOT NULL DEFAULT N'member' -- Đã update thành NVARCHAR
                                   CONSTRAINT chk_group_members_role
                                       CHECK (role IN (N'owner', N'member')),
                               muted       BIT                 NOT NULL DEFAULT 0,
                               pinned      BIT                 NOT NULL DEFAULT 0,
                               joined_at   DATETIME2           NOT NULL DEFAULT GETDATE(),
                               CONSTRAINT PK_group_members PRIMARY KEY (group_id, user_id)
);
GO

CREATE INDEX idx_gmem_group_id ON group_members(group_id);
CREATE INDEX idx_gmem_user_id  ON group_members(user_id);
GO


-- =============================================================
-- 10. GROUP_MESSAGES (Thay thế Study Room Messages)
-- Tin nhắn trong nhóm chat học tập
-- =============================================================

CREATE TABLE group_messages (
                                id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                                group_id        UNIQUEIDENTIFIER NOT NULL
                                    CONSTRAINT fk_group_messages_group
                                        REFERENCES groups(id) ON DELETE CASCADE,
                                sender_id       UNIQUEIDENTIFIER NULL
                                    CONSTRAINT fk_group_messages_sender
                                        REFERENCES users(id) ON DELETE SET NULL,
                                content         NVARCHAR(MAX)    NOT NULL,
                                message_type    NVARCHAR(20)     NOT NULL -- Đã update thành NVARCHAR
                                    CONSTRAINT chk_group_messages_type
                                        CHECK (message_type IN (N'text', N'document', N'image', N'system')),
                                document_id     UNIQUEIDENTIFIER NULL
                                    CONSTRAINT fk_group_messages_document
                                        REFERENCES documents(id) ON DELETE NO ACTION,
                                image_url       NVARCHAR(1000)   NULL,
                                image_name      NVARCHAR(255)    NULL,
                                created_at      DATETIME2        NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_gmsg_group_id ON group_messages(group_id, created_at ASC);
GO


-- =============================================================
-- 11. GROUP_REPORTS
-- Báo cáo sai phạm phòng chat nhóm công khai
-- =============================================================

CREATE TABLE group_reports (
                               id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                               group_id        UNIQUEIDENTIFIER NOT NULL
                                   CONSTRAINT fk_group_reports_group
                                       REFERENCES groups(id) ON DELETE CASCADE,
                               reporter_id     UNIQUEIDENTIFIER NOT NULL
                                   CONSTRAINT fk_group_reports_reporter
                                       REFERENCES users(id) ON DELETE NO ACTION,
                               reason          NVARCHAR(500)    NOT NULL,
                               created_at      DATETIME2        NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_greports_group ON group_reports(group_id);
GO


-- =============================================================
-- 12. ACTIVITY_LOGS
-- Nhật ký hoạt động admin/sub_admin
-- =============================================================

CREATE TABLE activity_logs (
                               id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                               actor_id    UNIQUEIDENTIFIER NOT NULL
                                   CONSTRAINT fk_al_actor
                                       REFERENCES users(id) ON DELETE NO ACTION,
                               action      NVARCHAR(100)    NOT NULL,
                               target_type NVARCHAR(50)     NULL,
                               target_id   NVARCHAR(255)    NULL,
                               details     NVARCHAR(MAX)    NULL
                                   CONSTRAINT chk_al_details_json
                                       CHECK (details IS NULL OR ISJSON(details) = 1),
                               created_at  DATETIME2        NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_al_actor_id   ON activity_logs(actor_id, created_at DESC);
CREATE INDEX idx_al_target     ON activity_logs(target_type, target_id);
CREATE INDEX idx_al_created_at ON activity_logs(created_at DESC);
GO


-- =============================================================
-- 13. PASSWORD_RESET_TOKENS
-- Forgot password — BR: Forgot Password
-- =============================================================

CREATE TABLE password_reset_tokens (
                                       id          UNIQUEIDENTIFIER PRIMARY KEY,
                                       email       NVARCHAR(255)    NOT NULL,
                                       token       NVARCHAR(36)     NOT NULL UNIQUE,
                                       expiry      DATETIME2        NOT NULL,
                                       used        BIT              NOT NULL DEFAULT 0,
                                       user_id     UNIQUEIDENTIFIER NULL
                                           CONSTRAINT fk_prt_user
                                               REFERENCES users(id) ON DELETE CASCADE
);
GO

CREATE INDEX idx_prt_email  ON password_reset_tokens(email);
CREATE INDEX idx_prt_token  ON password_reset_tokens(token);
CREATE INDEX idx_prt_user_id ON password_reset_tokens(user_id);
GO


-- =============================================================
-- TRIGGERS — Cập nhật updated_at tự động
-- =============================================================

CREATE TRIGGER trg_subscription_plans_updated_at ON subscription_plans AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE subscription_plans SET updated_at = GETDATE() WHERE id IN (SELECT id FROM INSERTED); END; GO
CREATE TRIGGER trg_users_updated_at ON users AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE users SET updated_at = GETDATE() WHERE id IN (SELECT id FROM INSERTED); END; GO
CREATE TRIGGER trg_folders_updated_at ON folders AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE folders SET updated_at = GETDATE() WHERE id IN (SELECT id FROM INSERTED); END; GO
CREATE TRIGGER trg_documents_updated_at ON documents AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE documents SET updated_at = GETDATE() WHERE id IN (SELECT id FROM INSERTED); END; GO
CREATE TRIGGER trg_chat_sessions_updated_at ON chat_sessions AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE chat_sessions SET updated_at = GETDATE() WHERE id IN (SELECT id FROM INSERTED); END; GO
CREATE TRIGGER trg_flashcards_updated_at ON flashcards AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE flashcards SET updated_at = GETDATE() WHERE id IN (SELECT id FROM INSERTED); END; GO
CREATE TRIGGER trg_groups_updated_at ON groups AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE groups SET updated_at = GETDATE() WHERE id IN (SELECT id FROM INSERTED); END; GO


-- =============================================================
-- TRIGGER — Đồng bộ storage_used_bytes khi documents thay đổi
-- =============================================================

CREATE TRIGGER trg_documents_sync_storage
    ON documents AFTER INSERT, UPDATE, DELETE
    AS BEGIN
    SET NOCOUNT ON;
    DECLARE @AffectedUsers TABLE (user_id UNIQUEIDENTIFIER);
    INSERT INTO @AffectedUsers SELECT DISTINCT user_id FROM INSERTED;
    INSERT INTO @AffectedUsers SELECT DISTINCT user_id FROM DELETED;

    UPDATE u
    SET u.storage_used_bytes = COALESCE(
            (SELECT SUM(d.file_size_bytes) FROM documents d WHERE d.user_id = u.id AND d.status != N'deleted' AND d.deleted_at IS NULL),
            0
                               )
    FROM users u WHERE u.id IN (SELECT DISTINCT user_id FROM @AffectedUsers);
END;
GO


-- =============================================================
-- VIEWS tiện ích
-- =============================================================

CREATE VIEW v_users_with_subscription AS
SELECT
    u.id, u.email, u.display_name, u.role, u.is_locked, u.storage_limit_bytes, u.storage_used_bytes,
    ROUND(CAST(u.storage_used_bytes AS FLOAT) * 100.0 / NULLIF(u.storage_limit_bytes, 0), 1) AS storage_pct,
    sp.name AS subscription_name, sp.display_name AS subscription_display, u.subscription_expires_at, u.created_at
FROM users u LEFT JOIN subscription_plans sp ON u.subscription_plan_id = sp.id;
GO

CREATE VIEW v_active_documents AS
SELECT * FROM documents WHERE deleted_at IS NULL AND status != N'deleted';
GO

CREATE VIEW v_pending_share_requests AS
SELECT d.id, d.title, d.subject, d.share_note, d.created_at AS requested_at, u.display_name AS owner_name, u.email AS owner_email
FROM documents d JOIN users u ON d.user_id = u.id WHERE d.share_status = N'pending' AND d.deleted_at IS NULL;
GO

CREATE VIEW v_user_stats AS
SELECT
    u.id, COUNT(d.id) AS total_documents, u.storage_used_bytes, u.storage_limit_bytes,
    sp.display_name AS subscription_name, u.subscription_expires_at
FROM users u
         LEFT JOIN documents d ON d.user_id = u.id AND d.deleted_at IS NULL AND d.status != N'deleted'
         LEFT JOIN subscription_plans sp ON u.subscription_plan_id = sp.id
GROUP BY u.id, u.storage_used_bytes, u.storage_limit_bytes, sp.display_name, u.subscription_expires_at;
GO