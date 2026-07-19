-- =========================================================================
-- DATABASE MIGRATION - COMPLETE SYSTEM ENHANCEMENT
-- Target Tables: payment.subscription_plans, payment.subscriptions
-- Description: Creates history tables, alters column constraints, adds daily limits, and sets default data.
-- =========================================================================

-- 1. TĂNG ĐỘ DÀI CỘT NAME ĐỂ PHỤC VỤ LOGIC XÓA MỀM (SOFT-DELETE)
-- Tránh lỗi "value too long for type character varying(20)" khi hệ thống tự động nối thêm UUID hậu tố.
ALTER TABLE payment.subscription_plans ALTER COLUMN name TYPE VARCHAR(100);

-- 2. TẠO BẢNG LƯU TRỮ LỊCH SỬ SỬ DỤNG GÓI DỊCH VỤ CỦA NGƯỜI DÙNG
-- Đảm bảo cơ chế Single Source of Truth thay thế cho việc lưu tạm bợ ở bảng core.users.
CREATE TABLE IF NOT EXISTS payment.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL, -- ACTIVE, EXPIRED, INACTIVE, SUPERSEDED
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    price_paid NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. THÊM CÁC CỘT QUẢN LÝ VÀ GIỚI HẠN MỚI CHO BẢNG GÓI DỊCH VỤ
-- is_deleted: Phục vụ soft-delete bảo vệ dữ liệu lịch sử
-- description: Mô tả chi tiết gói dịch vụ
-- daily_ai_chat_limit: Giới hạn số câu hỏi Chat AI mỗi ngày (-1 = không giới hạn)
-- max_flashcards: Giới hạn số lượng thẻ flashcard tối đa (-1 = không giới hạn)
ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS description VARCHAR(500);
ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS daily_ai_chat_limit INTEGER NOT NULL DEFAULT 5;
ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS max_flashcards INTEGER NOT NULL DEFAULT 5;

-- 4. CẬP NHẬT CẤU HÌNH HẠN MỨC MẶC ĐỊNH CHO CÁC GÓI HIỆN TẠI

-- Gói Free mặc định: Chỉ được hỏi AI 5 câu/ngày và tạo tối đa 5 thẻ flashcards
UPDATE payment.subscription_plans 
SET daily_ai_chat_limit = 5, 
    max_flashcards = 5 
WHERE name = 'free';

-- Gói Pro (plan_2_4): Được hỏi AI 50 câu/ngày và tạo tối đa 50 thẻ flashcards
UPDATE payment.subscription_plans 
SET daily_ai_chat_limit = 50, 
    max_flashcards = 50 
WHERE name = 'plan_2_4';

-- Gói Premium/Expert (plan_5_plus): Không giới hạn sử dụng (-1)
UPDATE payment.subscription_plans 
SET daily_ai_chat_limit = -1, 
    max_flashcards = -1 
WHERE name = 'plan_5_plus';
