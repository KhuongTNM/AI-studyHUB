import { getAccessToken } from "@/lib/auth-storage"
import type { DocStatus, Document } from "@/states/types"
import { formatBytes } from "@/lib/store"

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

function mapDoc(api: ApiDocument): Document {
  return {
    id: api.id,
    name: api.originalName,
    type: api.fileType as "pdf" | "docx" | "pptx",
    size: formatBytes(api.fileSizeBytes),
    sizeBytes: api.fileSizeBytes,
    uploadedAt: new Date(api.createdAt),
    uploadedBy: api.userId,
    categoryId: "",
    subject: api.subject,
    status: api.status as DocStatus,
    description: api.description ?? undefined,
    tags: api.tags ? api.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    downloadCount: api.downloadCount,
    isPublic: false,
    shareStatus: "none",
  }
}

export async function uploadDocumentApi(
  file: File,
  subject: string,
  onProgress?: (pct: number) => void,
): Promise<Document> {
  return new Promise((resolve, reject) => {
    const token = getAccessToken()
    const fd = new FormData()
    fd.append("file", file)
    fd.append("subject", subject)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${API_BASE_URL}/api/documents/upload`)

    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const api: ApiDocument = JSON.parse(xhr.responseText)
        resolve(mapDoc(api))
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
    xhr.send(fd)
  })
}

export async function listDocumentsApi(): Promise<Document[]> {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE_URL}/api/documents`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error("Không thể tải danh sách tài liệu.")
  const list: ApiDocument[] = await res.json()
  return list.map(mapDoc)
}

export async function getDocumentApi(id: string): Promise<Document> {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? "Không thể lấy thông tin tài liệu.")
  }
  return mapDoc(await res.json())
}

export async function deleteDocumentApi(id: string): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error("Xóa tài liệu thất bại.")
}

export function getDownloadUrl(id: string): string {
  const token = getAccessToken()
  const url = `${API_BASE_URL}/api/documents/${id}/download`
  if (token) return `${url}?token=${encodeURIComponent(token)}`
  return url
}
