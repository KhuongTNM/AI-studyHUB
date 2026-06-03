-- =============================================================
-- AI STUDY HUB — Database Schema (Microsoft SQL Server / T-SQL)
-- Group 07 | SU26SWP391
-- Dựa trên 70 Business Rules + Functional Requirements
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
-- BR-008, BR-043, BR-046, BR-057, BR-065, BR-066
-- =============================================================

CREATE TABLE subscription_plans (
    id                    INT           IDENTITY(1,1) PRIMARY KEY,
    -- 'free' | 'plan_2_4' | 'plan_5_plus'
    name                  NVARCHAR(20)  NOT NULL UNIQUE
                              CONSTRAINT chk_sp_name
                              CHECK (name IN (N'free', N'plan_2_4', N'plan_5_plus')),
    display_name          NVARCHAR(50)  NOT NULL,
    -- BR-066: chỉ Admin mới được sửa price
    price                 DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    -- BR-046: 0 = không tạo phòng được; 4 = plan_2_4; 99 = plan_5_plus
    max_room_members      SMALLINT      NOT NULL DEFAULT 0,
    -- Dung lượng mặc định theo gói (bytes): 512MB / 1GB / 2GB
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
    (N'plan_5_plus', N'Gói 5+ Người',  99000,  99, 2147483648);  -- 2 GB
GO


-- =============================================================
-- 2. USERS
-- Tất cả tài khoản: user / admin / sub_admin
-- BR-001→BR-012, BR-027, BR-052→BR-057, BR-058→BR-070
-- =============================================================

CREATE TABLE users (
    id                      UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    -- BR-001: validate format ở app layer; BR-004: unique
    email                   NVARCHAR(255)    NOT NULL UNIQUE,
    -- BR-002: min 8 ký tự, 1 chữ cái, 1 số (validate ở app layer)
    password_hash           NVARCHAR(255)    NOT NULL,
    -- BR-003: không trống, max 50 ký tự
    display_name            NVARCHAR(50)     NOT NULL,
    -- BR-007: default 'user'
    role                    NVARCHAR(10)     NOT NULL DEFAULT N'user'
                                CONSTRAINT chk_users_role
                                CHECK (role IN (N'user', N'admin', N'sub_admin')),
    -- BR-009: BIT thay cho BOOLEAN
    is_locked               BIT              NOT NULL DEFAULT 0,
    -- BR-010: tăng khi sai mật khẩu, reset về 0 khi đăng nhập thành công
    login_attempts          SMALLINT         NOT NULL DEFAULT 0,
    -- BR-027: mặc định 512MB; BR-067: admin chỉnh riêng từng user (đơn vị GB)
    storage_limit_bytes     BIGINT           NOT NULL DEFAULT 536870912,
    -- Cập nhật tự động qua trigger khi documents thay đổi
    storage_used_bytes      BIGINT           NOT NULL DEFAULT 0,
    -- BR-008: gói mặc định free; BR-057: user tự mua; BR-065: admin cấp
    subscription_plan_id    INT              NULL
                                CONSTRAINT fk_users_plan
                                REFERENCES subscription_plans(id) ON DELETE SET NULL,
    -- NULL = gói Free (không hết hạn); BR-057: 30 ngày từ ngày mua
    subscription_expires_at DATETIME2        NULL,
    -- BR-056: 'vi' (mặc định) | 'en'
    language_pref           NVARCHAR(5)      NOT NULL DEFAULT N'vi'
                                CONSTRAINT chk_users_lang
                                CHECK (language_pref IN (N'vi', N'en')),
    -- BR-055: 'light' (mặc định) | 'dark'
    theme_pref              NVARCHAR(10)     NOT NULL DEFAULT N'light'
                                CONSTRAINT chk_users_theme
                                CHECK (theme_pref IN (N'light', N'dark')),
    -- BR-064: sub_admin do admin tạo → ghi lại creator
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
-- ⚠️ Thay password_hash bằng bcrypt thực tế trước khi deploy
INSERT INTO users (email, password_hash, display_name, role, storage_limit_bytes, subscription_plan_id)
SELECT
    N'admin@aistudy.hub',
    N'$2b$12$replace_with_real_bcrypt_hash',
    N'System Admin',
    N'admin',
    1073741824,   -- 1 GB
    sp.id
FROM subscription_plans sp WHERE sp.name = N'free';
GO


-- =============================================================
-- 3. DOCUMENTS
-- Tài liệu học tập: PDF / DOCX / PPTX
-- BR-013→BR-026, BR-031
-- =============================================================

CREATE TABLE documents (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id         UNIQUEIDENTIFIER NOT NULL
                        CONSTRAINT fk_docs_user
                        REFERENCES users(id) ON DELETE CASCADE,
    -- Tên file gốc khi upload
    original_name   NVARCHAR(255)    NOT NULL,
    -- Tiêu đề hiển thị (user có thể chỉnh)
    title           NVARCHAR(255)    NOT NULL,
    -- URL lưu trữ cloud (Cloudinary / Azure Blob / S3)
    file_url        NVARCHAR(MAX)    NOT NULL,
    -- BR-014: kiểm tra không vượt dung lượng còn trống
    file_size_bytes BIGINT           NOT NULL,
    -- BR-013: chỉ 3 loại hợp lệ
    file_type       NVARCHAR(10)     NOT NULL
                        CONSTRAINT chk_docs_file_type
                        CHECK (file_type IN (N'pdf', N'docx', N'pptx')),
    -- BR-015: bắt buộc nhập khi upload
    subject         NVARCHAR(100)    NOT NULL,
    description     NVARCHAR(MAX)    NULL,
    -- BR-021: tags phân cách dấu phẩy, vd: "toán,tích phân,bài tập"
    tags            NVARCHAR(500)    NULL,
    -- BR-016: uploading → scanning → ready | failed; BR-023: deleted = thùng rác
    status          NVARCHAR(20)     NOT NULL DEFAULT N'uploading'
                        CONSTRAINT chk_docs_status
                        CHECK (status IN (N'uploading', N'scanning', N'ready', N'failed', N'deleted')),
    -- BR-018: mặc định private
    visibility      NVARCHAR(10)     NOT NULL DEFAULT N'private'
                        CONSTRAINT chk_docs_visibility
                        CHECK (visibility IN (N'private', N'public')),
    -- BR-019: none → pending → approved | rejected
    share_status    NVARCHAR(10)     NOT NULL DEFAULT N'none'
                        CONSTRAINT chk_docs_share_status
                        CHECK (share_status IN (N'none', N'pending', N'approved', N'rejected')),
    -- BR-026: lý do xin duyệt (user) hoặc lý do từ chối (admin)
    share_note      NVARCHAR(MAX)    NULL,
    -- BR-022: chỉ tăng, không giảm
    download_count  INT              NOT NULL DEFAULT 0,
    created_at      DATETIME2        NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME2        NOT NULL DEFAULT GETDATE(),
    -- BR-023: soft delete — NULL = bình thường; có giá trị = đang ở thùng rác
    deleted_at      DATETIME2        NULL
);
GO

CREATE INDEX idx_docs_user_id    ON documents(user_id);
CREATE INDEX idx_docs_subject    ON documents(subject);
CREATE INDEX idx_docs_status     ON documents(status);
CREATE INDEX idx_docs_visibility ON documents(visibility, share_status);
CREATE INDEX idx_docs_deleted_at ON documents(deleted_at);

-- BR-025: tìm kiếm title/subject dùng LIKE ở app layer
-- (Full-Text Search bị tắt → dùng idx_docs_title_subject thay thế)
CREATE INDEX idx_docs_title_subject ON documents(title, subject);
GO


-- =============================================================
-- 4. CHAT_SESSIONS
-- Phiên trò chuyện với AI Chatbot
-- BR-032, BR-033, BR-034, BR-035, BR-036
-- =============================================================

CREATE TABLE chat_sessions (
    id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    -- BR-032: chỉ user đã đăng nhập
    user_id     UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT fk_cs_user
                    REFERENCES users(id) ON DELETE CASCADE,
    -- BR-033: tiêu đề tự sinh từ nội dung câu hỏi đầu tiên
    title       NVARCHAR(255)    NULL,
    -- BR-034: NULL = hỏi chung; có giá trị = hỏi theo ngữ cảnh tài liệu
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
-- 5. CHAT_MESSAGES
-- Tin nhắn trong một chat session
-- BR-033, BR-037
-- =============================================================

CREATE TABLE chat_messages (
    id         UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    session_id UNIQUEIDENTIFIER NOT NULL
                   CONSTRAINT fk_cm_session
                   REFERENCES chat_sessions(id) ON DELETE CASCADE,
    -- 'user' = người dùng gửi; 'assistant' = AI phản hồi
    role       NVARCHAR(10)     NOT NULL
                   CONSTRAINT chk_cm_role
                   CHECK (role IN (N'user', N'assistant')),
    -- BR-037: Markdown, render phía client
    content    NVARCHAR(MAX)    NOT NULL,
    created_at DATETIME2        NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_cm_session ON chat_messages(session_id, created_at ASC);
GO


-- =============================================================
-- 6. FLASHCARDS
-- Thẻ ghi nhớ: thủ công hoặc AI tạo từ tài liệu
-- BR-038→BR-042
-- =============================================================

CREATE TABLE flashcards (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id         UNIQUEIDENTIFIER NOT NULL
                        CONSTRAINT fk_fc_user
                        REFERENCES users(id) ON DELETE CASCADE,
    -- BR-039: NULL = thủ công; BR-038: có ID = AI sinh từ tài liệu
    -- NO ACTION thay vì SET NULL: SQL Server không cho 2 đường cascade
    -- đến cùng 1 bảng (users→documents→flashcards & users→flashcards)
    -- App layer tự set document_id = NULL khi document bị xóa/soft-delete
    document_id     UNIQUEIDENTIFIER NULL
                        CONSTRAINT fk_fc_doc
                        REFERENCES documents(id) ON DELETE NO ACTION,
    question        NVARCHAR(MAX)    NOT NULL,
    answer          NVARCHAR(MAX)    NOT NULL,
    -- BR-040: new → learning → mastered
    status          NVARCHAR(10)     NOT NULL DEFAULT N'new'
                        CONSTRAINT chk_fc_status
                        CHECK (status IN (N'new', N'learning', N'mastered')),
    -- BR-038: đánh dấu thẻ do AI tạo tự động
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
-- 7. STUDY_ROOMS
-- Phòng học nhóm realtime
-- BR-043→BR-051
-- =============================================================

CREATE TABLE study_rooms (
    id                   UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    -- BR-044: UPPERCASE, unique
    code                 NVARCHAR(20)     NOT NULL UNIQUE,
    -- BR-043: host phải có gói trả phí hoặc là admin/sub_admin
    host_id              UNIQUEIDENTIFIER NOT NULL
                             CONSTRAINT fk_sr_host
                             REFERENCES users(id) ON DELETE NO ACTION,
    -- BR-045: NULL = phòng mở không cần mật khẩu
    password_hash        NVARCHAR(255)    NULL,
    -- BR-046: 4 (plan_2_4) hoặc 99 (plan_5_plus)
    max_members          SMALLINT         NOT NULL,
    -- Đếm thực tế từ study_room_members; cập nhật khi join/leave
    current_member_count SMALLINT         NOT NULL DEFAULT 1,
    -- BR-049: khi host rời → is_active = 0
    is_active            BIT              NOT NULL DEFAULT 1,
    created_at           DATETIME2        NOT NULL DEFAULT GETDATE(),
    -- BR-049: ghi lại thời điểm phòng đóng
    closed_at            DATETIME2        NULL
);
GO

CREATE INDEX idx_sr_code      ON study_rooms(code);
CREATE INDEX idx_sr_host_id   ON study_rooms(host_id);
CREATE INDEX idx_sr_is_active ON study_rooms(is_active);
GO


-- =============================================================
-- 8. STUDY_ROOM_MEMBERS
-- Danh sách thành viên tham gia phòng
-- BR-046, BR-047, BR-048, BR-049, BR-050
-- =============================================================

CREATE TABLE study_room_members (
    id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    room_id   UNIQUEIDENTIFIER NOT NULL
                  CONSTRAINT fk_srm_room
                  REFERENCES study_rooms(id) ON DELETE CASCADE,
    user_id   UNIQUEIDENTIFIER NOT NULL
                  CONSTRAINT fk_srm_user
                  REFERENCES users(id) ON DELETE NO ACTION,
    joined_at DATETIME2        NOT NULL DEFAULT GETDATE(),
    -- BR-050: NULL = đang trong phòng; có giá trị = đã rời
    -- BR-049: khi phòng đóng → set left_at = GETDATE() cho tất cả thành viên
    left_at   DATETIME2        NULL,
    CONSTRAINT uq_srm UNIQUE (room_id, user_id)
);
GO

CREATE INDEX idx_srm_room_id  ON study_room_members(room_id, left_at);
CREATE INDEX idx_srm_user_id  ON study_room_members(user_id);
GO


-- =============================================================
-- 9. STUDY_ROOM_MESSAGES
-- Tin nhắn realtime trong phòng học
-- BR-051
-- =============================================================

CREATE TABLE study_room_messages (
    id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    room_id      UNIQUEIDENTIFIER NOT NULL
                     CONSTRAINT fk_srmsg_room
                     REFERENCES study_rooms(id) ON DELETE CASCADE,
    -- BR-051: NULL khi là tin nhắn hệ thống (vào/ra phòng)
    user_id      UNIQUEIDENTIFIER NULL
                     CONSTRAINT fk_srmsg_user
                     REFERENCES users(id) ON DELETE SET NULL,
    content      NVARCHAR(MAX)    NOT NULL,
    -- BR-051: 'user' = người dùng; 'system' = thông báo hệ thống
    message_type NVARCHAR(10)     NOT NULL DEFAULT N'user'
                     CONSTRAINT chk_srmsg_type
                     CHECK (message_type IN (N'user', N'system')),
    created_at   DATETIME2        NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_srmsg_room_id ON study_room_messages(room_id, created_at ASC);
GO


-- =============================================================
-- 10. ACTIVITY_LOGS
-- Nhật ký hoạt động admin/sub_admin
-- BR-064, BR-068
-- =============================================================

CREATE TABLE activity_logs (
    id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    -- Admin / Sub-admin thực hiện hành động
    actor_id    UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT fk_al_actor
                    REFERENCES users(id) ON DELETE NO ACTION,
    -- Ví dụ: 'lock_user', 'delete_document', 'grant_subscription', 'create_sub_admin'
    action      NVARCHAR(100)    NOT NULL,
    -- Loại đối tượng: 'user', 'document', 'subscription', 'study_room', ...
    target_type NVARCHAR(50)     NULL,
    -- ID của đối tượng bị tác động
    target_id   NVARCHAR(255)    NULL,
    -- Chi tiết bổ sung dạng JSON (SQL Server 2016+ hỗ trợ JSON functions trên NVARCHAR)
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
-- TRIGGERS — Cập nhật updated_at tự động
-- =============================================================

CREATE TRIGGER trg_subscription_plans_updated_at
ON subscription_plans AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    UPDATE subscription_plans
    SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM INSERTED);
END;
GO

CREATE TRIGGER trg_users_updated_at
ON users AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    UPDATE users
    SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM INSERTED);
END;
GO

CREATE TRIGGER trg_documents_updated_at
ON documents AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    UPDATE documents
    SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM INSERTED);
END;
GO

CREATE TRIGGER trg_chat_sessions_updated_at
ON chat_sessions AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    UPDATE chat_sessions
    SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM INSERTED);
END;
GO

CREATE TRIGGER trg_flashcards_updated_at
ON flashcards AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    UPDATE flashcards
    SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM INSERTED);
END;
GO


-- =============================================================
-- TRIGGER — Đồng bộ storage_used_bytes khi documents thay đổi
-- BR-014 (kiểm tra dung lượng), BR-028/BR-030 (hiển thị realtime)
-- =============================================================

CREATE TRIGGER trg_documents_sync_storage
ON documents AFTER INSERT, UPDATE, DELETE
AS BEGIN
    SET NOCOUNT ON;

    -- Lấy tất cả user_id bị ảnh hưởng (cả INSERT lẫn DELETE)
    DECLARE @AffectedUsers TABLE (user_id UNIQUEIDENTIFIER);
    INSERT INTO @AffectedUsers SELECT DISTINCT user_id FROM INSERTED;
    INSERT INTO @AffectedUsers SELECT DISTINCT user_id FROM DELETED;

    -- Cập nhật storage_used_bytes: tổng file_size của docs chưa deleted
    UPDATE u
    SET u.storage_used_bytes = COALESCE(
        (SELECT SUM(d.file_size_bytes)
         FROM documents d
         WHERE d.user_id = u.id
           AND d.status != N'deleted'
           AND d.deleted_at IS NULL),
        0
    )
    FROM users u
    WHERE u.id IN (SELECT DISTINCT user_id FROM @AffectedUsers);
END;
GO


-- =============================================================
-- VIEWS tiện ích
-- =============================================================

-- View: thông tin user kèm tên gói subscription
-- BR-059: Admin/Sub-admin xem danh sách user
CREATE VIEW v_users_with_subscription AS
SELECT
    u.id,
    u.email,
    u.display_name,
    u.role,
    u.is_locked,
    u.storage_limit_bytes,
    u.storage_used_bytes,
    ROUND(
        CAST(u.storage_used_bytes AS FLOAT) * 100.0
        / NULLIF(u.storage_limit_bytes, 0),
    1) AS storage_pct,
    sp.name          AS subscription_name,
    sp.display_name  AS subscription_display,
    u.subscription_expires_at,
    u.created_at
FROM users u
LEFT JOIN subscription_plans sp ON u.subscription_plan_id = sp.id;
GO

-- View: tài liệu chưa bị xóa (không gồm thùng rác)
-- BR-023: soft delete
CREATE VIEW v_active_documents AS
SELECT *
FROM documents
WHERE deleted_at IS NULL
  AND status != N'deleted';
GO

-- View: tài liệu đang chờ duyệt public
-- BR-026: Admin/Sub-admin xét duyệt
CREATE VIEW v_pending_share_requests AS
SELECT
    d.id,
    d.title,
    d.subject,
    d.share_note,
    d.created_at     AS requested_at,
    u.display_name   AS owner_name,
    u.email          AS owner_email
FROM documents d
JOIN users u ON d.user_id = u.id
WHERE d.share_status = N'pending'
  AND d.deleted_at IS NULL;
GO

-- View: thống kê nhanh từng user (Profile page)
-- BR-054: số tài liệu, dung lượng, gói subscription, ngày hết hạn
CREATE VIEW v_user_stats AS
SELECT
    u.id,
    COUNT(d.id)              AS total_documents,
    u.storage_used_bytes,
    u.storage_limit_bytes,
    sp.display_name          AS subscription_name,
    u.subscription_expires_at
FROM users u
LEFT JOIN documents d
    ON d.user_id = u.id
    AND d.deleted_at IS NULL
    AND d.status != N'deleted'
LEFT JOIN subscription_plans sp ON u.subscription_plan_id = sp.id
GROUP BY
    u.id,
    u.storage_used_bytes,
    u.storage_limit_bytes,
    sp.display_name,
    u.subscription_expires_at;
GO
