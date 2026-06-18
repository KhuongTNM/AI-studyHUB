package com.aistudyhub.backend.service;

import com.aistudyhub.backend.exception.ApiException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.*;

class PasswordPolicyValidatorTest {

    // -------------------------------------------------------------------------
    // validate()
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("validate() — BR-002 minimum requirements")
    class ValidateTests {

        @Test
        @DisplayName("null password throws BAD_REQUEST")
        void validate_null_throwsBadRequest() {
            ApiException ex = assertThrows(ApiException.class,
                    () -> PasswordPolicyValidator.validate(null));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        }

        @Test
        @DisplayName("empty string throws BAD_REQUEST")
        void validate_empty_throwsBadRequest() {
            ApiException ex = assertThrows(ApiException.class,
                    () -> PasswordPolicyValidator.validate(""));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        }

        @Test
        @DisplayName("7-char password (below minimum length) throws BAD_REQUEST")
        void validate_sevenChars_throwsBadRequest() {
            ApiException ex = assertThrows(ApiException.class,
                    () -> PasswordPolicyValidator.validate("Abc123!"));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        }

        @Test
        @DisplayName("8+ chars but no digit throws BAD_REQUEST")
        void validate_noDigit_throwsBadRequest() {
            ApiException ex = assertThrows(ApiException.class,
                    () -> PasswordPolicyValidator.validate("abcdefgh"));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        }

        @Test
        @DisplayName("8+ chars but no letter throws BAD_REQUEST")
        void validate_noLetter_throwsBadRequest() {
            ApiException ex = assertThrows(ApiException.class,
                    () -> PasswordPolicyValidator.validate("12345678"));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        }

        @Test
        @DisplayName("8+ chars with at least one letter and one digit passes (no exception)")
        void validate_minimumValid_doesNotThrow() {
            assertDoesNotThrow(() -> PasswordPolicyValidator.validate("password1"));
        }

        @Test
        @DisplayName("strong password with special chars passes (no exception)")
        void validate_strongPassword_doesNotThrow() {
            assertDoesNotThrow(() -> PasswordPolicyValidator.validate("Str0ng!Pass"));
        }

        @Test
        @DisplayName("exactly 8 chars with letter and digit is the boundary minimum — passes")
        void validate_exactlyEightChars_passes() {
            assertDoesNotThrow(() -> PasswordPolicyValidator.validate("abcdef1g"));
        }
    }

    // -------------------------------------------------------------------------
    // calculateStrength()
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("calculateStrength() — BR-005 four levels")
    class CalculateStrengthTests {

        // -- YẾU (điểm 0-1) ---------------------------------------------------

        @Test
        @DisplayName("null returns WEAK")
        void strength_null_isWeak() {
            assertEquals("YẾU", PasswordPolicyValidator.calculateStrength(null));
        }

        @Test
        @DisplayName("empty string returns WEAK")
        void strength_empty_isWeak() {
            assertEquals("YẾU", PasswordPolicyValidator.calculateStrength(""));
        }

        @Test
        @DisplayName("short lowercase-only (score=1: lowercase) returns WEAK")
        void strength_shortLowercase_isWeak() {
            // độ dài<8 → 0, chữ thường → 1, không hoa → 0, không số → 0, không đặc biệt → 0 = 1
            assertEquals("YẾU", PasswordPolicyValidator.calculateStrength("abc"));
        }

        @Test
        @DisplayName("only digits (score=1: digit) returns WEAK")
        void strength_digitsOnly_isWeak() {
            // dùng chuỗi số ngắn để giữ điểm = 1
            assertEquals("YẾU", PasswordPolicyValidator.calculateStrength("123"));
        }

        // -- TRUNG_BÌNH (điểm 2) ----------------------------------------------

        @Test
        @DisplayName("8+ lowercase-only (score=2: length+lowercase) returns MEDIUM")
        void strength_eightLowercaseOnly_isMedium() {
            // độ dài>=8 → 1, chữ thường → 1, không hoa, không số, không đặc biệt = 2
            assertEquals("TRUNG_BÌNH", PasswordPolicyValidator.calculateStrength("abcdefgh"));
        }

        @Test
        @DisplayName("8+ digits-only (score=2: length+digit) returns MEDIUM")
        void strength_eightDigitsOnly_isMedium() {
            assertEquals("TRUNG_BÌNH", PasswordPolicyValidator.calculateStrength("12345678"));
        }

        // -- MẠNH (điểm 3) ----------------------------------------------------

        @Test
        @DisplayName("8+ lower+upper, no digit/special (score=3) returns STRONG")
        void strength_lowerUpperNoDigit_isStrong() {
            // độ dài → 1, thường → 1, hoa → 1, không số → 0, không đặc biệt → 0 = 3
            assertEquals("MẠNH", PasswordPolicyValidator.calculateStrength("Abcdefgh"));
        }

        @Test
        @DisplayName("8+ lower+digit, no upper/special (score=3) returns STRONG")
        void strength_lowerDigitNoUpper_isStrong() {
            // độ dài → 1, thường → 1, không hoa → 0, số → 1, không đặc biệt → 0 = 3
            assertEquals("MẠNH", PasswordPolicyValidator.calculateStrength("password1"));
        }

        // -- RẤT_MẠNH (điểm 4-5) ---------------------------------------------

        @Test
        @DisplayName("8+ lower+upper+digit, no special (score=4) returns VERY_STRONG")
        void strength_lowerUpperDigit_isVeryStrong() {
            // độ dài → 1, thường → 1, hoa → 1, số → 1, không đặc biệt → 0 = 4
            assertEquals("RẤT_MẠNH", PasswordPolicyValidator.calculateStrength("Abcdefg1"));
        }

        @Test
        @DisplayName("all 5 criteria met (score=5) returns VERY_STRONG")
        void strength_allCriteria_isVeryStrong() {
            // độ dài → 1, thường → 1, hoa → 1, số → 1, đặc biệt → 1 = 5
            assertEquals("RẤT_MẠNH", PasswordPolicyValidator.calculateStrength("Abcdefg1!"));
        }

        @Test
        @DisplayName("long complex passphrase returns VERY_STRONG")
        void strength_longComplex_isVeryStrong() {
            assertEquals("RẤT_MẠNH", PasswordPolicyValidator.calculateStrength("MyS3cur3P@ssw0rd!"));
        }
    }
}
