import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth-storage"
import type { Language, User, UserRole } from "@/lib/store"
import { MOCK_API } from "@/services/mock/mock-config"
import {
  mockLoginRequest,
  mockRegisterRequest,
  mockGoogleLoginRequest,
  mockLogoutRequest,
  mockFetchCurrentUserRequest,
  mockVerifyOtpRequest,
  mockResendOtpRequest,
} from "@/services/mock/auth.mock"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface ApiUser {
  id: string
  email: string
  displayName: string
  role: string
  locked: boolean
  /** BR-095/096 — true khi đã xác thực OTP thành công (hoặc tài khoản Google). */
  emailVerified?: boolean
  storageUsedBytes: number
  storageLimitBytes: number
  subscriptionPlanId?: number | null
  subscriptionExpiresAt?: string | null
  languagePreference: string
  themePreference: string
  createdAt: string
}

interface AuthApiResponse {
  accessToken: string
  tokenType: string
  user: ApiUser
}

/** Response thật của POST /api/auth/register sau BR-095 (không còn accessToken). */
interface RegisterApiResponse {
  tokenType?: string
  user: ApiUser
  password_strength?: string
  requiresVerification?: boolean
  otpExpiresInSeconds?: number
}

interface ErrorBody {
  message?: string
}

interface MessageBody {
  message?: string
}

/** Mã lỗi ổn định trả về từ POST /api/auth/verify-otp (BR-096). */
export type VerifyOtpErrorCode =
  | "USER_NOT_FOUND"
  | "EMAIL_ALREADY_VERIFIED"
  | "OTP_NOT_FOUND"
  | "OTP_EXPIRED"
  | "OTP_MAX_ATTEMPTS_EXCEEDED"
  | "OTP_INVALID_CODE"

export interface VerifyOtpErrorResult {
  success: false
  error: string
  code?: VerifyOtpErrorCode
  /** Chỉ có khi code === "OTP_INVALID_CODE" */
  attemptsRemaining?: number
}

/** Ánh xạ mã lỗi OTP ổn định sang câu tiếng Việt hiển thị cho người dùng (Mục 2, Notes). */
const OTP_ERROR_MESSAGES: Record<VerifyOtpErrorCode, string> = {
  USER_NOT_FOUND: "Không tìm thấy tài khoản với email này.",
  EMAIL_ALREADY_VERIFIED: "Email này đã được xác thực trước đó.",
  OTP_NOT_FOUND: "Không tìm thấy mã xác thực. Vui lòng bấm \"Gửi lại mã\".",
  OTP_EXPIRED: "Mã xác thực đã hết hạn. Vui lòng bấm \"Gửi lại mã\".",
  OTP_MAX_ATTEMPTS_EXCEEDED: "Bạn đã nhập sai quá 5 lần. Vui lòng bấm \"Gửi lại mã\" để lấy mã mới.",
  OTP_INVALID_CODE: "Mã xác thực không đúng.",
}

export function mapOtpErrorMessage(code?: string): string {
  if (code && code in OTP_ERROR_MESSAGES) return OTP_ERROR_MESSAGES[code as VerifyOtpErrorCode]
  return "Đã xảy ra lỗi. Vui lòng thử lại."
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore parse errors
  }
  return "Đã xảy ra lỗi. Vui lòng thử lại."
}

function mapRole(role: string): UserRole {
  if (role === "sub-admin") return "sub-admin"
  if (role === "admin") return "admin"
  return "user"
}

/**
 * FIXED: hàm này trước đây hardcode "id=2 → 2-4", "id=3 → 5+", mọi id khác
 * (kể cả gói custom admin tạo thêm, id >= 4) đều rơi vào "free" — dù user đã
 * trả tiền cho gói đó. Vì auth.ts KHÔNG có danh sách gói (packagePrices) để
 * tra tên/tier thật, hàm này không còn tự suy đoán tier nữa.
 *
 * subscriptionPlanId mới là nguồn sự thật duy nhất để xác định gói của user —
 * mọi nơi cần biết giới hạn/tên gói phải tra cứu packagePrices theo id này
 * (các chỗ dùng subscriptionTier như "2-4"/"5+" chỉ còn là fallback hiển thị
 * cho user cũ chưa có subscriptionPlanId, không dùng để tính quota nữa).
 */
function mapSubscriptionTier(subscriptionPlanId?: number | null): User["subscriptionTier"] {
  // Không có gói (chưa từng mua) → free thật sự, không phải suy đoán.
  if (subscriptionPlanId === null || subscriptionPlanId === undefined) return "free"
  // Có subscriptionPlanId → để nguyên undefined, các nơi tiêu thụ phải tra
  // packagePrices theo subscriptionPlanId thay vì đoán qua field này.
  return undefined
}

