-- Migration V3: Add daily_ai_chat_limit and max_flashcards to subscription_plans, increase name length
ALTER TABLE payment.subscription_plans ALTER COLUMN name TYPE VARCHAR(100);
ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS daily_ai_chat_limit INTEGER NOT NULL DEFAULT 5;
ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS max_flashcards INTEGER NOT NULL DEFAULT 5;

UPDATE payment.subscription_plans SET daily_ai_chat_limit = 5, max_flashcards = 5 WHERE name = 'free';
UPDATE payment.subscription_plans SET daily_ai_chat_limit = 50, max_flashcards = 50 WHERE name = 'plan_2_4';
UPDATE payment.subscription_plans SET daily_ai_chat_limit = -1, max_flashcards = -1 WHERE name = 'plan_5_plus';
