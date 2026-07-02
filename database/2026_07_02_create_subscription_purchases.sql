-- Run this migration on Supabase if payment.subscription_purchases
-- is missing from an existing AI Study Hub database.

CREATE SCHEMA IF NOT EXISTS payment;

CREATE TABLE IF NOT EXISTS payment.subscription_purchases (
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

CREATE INDEX IF NOT EXISTS idx_sub_purchases_user_id
  ON payment.subscription_purchases (user_id);

CREATE INDEX IF NOT EXISTS idx_sub_purchases_plan_id
  ON payment.subscription_purchases (plan_id);

CREATE INDEX IF NOT EXISTS idx_sub_purchases_status
  ON payment.subscription_purchases (status);

CREATE INDEX IF NOT EXISTS idx_sub_purchases_created_at
  ON payment.subscription_purchases (created_at);

CREATE INDEX IF NOT EXISTS idx_sub_purchases_expires_at
  ON payment.subscription_purchases (expires_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_subscription_purchases_user'
      AND conrelid = 'payment.subscription_purchases'::regclass
  ) THEN
    ALTER TABLE payment.subscription_purchases
      ADD CONSTRAINT fk_subscription_purchases_user
      FOREIGN KEY (user_id)
      REFERENCES core.users (id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_subscription_purchases_plan'
      AND conrelid = 'payment.subscription_purchases'::regclass
  ) THEN
    ALTER TABLE payment.subscription_purchases
      ADD CONSTRAINT fk_subscription_purchases_plan
      FOREIGN KEY (plan_id)
      REFERENCES payment.subscription_plans (id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