export function mapApiUserToStoreUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    displayName: apiUser.displayName,
    password: "",
    role: mapRole(apiUser.role),
    isLocked: apiUser.locked,
    // BR-095/096: field mới trên UserResponse. Tài khoản cũ trước khi tính năng OTP
    // triển khai sẽ không có field này trong response — coi như đã verified để
    // không chặn nhầm người dùng hiện hữu.
    emailVerified: apiUser.emailVerified ?? true,
    createdAt: new Date(apiUser.createdAt),
    loginAttempts: 0,
    lastActive: new Date(),
    storageUsed: apiUser.storageUsedBytes,
    storageLimit: apiUser.storageLimitBytes,
    subscriptionPlanId: apiUser.subscriptionPlanId ?? null,
    subscriptionTier: mapSubscriptionTier(apiUser.subscriptionPlanId),
    subscriptionExpiresAt: apiUser.subscriptionExpiresAt ? new Date(apiUser.subscriptionExpiresAt) : undefined,
    languagePreference: apiUser.languagePreference === "en" ? "en" : "vi",
  }
}

async function handleAuthResponse(
  response: Response
): Promise<{ success: true; user: User } | { success: false; error: string }> {
  if (!response.ok) {
    return { success: false, error: await parseError(response) }
  }
  const data = (await response.json()) as AuthApiResponse
  setAccessToken(data.accessToken)
  return { success: true, user: mapApiUserToStoreUser(data.user) }
}

export interface LoginErrorResult {
  success: false
  error: string
  /** BR-097 — tài khoản chưa xác thực OTP; FE điều hướng sang màn hình OTP. */
  code?: "ACCOUNT_NOT_VERIFIED"
  email?: string
}

export async function loginApi(
  email: string,
  password: string
): Promise<{ success: true; user: User } | LoginErrorResult> {
  const response = MOCK_API
    ? await mockLoginRequest(email, password)
    : await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

  if (!response.ok) {
    let body: { message?: string; email?: string } = {}
    try {
      body = (await response.json()) as { message?: string; email?: string }
    } catch {
      // ignore parse errors
    }
    // BR-097 — lỗi mới dùng pattern BusinessException(ErrorCode), kèm field email phụ.
    if (response.status === 403 && body.message === "ACCOUNT_NOT_VERIFIED") {
      return {
        success: false,
        error: "Tài khoản chưa được xác thực. Vui lòng kiểm tra email và nhập mã xác thực.",
        code: "ACCOUNT_NOT_VERIFIED",
        email: body.email ?? email,
      }
    }
    // Các lỗi cũ (401/403 locked) dùng pattern legacy — message đã là câu tiếng Việt.
    return { success: false, error: body.message || "Đã xảy ra lỗi. Vui lòng thử lại." }
  }

  const data = (await response.json()) as AuthApiResponse
  setAccessToken(data.accessToken)
  return { success: true, user: mapApiUserToStoreUser(data.user) }
}

export interface RegisterSuccessResult {
  success: true
  /** BR-095 — true nghĩa là chưa cấp accessToken, FE phải điều hướng sang màn OTP. */
  requiresVerification: boolean
  email: string
  otpExpiresInSeconds?: number
}

export async function registerApi(
  email: string,
  password: string,
  confirmPassword: string,
  displayName: string
): Promise<RegisterSuccessResult | { success: false; error: string }> {
  const response = MOCK_API
    ? await mockRegisterRequest(email, password, confirmPassword, displayName)
    : await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword, displayName }),
      })

  if (!response.ok) {
    return { success: false, error: await parseError(response) }
  }

  const data = (await response.json()) as RegisterApiResponse
  return {
    success: true,
    requiresVerification: Boolean(data.requiresVerification),
    email: data.user?.email ?? email,
    otpExpiresInSeconds: data.otpExpiresInSeconds,
  }
}

/**
 * Xác thực mã OTP sau khi đăng ký (BR-096). Thành công thì tự động đăng nhập luôn
 * (accessToken được trả về giống response của login) — không cần qua màn Login lần nữa.
 */
