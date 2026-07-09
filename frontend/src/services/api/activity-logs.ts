import { getAccessToken } from "@/lib/auth-storage"
import type { ActivityLog } from "@/states/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface ApiActivityLog {
  id: string
  userId: string
  action: string
  targetType?: string | null
  targetId?: string | null
  description?: string | null
  createdAt: string
}

interface ApiPage<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

interface ErrorBody {
  message?: string
}

export interface ActivityLogsPage {
  logs: ActivityLog[]
  total: number
  totalPages: number
  page: number
  size: number
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore
  }
  return "Không thể tải nhật ký hoạt động."
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function readableAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function mapActivityLog(api: ApiActivityLog): ActivityLog {
  const targetParts = [
    api.targetType ? readableAction(api.targetType) : null,
    api.targetId ?? null,
  ].filter(Boolean)

  return {
    id: api.id,
    userId: api.userId,
    action: readableAction(api.action),
    target: api.description || targetParts.join(" • ") || "-",
    timestamp: new Date(api.createdAt),
  }
}

export async function fetchActivityLogsApi(page = 0, size = 20): Promise<ActivityLogsPage> {
  const url = new URL(`${API_BASE_URL}/api/admin/activity-logs`)
  url.searchParams.set("page", String(page))
  url.searchParams.set("size", String(size))

  const response = await fetch(url.toString(), {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))

  const data = (await response.json()) as ApiPage<ApiActivityLog>
  return {
    logs: data.content.map(mapActivityLog),
    total: data.totalElements,
    totalPages: data.totalPages,
    page: data.number,
    size: data.size,
  }
}
