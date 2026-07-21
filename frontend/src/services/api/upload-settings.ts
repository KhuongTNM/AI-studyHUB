import { getAccessToken } from "@/lib/auth-storage"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface UploadSettings {
  maxFileSizeBytes: number
  maxFileSizeMb: number
  maxFilesPerUpload: number
}

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
  return "Không thể tải cấu hình upload."
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Public — không cần đăng nhập. */
export async function fetchUploadSettingsApi(): Promise<UploadSettings> {
  const response = await fetch(`${API_BASE_URL}/api/upload-settings`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

/** Admin/Sub-admin — cần mật khẩu admin. */
export async function updateUploadSettingsApi(
  maxFileSizeMb: number,
  maxFilesPerUpload: number,
  adminPassword: string,
): Promise<UploadSettings> {
  const response = await fetch(`${API_BASE_URL}/api/admin/upload-settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ maxFileSizeMb, maxFilesPerUpload, adminPassword }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}