export async function verifyOtpApi(
  email: string,
  otpCode: string
): Promise<{ success: true; user: User } | VerifyOtpErrorResult> {
  const response = MOCK_API
    ? await mockVerifyOtpRequest(email, otpCode)
    : await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otpCode }),
      })

  if (!response.ok) {
    let body: { message?: string; attemptsRemaining?: number } = {}
    try {
      body = (await response.json()) as { message?: string; attemptsRemaining?: number }
    } catch {
      // ignore parse errors
    }
    const code = body.message as VerifyOtpErrorCode | undefined
    return {
      success: false,
      error: mapOtpErrorMessage(code),
      code,
      attemptsRemaining: body.attemptsRemaining,
    }
  }

  const data = (await response.json()) as AuthApiResponse
  setAccessToken(data.accessToken)
  return { success: true, user: mapApiUserToStoreUser(data.user) }
}

export interface ResendOtpErrorResult {
  success: false
  error: string
  code?: "OTP_RESEND_COOLDOWN"
  retryAfterSeconds?: number
}

/**
 * Gửi lại mã OTP (BR-098). Luôn trả 200 dù email có tồn tại/đã verified hay không
 * (chống user-enumeration) — lỗi DUY NHẤT có thể xảy ra là cooldown 429.
 */
export async function resendOtpApi(
  email: string
): Promise<{ success: true; message: string } | ResendOtpErrorResult> {
  const response = MOCK_API
    ? await mockResendOtpRequest(email)
    : await fetch(`${API_BASE_URL}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

  let body: { message?: string; retryAfterSeconds?: number } = {}
  try {
    body = (await response.json()) as { message?: string; retryAfterSeconds?: number }
  } catch {
    // ignore parse errors
  }

  if (response.status === 429) {
    const retryAfterSeconds = body.retryAfterSeconds ?? 0
    return {
      success: false,
      error: `Vui lòng đợi ${retryAfterSeconds} giây trước khi gửi lại mã.`,
      code: "OTP_RESEND_COOLDOWN",
      retryAfterSeconds,
    }
  }

  if (!response.ok) {
    return { success: false, error: body.message || "Đã xảy ra lỗi. Vui lòng thử lại." }
  }

  return { success: true, message: body.message || "Nếu email tồn tại, mã xác thực đã được gửi." }
}

/**
 * Đăng nhập/đăng ký bằng Google.
 * Gửi access token lấy từ Google OAuth2 lên backend.
 * Backend gọi Google userinfo API để lấy thông tin user, sau đó tạo/tìm user và trả về JWT.
 */
export async function loginWithGoogleApi(
  accessToken: string
): Promise<{ success: true; user: User } | { success: false; error: string }> {
  const response = MOCK_API
    ? await mockGoogleLoginRequest(accessToken)
    : await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      })
  return handleAuthResponse(response)
}

export async function logoutApi(): Promise<void> {
  const token = getAccessToken()
  if (token) {
    try {
      if (MOCK_API) {
        await mockLogoutRequest(token)
      } else {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch {
      // client-side logout still proceeds
    }
  }
  clearAccessToken()
}

export async function fetchCurrentUserApi(): Promise<User | null> {
  const token = getAccessToken()
  if (!token) return null

  const response = MOCK_API
    ? await mockFetchCurrentUserRequest(token)
    : await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })

  if (!response.ok) {
    clearAccessToken()
    return null
  }

  const data = (await response.json()) as ApiUser
  return mapApiUserToStoreUser(data)
}

export async function updateLanguagePreferenceApi(language: Language): Promise<User> {
  const token = getAccessToken()
  const response = await fetch(`${API_BASE_URL}/api/auth/me/language`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ language }),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return mapApiUserToStoreUser((await response.json()) as ApiUser)
}

export async function updateProfileApi(displayName: string): Promise<User> {
  const token = getAccessToken()
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ displayName }),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return mapApiUserToStoreUser((await response.json()) as ApiUser)
}

export async function changePasswordApi(
  oldPassword: string,
  newPassword: string,
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  const token = getAccessToken()
  const response = await fetch(`${API_BASE_URL}/api/auth/me/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  })

  if (!response.ok) {
    return { success: false, error: await parseError(response) }
  }

  let message: string | undefined
  try {
    const body = (await response.json()) as MessageBody
    message = body.message
  } catch {
    // Empty response is acceptable for password change.
  }
  return { success: true, message }
}

export async function forgotPasswordApi(
  email: string
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (!response.ok) {
      return { success: false, error: await parseError(response) }
    }
    const body = (await response.json()) as MessageBody
    return { success: true, message: body.message }
  } catch {
    return { success: false, error: "Không thể kết nối đến máy chủ." }
  }
}

export async function resetPasswordApi(
  token: string,
  newPassword: string
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    })
    if (!response.ok) {
      return { success: false, error: await parseError(response) }
    }
    const body = (await response.json()) as MessageBody
    return { success: true, message: body.message }
  } catch {
    return { success: false, error: "Không thể kết nối đến máy chủ." }
  }
}
