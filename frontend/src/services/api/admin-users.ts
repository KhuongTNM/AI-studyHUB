import { getAccessToken } from "@/lib/auth-storage"
import { mapApiUserToStoreUser, type ApiUser } from "@/services/api/auth"
import type { User } from "@/lib/store"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface ErrorBody {
  message?: string
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore parse errors
  }
  return "KhÃ´ng thá»ƒ cáº­p nháº­t dung lÆ°á»£ng. Vui lÃ²ng thá»­ láº¡i."
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchAdminUsersApi(): Promise<User[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const users = (await response.json()) as ApiUser[]
  return users.map(mapApiUserToStoreUser)
}

export async function updateUserStorageLimitApi(userId: string, storageLimitGb: number): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/storage-limit`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ storageLimitGb }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiUserToStoreUser((await response.json()) as ApiUser)
}

/** BR-062: Admin creates a sub-admin account with 1GB storage and persisted activity log. */
export async function createSubAdminApi(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/sub-admins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ email, password, displayName }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiUserToStoreUser((await response.json()) as ApiUser)
}

/** BR-061: Lock (isLocked=true) or unlock (isLocked=false) a user account */
export async function toggleUserLockApi(userId: string, locked: boolean): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/lock`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ locked }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiUserToStoreUser((await response.json()) as ApiUser)
}


/** BR-062: Admin/Sub-admin reset mật khẩu của user bất kỳ (trừ Admin). */
export async function resetUserPasswordApi(userId: string, newPassword: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ newPassword }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiUserToStoreUser((await response.json()) as ApiUser)
}

/**
 * BR-063: Admin/Sub-admin cấp gói subscription trực tiếp cho user.
 *
 * @param plan  Tên gói: "plan_2_4" | "plan_5_plus" | "free"
 * @param durationMonths  Số tháng hiệu lực
 */
export async function grantSubscriptionApi(
  userId: string,
  plan: string,
  durationMonths: number,
): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ plan, durationMonths }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiUserToStoreUser((await response.json()) as ApiUser)
}
