import java.io.FileInputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Properties;

public class DbMigrator {
    public static void main(String[] args) {
        String propertiesPath = "backend/src/main/resources/application.properties";
        Properties props = new Properties();

        String url = null;
        String user = null;
        String pass = null;

        try (FileInputStream fis = new FileInputStream(propertiesPath)) {
            props.load(fis);
            
            // Đọc cấu hình từ application.properties
            String rawUrl = props.getProperty("app.datasource.url");
            String rawUser = props.getProperty("app.datasource.username");
            String rawPass = props.getProperty("app.datasource.password");

            // Resolve system environment variables if any (e.g. ${DB_URL:...})
            url = resolveEnvVars(rawUrl);
            user = resolveEnvVars(rawUser);
            pass = resolveEnvVars(rawPass);

            System.out.println("Active DB URL: " + url);
            System.out.println("Active DB User: " + user);

        } catch (Exception e) {
            System.err.println("Could not read application.properties: " + e.getMessage());
            return;
        }

        if (url == null || user == null) {
            System.err.println("DB URL or Username is null.");
            return;
        }

        try (Connection conn = DriverManager.getConnection(url, user, pass);
             Statement stmt = conn.createStatement()) {
            
            System.out.println("Connected to active database successfully.");

            // 1. Tăng độ dài name của payment.subscription_plans lên VARCHAR(100) phục vụ soft-delete
            System.out.println("Altering name column type to VARCHAR(100)...");
            try {
                stmt.execute("ALTER TABLE payment.subscription_plans ALTER COLUMN name TYPE VARCHAR(100);");
                System.out.println("name column length increased to 100 successfully.");
            } catch (Exception e) {
                System.out.println("Error altering name column length: " + e.getMessage());
            }

            // 2. Tạo bảng payment.subscriptions nếu chưa tồn tại
            System.out.println("Creating table payment.subscriptions...");
            try {
                stmt.execute("CREATE TABLE IF NOT EXISTS payment.subscriptions (\n" +
                        "    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n" +
                        "    user_id UUID NOT NULL,\n" +
                        "    plan_id INTEGER NOT NULL,\n" +
                        "    status VARCHAR(50) NOT NULL,\n" +
                        "    start_date TIMESTAMP NOT NULL,\n" +
                        "    end_date TIMESTAMP NOT NULL,\n" +
                        "    price_paid NUMERIC(10,2) NOT NULL,\n" +
                        "    created_at TIMESTAMP NOT NULL DEFAULT NOW(),\n" +
                        "    updated_at TIMESTAMP NOT NULL DEFAULT NOW()\n" +
                        ");");
                System.out.println("payment.subscriptions table created/verified successfully.");
            } catch (Exception e) {
                System.out.println("Error creating payment.subscriptions table: " + e.getMessage());
            }

            // 3. Thêm cột is_deleted vào payment.subscription_plans
            System.out.println("Adding column is_deleted...");
            try {
                stmt.execute("ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;");
                System.out.println("is_deleted column verified/created.");
            } catch (Exception e) {
                System.out.println("Error adding is_deleted: " + e.getMessage());
            }

            // 4. Thêm cột description
            System.out.println("Adding column description...");
            try {
                stmt.execute("ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS description VARCHAR(500);");
                System.out.println("description column verified/created.");
            } catch (Exception e) {
                System.out.println("Error adding description: " + e.getMessage());
            }

            // 5. Thêm cột daily_ai_chat_limit
            System.out.println("Adding column daily_ai_chat_limit...");
            try {
                stmt.execute("ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS daily_ai_chat_limit INTEGER NOT NULL DEFAULT 5;");
                System.out.println("daily_ai_chat_limit column verified/created.");
            } catch (Exception e) {
                System.out.println("Error adding daily_ai_chat_limit: " + e.getMessage());
            }

            // 6. Thêm cột max_flashcards
            System.out.println("Adding column max_flashcards...");
            try {
                stmt.execute("ALTER TABLE payment.subscription_plans ADD COLUMN IF NOT EXISTS max_flashcards INTEGER NOT NULL DEFAULT 5;");
                System.out.println("max_flashcards column verified/created.");
            } catch (Exception e) {
                System.out.println("Error adding max_flashcards: " + e.getMessage());
            }

            // 7. Cập nhật dữ liệu mặc định cho 3 gói chính
            System.out.println("Updating free plan limits...");
            stmt.executeUpdate("UPDATE payment.subscription_plans SET daily_ai_chat_limit = 5, max_flashcards = 5 WHERE name = 'free';");

            System.out.println("Updating plan_2_4 limits...");
            stmt.executeUpdate("UPDATE payment.subscription_plans SET daily_ai_chat_limit = 50, max_flashcards = 50 WHERE name = 'plan_2_4';");

            System.out.println("Updating plan_5_plus limits...");
            stmt.executeUpdate("UPDATE payment.subscription_plans SET daily_ai_chat_limit = -1, max_flashcards = -1 WHERE name = 'plan_5_plus';");

            // 8. Thêm cột email_verified vào core.users nếu chưa có
            System.out.println("Adding column email_verified to core.users...");
            try {
                stmt.execute("ALTER TABLE core.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;");
                System.out.println("email_verified column verified/created.");
                // Backfill cho các user hiện có
                stmt.execute("UPDATE core.users SET email_verified = TRUE WHERE email_verified = FALSE;");
                System.out.println("email_verified column backfilled.");
            } catch (Exception e) {
                System.out.println("Error adding/updating email_verified: " + e.getMessage());
            }

            // 9. Tạo bảng core.email_otp_tokens nếu chưa có
            System.out.println("Creating table core.email_otp_tokens...");
            try {
                stmt.execute("CREATE TABLE IF NOT EXISTS core.email_otp_tokens (\n" +
                        "  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),\n" +
                        "  user_id       UUID         NOT NULL,\n" +
                        "  email         VARCHAR(255) NOT NULL,\n" +
                        "  otp_code_hash VARCHAR(255) NOT NULL,\n" +
                        "  expiry        TIMESTAMPTZ  NOT NULL,\n" +
                        "  attempt_count INT          NOT NULL DEFAULT 0,\n" +
                        "  used          BOOLEAN      NOT NULL DEFAULT FALSE,\n" +
                        "  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()\n" +
                        ");");
                
                // Thêm constraint khóa ngoại
                try {
                    stmt.execute("ALTER TABLE core.email_otp_tokens ADD CONSTRAINT fk_email_otp_tokens_user FOREIGN KEY (user_id)\n" +
                            "  REFERENCES core.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;");
                    System.out.println("Foreign key constraint added for email_otp_tokens.");
                } catch (Exception e) {
                    System.out.println("Foreign key constraint might already exist: " + e.getMessage());
                }

                // Thêm các index
                try {
                    stmt.execute("CREATE INDEX IF NOT EXISTS idx_eot_user_id ON core.email_otp_tokens (user_id);");
                    stmt.execute("CREATE INDEX IF NOT EXISTS idx_eot_email ON core.email_otp_tokens (email);");
                    stmt.execute("CREATE INDEX IF NOT EXISTS idx_eot_user_used ON core.email_otp_tokens (user_id, used);");
                    System.out.println("Indexes for email_otp_tokens created.");
                } catch (Exception e) {
                    System.out.println("Error creating indexes for email_otp_tokens: " + e.getMessage());
                }

                System.out.println("core.email_otp_tokens table verified/created successfully.");
            } catch (Exception e) {
                System.out.println("Error creating core.email_otp_tokens table: " + e.getMessage());
            }

            // 10. Tạo bảng core.upload_settings nếu chưa có
            System.out.println("Creating table core.upload_settings...");
            try {
                stmt.execute("CREATE TABLE IF NOT EXISTS core.upload_settings (\n" +
                        "    id SMALLINT PRIMARY KEY,\n" +
                        "    max_file_size_bytes BIGINT NOT NULL,\n" +
                        "    max_files_per_upload INT NOT NULL,\n" +
                        "    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),\n" +
                        "    updated_by_admin_id UUID\n" +
                        ");");
                stmt.execute("INSERT INTO core.upload_settings (id, max_file_size_bytes, max_files_per_upload, updated_at)\n" +
                        "VALUES (1, 52428800, 10, NOW())\n" +
                        "ON CONFLICT (id) DO NOTHING;");
                System.out.println("core.upload_settings table verified/created successfully.");
            } catch (Exception e) {
                System.out.println("Error creating core.upload_settings table: " + e.getMessage());
            }

            // 11. Tạo bảng core.activity_logs nếu chưa có
            System.out.println("Creating table core.activity_logs...");
            try {
                stmt.execute("CREATE TABLE IF NOT EXISTS core.activity_logs (\n" +
                        "    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n" +
                        "    user_id UUID NOT NULL,\n" +
                        "    action VARCHAR(100) NOT NULL,\n" +
                        "    target_type VARCHAR(50),\n" +
                        "    target_id UUID,\n" +
                        "    description TEXT,\n" +
                        "    created_at TIMESTAMP NOT NULL DEFAULT NOW()\n" +
                        ");");
                System.out.println("core.activity_logs table verified/created successfully.");
            } catch (Exception e) {
                System.out.println("Error creating core.activity_logs table: " + e.getMessage());
            }

            System.out.println("All migrations applied successfully to active database!");


        } catch (Exception e) {
            System.err.println("Database migration failed: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static String resolveEnvVars(String input) {
        if (input == null) return null;
        if (input.contains("${")) {
            int start = input.indexOf("${");
            int end = input.indexOf("}");
            if (start != -1 && end != -1) {
                String envPart = input.substring(start + 2, end);
                String envVarName = envPart;
                String defaultValue = "";
                if (envPart.contains(":")) {
                    String[] parts = envPart.split(":", 2);
                    envVarName = parts[0];
                    defaultValue = parts[1];
                }
                String envValue = System.getenv(envVarName);
                if (envValue == null || envValue.isEmpty()) {
                    envValue = defaultValue;
                }
                return input.substring(0, start) + envValue + input.substring(end + 1);
            }
        }
        return input;
    }
}
