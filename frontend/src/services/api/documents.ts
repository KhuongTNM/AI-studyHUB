import { getAccessToken } from "@/lib/auth-storage"
import { formatBytes } from "@/utils/format"
import type { Document, DocStatus } from "@/states/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Backend DTO ─────────────────────────────────────────────────────────────

interface ApiDocument {
  id: string
  userId: string
  folderId?: string | null    // FR-23: thêm folderId
  originalName: string
  title?: string | null
  fileUrl?: string | null
  fileSizeBytes: number
  fileType: string
  subject: string
  description?: string | null
  tags?: string[] | string | null
  status: string
  visibility: string
  downloadCount: number
  createdAt: string
  updatedAt: string
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

function mapFileType(fileType: string): "pdf" | "docx" | "pptx" {
  const lower = fileType.toLowerCase()
  if (lower === "docx") return "docx"
  if (lower === "pptx") return "pptx"
  return "pdf"
}

function mapStatus(status: string): DocStatus {
  switch (status) {
    case "uploading": return "uploading"
    case "scanning":  return "scanning"
    case "failed":    return "failed"
    case "deleted":   return "deleted"
    default:          return "ready"
  }
}

export function mapApiDocumentToDocument(api: ApiDocument): Document {
  return {
    id: api.id,
    name: api.title || api.originalName,
    type: mapFileType(api.fileType),
    size: formatBytes(api.fileSizeBytes),
    sizeBytes: api.fileSizeBytes,
    uploadedAt: new Date(api.createdAt),
    uploadedBy: api.userId,
    categoryId: "",
    subject: api.subject,
    folderId: api.folderId ?? null,   // FR-23: map folderId từ backend
    status: mapStatus(api.status),
    description: api.description ?? undefined,
    tags: Array.isArray(api.tags)
      ? api.tags
      : typeof api.tags === "string"
      ? api.tags.split(",").map(t => t.trim()).filter(Boolean)
      : [],
    downloadCount: api.downloadCount,
    isPublic: api.visibility === "public",
    shareStatus: "none",
  }
}

// ─── API calls ───────────────────────────────────────────────────────────────

/** GET /api/documents — lấy tài liệu của user hiện tại (BR-024) */
export async function fetchDocumentsApi(): Promise<Document[]> {
  const response = await fetch(`${API_BASE_URL}/api/documents`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const docs = (await response.json()) as ApiDocument[]
  return docs.map(mapApiDocumentToDocument)
}

/**
 * GET /api/documents?keyword=...&subject=...&tag=...
 * Gọi backend search — backend xử lý tìm theo tiêu đề, môn học, tag.
 * Nếu không truyền param nào, tương đương fetchDocumentsApi().
 */
export async function searchDocumentsApi(params: {
  keyword?: string
  subject?: string
  tag?: string
} = {}): Promise<Document[]> {
  const url = new URL(`${API_BASE_URL}/api/documents`)
  if (params.keyword?.trim()) url.searchParams.set("keyword", params.keyword.trim())
  if (params.subject && params.subject !== "all") url.searchParams.set("subject", params.subject.trim())
  if (params.tag?.trim()) url.searchParams.set("tag", params.tag.trim())

  const response = await fetch(url.toString(), {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const docs = (await response.json()) as ApiDocument[]
  return docs.map(mapApiDocumentToDocument)
}

/** GET /api/documents/public — lấy tài liệu public (BR-018) */
export async function fetchPublicDocumentsApi(): Promise<Document[]> {
  const response = await fetch(`${API_BASE_URL}/api/documents/public`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const docs = (await response.json()) as ApiDocument[]
  return docs.map(mapApiDocumentToDocument)
}

/** GET /api/documents/trash — lấy tài liệu trong trash (BR-022) */
export async function fetchTrashDocumentsApi(): Promise<Document[]> {
  const response = await fetch(`${API_BASE_URL}/api/documents/trash`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const docs = (await response.json()) as ApiDocument[]
  return docs.map(mapApiDocumentToDocument)
}

/**
 * POST /api/documents/upload — upload tài liệu (BR-013 đến BR-018).
 */
export async function uploadDocumentApi(
  file: File,
  subject: string,
  title?: string,
  visibility: "private" | "public" = "private",
  onProgress?: (progress: number) => void,
): Promise<Document> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("subject", subject)
  if (title) formData.append("title", title)
  formData.append("visibility", visibility)

  let fakeProgress = 0
  const progressInterval = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + Math.random() * 18 + 7, 88)
    onProgress?.(Math.round(fakeProgress))
  }, 350)

  try {
    const token = getAccessToken()
    const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    clearInterval(progressInterval)
    onProgress?.(100)
    if (!response.ok) throw new Error(await parseError(response))
    return mapApiDocumentToDocument((await response.json()) as ApiDocument)
  } catch (e) {
    clearInterval(progressInterval)
    throw e
  }
}

/** DELETE /api/documents/{id} — soft-delete tài liệu (BR-022) */
export async function deleteDocumentApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

/** PUT /api/documents/{id}/visibility — đổi public/private (BR-018, BR-019) */
export async function updateDocumentVisibilityApi(
  id: string,
  visibility: "private" | "public",
): Promise<Document> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}/visibility`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ visibility }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiDocumentToDocument((await response.json()) as ApiDocument)
}

/** POST /api/documents/{id}/restore — khôi phục từ trash (BR-023) */
export async function restoreDocumentApi(id: string): Promise<Document> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}/restore`, {
    method: "POST",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiDocumentToDocument((await response.json()) as ApiDocument)
}

/**
 * POST /api/documents/{id}/download — tăng downloadCount và tải file (BR-021).
 */
export async function downloadDocumentApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}/download`, {
    method: "POST",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))

  const blob = await response.blob()
  const contentDisposition = response.headers.get("Content-Disposition")
  let filename = "document"
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/)
    if (match?.[1]) filename = match[1].trim()
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** GET /api/documents/{id}/preview — stream file inline for preview before download. */
export async function previewDocumentApi(id: string): Promise<{ url: string; contentType: string }> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}/preview`, {
    method: "GET",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))

  const blob = await response.blob()
  return {
    url: URL.createObjectURL(blob),
    contentType: response.headers.get("Content-Type") || blob.type || "application/octet-stream",
  }
}

/**
 * PATCH /api/documents/{id}
 * FR-23: Di chuyển tài liệu vào thư mục khác hoặc về root.
 * folderId = null → Folder_ID = NULL (BR-085).
 */
export async function updateDocumentFolderApi(
  id: string,
  folderId: string | null,
): Promise<Document> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ folderId }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiDocumentToDocument((await response.json()) as ApiDocument)
}
