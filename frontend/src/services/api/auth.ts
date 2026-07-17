import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth-storage"
import type { Language, User, UserRole } from "@/lib/store"
import { MOCK_API } from "@/services/mock/mock-config"
import {
  mockLoginRequest,
  mockRegisterRequest,
  mockGoogleLoginRequest,
  mockLogoutRequest,
  mockFetchCurrentUserRequest,
} from "@/services/mock/auth.mock"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface ApiUser {
  id: string
  email: string
  displayName: string
  role: string
  locked: boolean
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

interface ErrorBody {
  message?: string
}

interface MessageBody {
  message?: string
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

function mapSubscriptionTier(subscriptionPlanId?: number | null): User["subscriptionTier"] {
  if (subscriptionPlanId === 2) return "2-4"
  if (subscriptionPlanId === 3) return "5+"
  return "free"
}

export function mapApiUserToStoreUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    displayName: apiUser.displayName,
    password: "",
    role: mapRole(apiUser.role),
    isLocked: apiUser.locked,
    emailVerified: true,
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

async function handleRegisterResponse(
  response: Response
): Promise<{ success: true } | { success: false; error: string }> {
  if (!response.ok) {
    return { success: false, error: await parseError(response) }
  }

  return { success: true }
}

export async function loginApi(email: string, password: string): Promise<{ success: true; user: User } | { success: false; error: string }> {
  const response = MOCK_API
    ? await mockLoginRequest(email, password)
    : await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
  return handleAuthResponse(response)
}

export async function registerApi(
  email: string,
  password: string,
  confirmPassword: string,
  displayName: string
): Promise<{ success: true } | { success: false; error: string }> {
  const response = MOCK_API
    ? await mockRegisterRequest(email, password, confirmPassword, displayName)
    : await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword, displayName }),
      })
  return handleRegisterResponse(response)
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
