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

// ─── BR-100/BR-101 — mock COUNT(*) trên email_otp_tokens (cửa sổ trượt 24h) ────
// Ghi lại timestamp của MỌI lần sinh OTP (đăng ký mới TH3 lẫn ghi đè TH2) để
// enforceOtpDailyLimit() (chỉ gọi ở register — KHÔNG áp dụng cho resend-otp,
// đúng như AuthService.register() thật) có thể đếm số bản ghi trong 24h gần nhất.
const mockOtpHistory = new Map<string, number[]>() // key = email (lowercase) -> [createdAt epoch ms]

const OTP_TTL_MS = 10 * 60 * 1000 // 10 phút — BR-095
const OTP_RESEND_COOLDOWN_MS = 60 * 1000 // 60 giây — BR-098
const OTP_MAX_ATTEMPTS = 5 // BR-096
const OTP_DAILY_LIMIT = 5 // BR-100/BR-101 — tối đa 5 lần sinh OTP / 24h (register + overwrite gộp chung)
const OTP_DAILY_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 giờ — BR-100

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

  // BR-100/BR-101: ghi nhận timestamp vào lịch sử để enforceOtpDailyLimit() đếm được —
  // tương đương 1 dòng INSERT mới vào email_otp_tokens ở backend thật.
  const history = mockOtpHistory.get(email) ?? []
  history.push(now)
  mockOtpHistory.set(email, history)

  // eslint-disable-next-line no-console
  console.log(
    `%c📧 [MOCK OTP] Mã xác thực cho ${email}: ${code} (hết hạn sau 10 phút)`,
    "font-size:14px; font-weight:bold; color:#16a34a; background:#f0fdf4; padding:4px 8px; border-radius:4px;"
  )
  return token
}

/**
 * BR-100/BR-101: chặn khi đã có >= OTP_DAILY_LIMIT bản ghi OTP (đăng ký mới lẫn ghi đè)
 * sinh ra trong OTP_DAILY_LIMIT_WINDOW_MS gần nhất (sliding window trên mockOtpHistory —
 * tương đương COUNT(*) trên email_otp_tokens.created_at ở backend thật). Trả về
 * retryAfterSeconds = khoảng cách tới khi bản ghi cũ nhất trong cửa sổ hết hiệu lực.
 * Trả `undefined` nếu chưa vượt ngưỡng (được phép tiếp tục sinh OTP).
 */
