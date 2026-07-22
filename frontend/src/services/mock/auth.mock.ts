/**
 * Mock cho các API tài khoản (login/register/logout/session/google login) —
 * dùng khi MOCK_API = true (mock-config.ts).
 *
 * Cùng nguyên tắc như documents.mock.ts: trả về đúng Response (status,
 * body JSON) như backend thật, để code xử lý ở auth.ts (parseError,
 * mapApiUserToStoreUser...) chạy y hệt lúc dùng backend thật.
 *
 * Ngoài ra còn mock luồng OTP (BR-095 → BR-098 — OTP_API_Spec_docx.md +
 * OTP_Email_Verification_Spec_docx.md), điều khiển chung bởi cờ MOCK_API
 * (mock-config.ts) — bật/tắt cùng lúc với toàn bộ mock còn lại. Vì không có
 * email server thật, mã OTP sinh ra được in ra console (F12) thay vì gửi email.
 *
 * LƯU Ý: dữ liệu tài khoản (kể cả tài khoản mới đăng ký) chỉ tồn tại
 * trong bộ nhớ phiên làm việc — mất khi reload trang. Đây là mock để FE
 * tự test UI/flow, không phải nơi lưu trữ thật.
 */

interface MockApiUser {
  id: string
  email: string
  displayName: string
  role: string
  locked: boolean
  emailVerified: boolean
  storageUsedBytes: number
  storageLimitBytes: number
  subscriptionPlanId: number | null
  subscriptionExpiresAt: string | null
  languagePreference: string
  themePreference: string
  createdAt: string
}

interface MockAccount extends MockApiUser {
  password: string
}

const mockAccounts = new Map<string, MockAccount>() // key = email (lowercase)
const mockTokens = new Map<string, string>() // key = accessToken -> email

// ─── BR-095/096/098 — mock bảng core.email_otp_tokens (theo user_id, used=false) ──
interface MockOtpToken {
  email: string
  code: string
  expiresAt: number // epoch ms
  createdAt: number // epoch ms — dùng để tính cooldown gửi lại (BR-098)
  attemptCount: number
  used: boolean
}
const mockOtpTokens = new Map<string, MockOtpToken>() // key = email (lowercase)

const OTP_TTL_MS = 10 * 60 * 1000 // 10 phút — BR-095
const OTP_RESEND_COOLDOWN_MS = 60 * 1000 // 60 giây — BR-098
const OTP_MAX_ATTEMPTS = 5 // BR-096

let mockSeq = 0
function newId(): string {
  mockSeq += 1
  return `mock-user-${Date.now()}-${mockSeq}`
}

