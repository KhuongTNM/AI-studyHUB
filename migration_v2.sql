-- Migration V2: Subscription Management and Group Limit fixes

-- 1. Thêm các trường mới vào bảng payment.subscription_plans
ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS description VARCHAR(500);

-- 2. Tạo bảng payment.subscriptions để lưu trữ lịch sử sử dụng gói của người dùng
CREATE TABLE IF NOT EXISTS payment.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_id INTEGER NOT NULL, -- Theo kiểu hiện tại của SubscriptionPlan.id
    status VARCHAR(50) NOT NULL, -- ACTIVE, EXPIRED, INACTIVE, SUPERSEDED
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    price_paid NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Note: Chúng ta không drop cột subscription_plan_id trong bảng users ngay 
-- để tránh break các ứng dụng cũ đang chạy, nhưng code mới sẽ không dùng nó làm nguồn chính nữa.
