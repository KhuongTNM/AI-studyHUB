import { getAccessToken } from "@/lib/auth-storage"
import type { Folder } from "@/states/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Backend DTO ─────────────────────────────────────────────────────────────

/** FolderNodeResponse từ backend — cây đệ quy */
interface ApiFolderNode {
  id: string
  name: string
  subject?: string | null
  children: ApiFolderNode[]
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

/**
 * Chuyển cây phân cấp từ backend → mảng phẳng mà frontend dùng.
 * parentId được gán từ ngữ cảnh khi duyệt cây (backend không trả về field này).
 */
function flattenFolderTree(
  nodes: ApiFolderNode[],
  parentId: string | null = null,
): Folder[] {
  const result: Folder[] = []
  for (const node of nodes) {
    result.push({
      id: node.id,
      name: node.name,
      parentId,
      subject: node.subject ?? undefined,
      createdAt: new Date(),   // backend không trả về, dùng giá trị mặc định
      createdBy: "",
    })
    if (node.children?.length) {
      result.push(...flattenFolderTree(node.children, node.id))
    }
  }
  return result
}

/** Map một FolderNodeResponse → Folder với parentId từ caller */
function mapNode(node: ApiFolderNode, parentId: string | null): Folder {
  return {
    id: node.id,
    name: node.name,
    parentId,
    subject: node.subject ?? undefined,
    createdAt: new Date(),
    createdBy: "",
  }
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * GET /api/folders
 * Lấy toàn bộ cây thư mục của user, trả về mảng phẳng.
 */
export async function fetchFolderTreeApi(): Promise<Folder[]> {
  const response = await fetch(`${API_BASE_URL}/api/folders`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const tree = (await response.json()) as ApiFolderNode[]
  return flattenFolderTree(tree, null)
}

/**
 * POST /api/folders
 * Tạo thư mục mới.
 * Backend kiểm tra BR-086 (tên trùng), BR-080 (quyền sở hữu).
 */
export async function createFolderApi(
  name: string,
  parentId: string | null,
  subject?: string,
): Promise<Folder> {
  const response = await fetch(`${API_BASE_URL}/api/folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      name,
      parentId: parentId ?? null,
      subject: subject ?? null,
    }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const node = (await response.json()) as ApiFolderNode
  return mapNode(node, parentId)
}

/**
 * PUT /api/folders/{id}
 * Đổi tên (+ tùy chọn cập nhật môn học).
 * subject = undefined → giữ nguyên ở backend.
 * Backend kiểm tra BR-086 (tên trùng), BR-080 (quyền sở hữu).
 */
export async function renameFolderApi(
  id: string,
  name: string,
  subject?: string,
): Promise<void> {
  const body: Record<string, unknown> = { name }
  if (subject !== undefined) body.subject = subject || null
  const response = await fetch(`${API_BASE_URL}/api/folders/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

/**
 * DELETE /api/folders/{id}
 * Xóa thư mục + cascade con (BR-084). Docs → folderId = NULL (BR-085).
 * Backend kiểm tra BR-080 (quyền sở hữu).
 */
export async function deleteFolderApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/folders/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

/**
 * PUT /api/folders/{id}/move
 * Di chuyển thư mục (BR-087 — backend validate circular move).
 * targetParentId = null → chuyển lên cấp gốc.
 */
export async function moveFolderApi(
  id: string,
  targetParentId: string | null,
): Promise<void> {
  const url = new URL(`${API_BASE_URL}/api/folders/${id}/move`)
  if (targetParentId !== null) {
    url.searchParams.set("targetParentId", targetParentId)
  }
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
}