function newToken(email: string): string {
  return `mock-token.${btoa(unescape(encodeURIComponent(email)))}.${Date.now()}.${Math.random().toString(36).slice(2)}`
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function toPublicUser(account: MockAccount): MockApiUser {
  const { password: _password, ...rest } = account
  return rest
}

/**
 * Sinh mã OTP 6 chữ số + "gửi email" (mock = in ra console vì không có email
 * server thật). Vô hiệu hoá mã cũ trước khi tạo mã mới — đúng BR-095 bước 2.
 */
function issueOtp(email: string): MockOtpToken {
  const code = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0")
  const now = Date.now()
  const token: MockOtpToken = {
    email,
    code,
    expiresAt: now + OTP_TTL_MS,
    createdAt: now,
    attemptCount: 0,
    used: false,
  }
  mockOtpTokens.set(email, token)
  // eslint-disable-next-line no-console
  console.log(
    `%c📧 [MOCK OTP] Mã xác thực cho ${email}: ${code} (hết hạn sau 10 phút)`,
    "font-size:14px; font-weight:bold; color:#16a34a; background:#f0fdf4; padding:4px 8px; border-radius:4px;"
  )
  return token
}

// ─── Seed sẵn 1 tài khoản demo để login ngay không cần đăng ký ─────────────
function seedDefaultAccount() {
  const email = "student@gmail.com"
  if (mockAccounts.has(email)) return
  mockAccounts.set(email, {
    id: newId(),
    email,
    password: "Admin123",
    displayName: "Student",
    role: "user",
    locked: false,
    emailVerified: true,
    storageUsedBytes: 52_428_800,
    storageLimitBytes: 1_073_741_824,
    subscriptionPlanId: 2,
    subscriptionExpiresAt: null,
    languagePreference: "vi",
    themePreference: "light",
    createdAt: new Date().toISOString(),
  })
}
seedDefaultAccount()

// ─── POST /api/auth/login ────────────────────────────────────────────────

export async function mockLoginRequest(email: string, password: string): Promise<Response> {
  await delay(400)
  const account = mockAccounts.get(email.trim().toLowerCase())
  if (!account || account.password !== password) {
    return jsonResponse(401, { message: "Email hoặc mật khẩu không đúng." })
  }
  if (account.locked) {
    return jsonResponse(403, { message: "Tài khoản của bạn đã bị khoá." })
  }
  // BR-097 — chặn login khi chưa xác thực OTP, KHÔNG tăng loginAttempts/không khoá.
  if (!account.emailVerified) {
    return jsonResponse(403, { message: "ACCOUNT_NOT_VERIFIED", email: account.email })
  }
  const token = newToken(account.email)
  mockTokens.set(token, account.email)
  return jsonResponse(200, {
    accessToken: token,
    tokenType: "Bearer",
    user: toPublicUser(account),
  })
}

// ─── POST /api/auth/register ─────────────────────────────────────────────

export async function mockRegisterRequest(
  email: string,
  password: string,
  confirmPassword: string,
  displayName: string,
): Promise<Response> {
  await delay(400)
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !password) {
    return jsonResponse(400, { message: "Email và mật khẩu không được để trống." })
  }
  if (password !== confirmPassword) {
    return jsonResponse(400, { message: "Mật khẩu xác nhận không trùng khớp." })
  }
  if (mockAccounts.has(normalizedEmail)) {
    return jsonResponse(409, { message: "Email này đã được đăng ký." })
  }
  const account: MockAccount = {
    id: newId(),
    email: normalizedEmail,
    password,
    displayName: displayName.trim() || normalizedEmail,
    role: "user",
    locked: false,
    // BR-095 — tài khoản mới luôn ở trạng thái chưa xác thực, chặn login tới khi verify-otp.
    emailVerified: false,
    storageUsedBytes: 0,
    storageLimitBytes: 1_073_741_824,
    subscriptionPlanId: null,
    subscriptionExpiresAt: null,
    languagePreference: "vi",
    themePreference: "light",
    createdAt: new Date().toISOString(),
  }
  mockAccounts.set(normalizedEmail, account)
  issueOtp(normalizedEmail)

  // BR-095 — response mới: KHÔNG kèm accessToken, thêm requiresVerification.
  return jsonResponse(201, {
    tokenType: "Bearer",
    user: toPublicUser(account),
    password_strength: "Mạnh",
    requiresVerification: true,
    otpExpiresInSeconds: OTP_TTL_MS / 1000,
  })
}

// ─── POST /api/auth/verify-otp (BR-096) ────────────────────────────────────

