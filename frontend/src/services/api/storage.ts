import { getAccessToken } from "@/lib/auth-storage"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface ApiStorageUsage {
  used: number
  limit: number
  percent: number
}

interface ErrorBody {
  message?: string
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore
  }
  return "Không thể tải thông tin dung lượng."
}

export async function fetchStorageUsageApi(): Promise<ApiStorageUsage> {
  const token = getAccessToken()
  const response = await fetch(`${API_BASE_URL}/api/users/me/storage`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as ApiStorageUsage
}
