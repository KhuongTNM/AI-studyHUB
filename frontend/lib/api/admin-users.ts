import { getAccessToken } from "@/lib/auth-storage"
import { mapApiUserToStoreUser, type ApiUser } from "@/lib/api/auth"
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
  return "Không thể cập nhật dung lượng. Vui lòng thử lại."
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