export async function mockVerifyOtpRequest(email: string, otpCode: string): Promise<Response> {
  await delay(350)
  const normalizedEmail = email.trim().toLowerCase()
  const account = mockAccounts.get(normalizedEmail)
  if (!account) {
    return jsonResponse(404, { message: "USER_NOT_FOUND" })
  }
  if (account.emailVerified) {
    return jsonResponse(400, { message: "EMAIL_ALREADY_VERIFIED" })
  }

  const token = mockOtpTokens.get(normalizedEmail)
  if (!token || token.used) {
    return jsonResponse(404, { message: "OTP_NOT_FOUND" })
  }
  if (Date.now() > token.expiresAt) {
    token.used = true // dọn rác — đúng bước 4 trong BR-096
    return jsonResponse(400, { message: "OTP_EXPIRED" })
  }
  if (token.attemptCount >= OTP_MAX_ATTEMPTS) {
    return jsonResponse(400, { message: "OTP_MAX_ATTEMPTS_EXCEEDED" })
  }
  if (token.code !== otpCode) {
    token.attemptCount += 1
    return jsonResponse(400, {
      message: "OTP_INVALID_CODE",
      attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - token.attemptCount),
    })
  }

  // Đúng mã — kích hoạt tài khoản + tự động đăng nhập luôn (bước 7-8).
  token.used = true
  account.emailVerified = true
  const accessToken = newToken(account.email)
  mockTokens.set(accessToken, account.email)
  return jsonResponse(200, {
    accessToken,
    tokenType: "Bearer",
    user: toPublicUser(account),
  })
}

// ─── POST /api/auth/resend-otp (BR-098) ────────────────────────────────────

export async function mockResendOtpRequest(email: string): Promise<Response> {
  await delay(350)
  const normalizedEmail = email.trim().toLowerCase()
  const genericSuccess = { message: "Nếu email tồn tại, mã xác thực đã được gửi." }

  const account = mockAccounts.get(normalizedEmail)
  // Chống user-enumeration: email không tồn tại hoặc đã verified → vẫn trả 200 y hệt,
  // nhưng không thực sự sinh/gửi OTP mới.
  if (!account || account.emailVerified) {
    return jsonResponse(200, genericSuccess)
  }

  const lastToken = mockOtpTokens.get(normalizedEmail)
  if (lastToken) {
    const elapsedMs = Date.now() - lastToken.createdAt
    if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000)
      return jsonResponse(429, { message: "OTP_RESEND_COOLDOWN", retryAfterSeconds })
    }
  }

  issueOtp(normalizedEmail)
  return jsonResponse(200, genericSuccess)
}

// ─── POST /api/auth/google ────────────────────────────────────────────────

export async function mockGoogleLoginRequest(googleAccessToken: string): Promise<Response> {
  await delay(400)
  if (!googleAccessToken) {
    return jsonResponse(400, { message: "Thiếu access token Google." })
  }
  // Mock: mỗi lần login Google -> tìm/tạo 1 tài khoản demo cố định.
  const email = "google-demo@aistudyhub.com"
  let account = mockAccounts.get(email)
  if (!account) {
    account = {
      id: newId(),
      email,
      password: "",
      displayName: "Google Demo User",
      role: "user",
      locked: false,
      // BR-088 — tài khoản Google luôn coi như đã xác thực email ngay khi tạo.
      emailVerified: true,
      storageUsedBytes: 0,
      storageLimitBytes: 1_073_741_824,
      subscriptionPlanId: null,
      subscriptionExpiresAt: null,
      languagePreference: "vi",
      themePreference: "light",
      createdAt: new Date().toISOString(),
    }
    mockAccounts.set(email, account)
  }
  const token = newToken(account.email)
  mockTokens.set(token, account.email)
  return jsonResponse(200, {
    accessToken: token,
    tokenType: "Bearer",
    user: toPublicUser(account),
  })
}

// ─── POST /api/auth/logout ────────────────────────────────────────────────

export async function mockLogoutRequest(token: string | null): Promise<Response> {
  await delay(150)
  if (token) mockTokens.delete(token)
  return jsonResponse(200, {})
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────

export async function mockFetchCurrentUserRequest(token: string | null): Promise<Response> {
  await delay(200)
  const email = token ? mockTokens.get(token) : undefined
  const account = email ? mockAccounts.get(email) : undefined
  if (!account) {
    return jsonResponse(401, { message: "Phiên đăng nhập đã hết hạn." })
  }
  return jsonResponse(200, toPublicUser(account))
}
