/**
 * Mock cho các API tài khoản (login/register/logout/session/google login) —
 * dùng khi MOCK_API = true (mock-config.ts).
 *
 * Cùng nguyên tắc như documents.mock.ts: trả về đúng Response (status,
 * body JSON) như backend thật, để code xử lý ở auth.ts (parseError,
 * mapApiUserToStoreUser...) chạy y hệt lúc dùng backend thật.
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

// ─── Seed sẵn 1 tài khoản demo để login ngay không cần đăng ký ─────────────
function seedDefaultAccount() {
  const email = "student@gmail.com"
  if (mockAccounts.has(email)) return
  mockAccounts.set(email, {
    id: newId(),
    email,
    password: "Admin123",
    displayName: "Người dùng Demo",
    role: "user",
    locked: false,
    storageUsedBytes: 52_428_800,
    storageLimitBytes: 1_073_741_824,
    subscriptionPlanId: null,
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
    return jsonResponse(400, { message: "Mật khẩu xác nhận không khớp." })
  }
  if (mockAccounts.has(normalizedEmail)) {
    return jsonResponse(409, { message: "Email đã được sử dụng." })
  }
  mockAccounts.set(normalizedEmail, {
    id: newId(),
    email: normalizedEmail,
    password,
    displayName: displayName.trim() || normalizedEmail,
    role: "user",
    locked: false,
    storageUsedBytes: 0,
    storageLimitBytes: 1_073_741_824,
    subscriptionPlanId: null,
    subscriptionExpiresAt: null,
    languagePreference: "vi",
    themePreference: "light",
    createdAt: new Date().toISOString(),
  })
  return jsonResponse(201, { message: "Đăng ký thành công." })
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
