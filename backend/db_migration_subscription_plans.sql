ALTER TABLE subscription_plans ADD create_group_limit INT NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD join_group_limit INT NOT NULL DEFAULT 5;

UPDATE subscription_plans SET create_group_limit = 0, join_group_limit = 5 WHERE name = 'free';
UPDATE subscription_plans SET create_group_limit = 20, join_group_limit = 30 WHERE name = 'plan_2_4';
UPDATE subscription_plans SET create_group_limit = 50, join_group_limit = 60 WHERE name = 'plan_5_plus';