function checkOtpDailyLimit(email: string): { dailyLimit: number; retryAfterSeconds: number } | undefined {
  const now = Date.now()
  const windowStart = now - OTP_DAILY_LIMIT_WINDOW_MS
  const inWindow = (mockOtpHistory.get(email) ?? []).filter(ts => ts > windowStart).sort((a, b) => a - b)
  if (inWindow.length < OTP_DAILY_LIMIT) return undefined
  const oldest = inWindow[0]
  const retryAfterSeconds = Math.max(0, Math.ceil((oldest + OTP_DAILY_LIMIT_WINDOW_MS - now) / 1000))
  return { dailyLimit: OTP_DAILY_LIMIT, retryAfterSeconds }
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

// ─── Thêm tài khoản demo role "user" — dùng để test luồng gói custom ───────
// (BR-063 sub-admin cấp gói / bug "gói mới admin tạo user chưa thấy") mà không
// cần đăng ký thủ công. Gán sẵn subscriptionPlanId=4 — trùng với id của gói
// custom đầu tiên admin tạo trong subscription-plans.mock.ts (mockSeq bắt đầu
// từ 3, gói mới đầu tiên sẽ có id=4). Nếu bạn đã tạo/xoá vài gói custom trước
// đó trong phiên hiện tại, id thật có thể lệch — mở tab "Quản lý tài khoản"
// (admin) để xem đúng subscriptionPlanId của acc "user1@gmail.com" và/hoặc
// dùng nút "Cấp gói" để gán lại cho khớp gói bạn vừa tạo.
function seedUserAccount() {
  const email = "admin@gmail.com"
  if (mockAccounts.has(email)) return
  mockAccounts.set(email, {
    id: newId(),
    email,
    password: "Admin123",
    displayName: "Admin",
    role: "sub-admin",
    locked: false,
    emailVerified: true,
    storageUsedBytes: 10_485_760,
    storageLimitBytes: 536_870_912,
    // Cố tình gán 1 id KHÔNG PHẢI 2 hoặc 3 (id built-in Pro/VIP) — trước khi
    // sửa mapSubscriptionTier() thì tài khoản này sẽ bị FE hiển thị/tính quota
    // nhầm thành "free" dù có subscriptionPlanId hợp lệ. Sau khi sửa, hãy vào
    // trang "Gói dịch vụ" của acc này và trang admin để xác nhận nó hiện đúng
    // tên/giới hạn của gói custom, không còn bị gán nhầm "Free" nữa.
    subscriptionPlanId: 4,
    subscriptionExpiresAt: null,
    languagePreference: "vi",
    themePreference: "light",
    createdAt: new Date().toISOString(),
  })
}
seedUserAccount()

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

// ─── Password strength (đồng bộ đúng thang điểm PasswordPolicyValidator.calculateStrength ─
// của backend thật: 5 tiêu chí length>=8/lower/upper/digit/special, tính điểm rồi quy đổi) ──
const PASSWORD_SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:'\",.<>/?`~\\"

function calculatePasswordStrength(password: string): string {
  if (!password) return "YẾU"
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = [...password].some(c => PASSWORD_SPECIAL_CHARS.includes(c))

  let score = 0
  if (password.length >= 8) score++
  if (hasLower) score++
  if (hasUpper) score++
  if (hasDigit) score++
  if (hasSpecial) score++

  if (score <= 1) return "YẾU"
  if (score === 2) return "TRUNG_BÌNH"
  if (score === 3) return "MẠNH"
  return "RẤT_MẠNH"
}

// ─── POST /api/auth/register ─────────────────────────────────────────────
// BR-101 (Register-Overwrite Strategy) — theo đúng thứ tự kiểm tra của
// Register_UnverifiedEmail_Overwrite_Business_Logic.docx (Mục 2) và shape
// response của Register_UnverifiedEmail_Overwrite_API_Contract.docx (Mục 1):
//   TH1 — email đã tồn tại VÀ emailVerified=true  -> 409, KHÔNG đụng dữ liệu cũ.
//   TH2 — email đã tồn tại VÀ emailVerified=false -> ghi đè password/displayName, sinh OTP mới.
//   TH3 — email chưa tồn tại                      -> tạo mới như luồng đăng ký hiện có.
// TH2 và TH3 trả về CÙNG một shape 201 — không có field nào phân biệt 2 trường hợp.
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

  const existing = mockAccounts.get(normalizedEmail)

  // TH1 — email đã có chủ và đã xác thực -> từ chối, không đụng tới dữ liệu hiện có.
  if (existing && existing.emailVerified) {
    return jsonResponse(409, {
      message: "Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng chức năng Quên mật khẩu.",
    })
  }

  // BR-100/BR-101 — rate-limit 24h áp dụng NHƯ NHAU cho cả TH2 (ghi đè) và TH3 (tạo mới),
  // dùng chung 1 bộ đếm theo email, KHÔNG có bộ đếm riêng cho luồng ghi đè.
  const limitHit = checkOtpDailyLimit(normalizedEmail)
  if (limitHit) {
    return jsonResponse(429, {
      message: "Bạn đã thao tác quá nhiều lần trong 24 giờ qua. Vui lòng thử lại sau.",
      dailyLimit: limitHit.dailyLimit,
      retryAfterSeconds: limitHit.retryAfterSeconds,
    })
  }

  const trimmedDisplayName = displayName.trim() || normalizedEmail
  let account: MockAccount
  if (existing) {
    // TH2 — ghi đè (cập nhật) bản ghi hiện có bằng thông tin mới nhất, giữ nguyên id/createdAt.
    existing.password = password
    existing.displayName = trimmedDisplayName
    account = existing
  } else {
    // TH3 — chưa tồn tại -> tạo mới, giữ nguyên luồng đăng ký hiện có (BR-095).
    account = {
      id: newId(),
      email: normalizedEmail,
      password,
      displayName: trimmedDisplayName,
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
  }

  // BR-095: sinh + "gửi" OTP mới — với TH2, việc này cũng đồng thời vô hiệu hoá OTP cũ
  // chưa dùng của bản ghi bị ghi đè (issueOtp ghi đè thẳng vào mockOtpTokens theo email).
  issueOtp(normalizedEmail)

  // BR-095 — response: KHÔNG kèm accessToken (register chưa cấp token, phải verify OTP trước),
  // thêm requiresVerification + otpExpiresInSeconds. TH2 và TH3 dùng CHUNG shape này.
  return jsonResponse(201, {
    tokenType: "Bearer",
    user: toPublicUser(account),
    password_strength: calculatePasswordStrength(password),
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
