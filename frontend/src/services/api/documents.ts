import { getAccessToken } from "@/lib/auth-storage"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface ApiDocument {
  id: string
  userId: string
  originalName: string
  fileUrl: string
  fileSizeBytes: number
  fileType: string
  subject: string
  description: string | null
  tags: string | null
  status: string
  downloadCount: number
  createdAt: string
  updatedAt: string
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (body.message) return body.message
  } catch {}
  return "Đã xảy ra lỗi. Vui lòng thử lại."
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  return headers
}

export interface UploadProgressCallbacks {
  onProgress?: (percent: number) => void
}

export async function uploadDocumentApi(
  file: File,
  subject: string,
  title: string,
  callbacks?: UploadProgressCallbacks,
): Promise<ApiDocument> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${API_BASE_URL}/api/documents/upload`)

    const token = getAccessToken()
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && callbacks?.onProgress) {
        callbacks.onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        try {
          const body = JSON.parse(xhr.responseText)
          reject(new Error(body.message ?? "Upload thất bại."))
        } catch {
          reject(new Error("Upload thất bại."))
        }
      }
    }

    xhr.onerror = () => reject(new Error("Lỗi kết nối."))

    const formData = new FormData()
    formData.append("file", file)
    formData.append("subject", subject)
    formData.append("title", title || file.name)
    xhr.send(formData)
  })
}

export async function listDocumentsApi(): Promise<ApiDocument[]> {
  const response = await fetch(`${API_BASE_URL}/api/documents`, {
    headers: { ...authHeaders() },
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function getDocumentApi(id: string): Promise<ApiDocument> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
    headers: { ...authHeaders() },
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function deleteDocumentApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  })
  if (!response.ok) throw new Error(await parseError(response))
}
