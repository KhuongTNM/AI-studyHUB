import { getAccessToken } from "@/lib/auth-storage"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Backend DTO ─────────────────────────────────────────────────────────────

export interface ApiStudyRoom {
  id: string
  code: string
  hostId: string
  hasPassword: boolean
  maxMembers: number
  currentMemberCount: number
  active: boolean
  createdAt: string
}

interface ErrorBody {
  message?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore
  }
  return "Đã xảy ra lỗi. Vui lòng thử lại."
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * POST /api/study-rooms — tạo phòng học nhóm (BR-041 đến BR-043).
 *
 * Yêu cầu:
 * - User phải có gói trả phí còn hiệu lực (hoặc Admin / Sub-admin).
 * - roomCode viết hoa, duy nhất trong hệ thống.
 * - password tuỳ chọn.
 */
export async function createStudyRoomApi(
  roomCode: string,
  password?: string,
): Promise<ApiStudyRoom> {
  const body: Record<string, string> = { roomCode: roomCode.trim().toUpperCase() }
  if (password && password.trim()) body.password = password.trim()

  const response = await fetch(`${API_BASE_URL}/api/study-rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as ApiStudyRoom
}
