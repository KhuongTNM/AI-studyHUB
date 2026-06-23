-- ====================================================================
-- 1. XÓA BẢNG CŨ (Theo đúng thứ tự để né lỗi ràng buộc khóa ngoại FK)
-- ====================================================================
DROP TABLE IF EXISTS study_room_messages;
DROP TABLE IF EXISTS study_room_members;
DROP TABLE IF EXISTS study_rooms;

-- ====================================================================
-- 2. TẠO HỆ THỐNG BẢNG MỚI (GROUP CHAT CORE)
-- ====================================================================

-- 2.1 Bảng chứa thông tin nhóm chat
CREATE TABLE groups (
                        id              UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
                        group_code      VARCHAR(32)         NOT NULL,
                        password_hash   NVARCHAR(255)       NOT NULL,
                        name            NVARCHAR(120)       NOT NULL,
                        description     NVARCHAR(500)       NULL,
                        owner_id        UNIQUEIDENTIFIER    NOT NULL,
                        created_at      DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
                        updated_at      DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

                        CONSTRAINT PK_groups PRIMARY KEY (id),
                        CONSTRAINT UQ_groups_group_code UNIQUE (group_code),
                        CONSTRAINT FK_groups_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- 2.2 Bảng trung gian quản lý thành viên (Dùng Khóa chính liên hợp)
CREATE TABLE group_members (
                               group_id    UNIQUEIDENTIFIER    NOT NULL,
                               user_id     UNIQUEIDENTIFIER    NOT NULL,
                               role        VARCHAR(20)         NOT NULL DEFAULT 'member',
                               muted       BIT                 NOT NULL DEFAULT 0,
                               pinned      BIT                 NOT NULL DEFAULT 0,
                               joined_at   DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

                               CONSTRAINT PK_group_members PRIMARY KEY (group_id, user_id),
                               CONSTRAINT CHK_group_members_role CHECK (role IN ('owner', 'member')),
                               CONSTRAINT FK_group_members_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                               CONSTRAINT FK_group_members_user  FOREIGN KEY (user_id)  REFERENCES users(id)
);

-- 2.3 Bảng lưu trữ tin nhắn chat
CREATE TABLE group_messages (
                                id              UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
                                group_id        UNIQUEIDENTIFIER    NOT NULL,
                                sender_id       UNIQUEIDENTIFIER    NULL,   -- NULL nghĩa là tin nhắn tự động từ hệ thống
                                content         NVARCHAR(MAX)       NOT NULL,
                                message_type    VARCHAR(20)         NOT NULL,
                                document_id     UNIQUEIDENTIFIER    NULL,
                                image_url       NVARCHAR(1000)      NULL,
                                image_name      NVARCHAR(255)       NULL,
                                created_at      DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

                                CONSTRAINT PK_group_messages PRIMARY KEY (id),
                                CONSTRAINT CHK_group_messages_type CHECK (message_type IN ('text', 'document', 'image', 'system')),
                                CONSTRAINT FK_group_messages_group    FOREIGN KEY (group_id)    REFERENCES groups(id) ON DELETE CASCADE,
                                CONSTRAINT FK_group_messages_sender   FOREIGN KEY (sender_id)   REFERENCES users(id),
                                CONSTRAINT FK_group_messages_document FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- 2.4 Bảng báo cáo vi phạm nhóm
CREATE TABLE group_reports (
                               id              UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
                               group_id        UNIQUEIDENTIFIER    NOT NULL,
                               reporter_id     UNIQUEIDENTIFIER    NOT NULL,
                               reason          NVARCHAR(500)       NOT NULL,
                               created_at      DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

                               CONSTRAINT PK_group_reports PRIMARY KEY (id),
                               CONSTRAINT FK_group_reports_group    FOREIGN KEY (group_id)    REFERENCES groups(id) ON DELETE CASCADE,
                               CONSTRAINT FK_group_reports_reporter FOREIGN KEY (reporter_id)  REFERENCES users(id)
);

-- ====================================================================
-- 3. ĐẮP INDEX HIỆU NĂNG (Tối ưu hóa tốc độ quét và JOIN bảng)
-- ====================================================================
CREATE INDEX IX_groups_group_code ON groups(group_code);
CREATE INDEX IX_group_members_user_id ON group_members(user_id);
CREATE INDEX IX_group_messages_group_id_created ON group_messages(group_id, created_at DESC);
CREATE INDEX IX_groups_owner_id ON groups(owner_id);