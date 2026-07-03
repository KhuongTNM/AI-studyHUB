"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MOCK_CATEGORIES } from "@/states/mock-data"
import {
  fetchDocumentsApi,
  uploadDocumentApi,
  deleteDocumentApi,
  updateDocumentVisibilityApi,
  restoreDocumentApi,
  downloadDocumentApi,
  updateDocumentFolderApi,
  permanentDeleteDocumentApi,
  emptyTrashApi,
} from "@/services/api/documents"
import {
  fetchFolderTreeApi,
  createFolderApi,
  renameFolderApi,
  deleteFolderApi,
  moveFolderApi,
} from "@/services/api/folders"
import { fetchStorageUsageApi } from "@/services/api/storage"
import type { Category, Document, Folder, User } from "@/states/types"
import type { Dispatch, SetStateAction } from "react"

interface DocumentStateDeps {
  currentUser: User | null
  setCurrentUser: Dispatch<SetStateAction<User | null>>
}

export function useDocumentState({ currentUser, setCurrentUser }: DocumentStateDeps) {
  const [documents, setDocuments] = useState<Document[]>([])
  // Ref để uploadDocument luôn đọc documents mới nhất (tránh stale closure)
  const documentsRef = useRef<Document[]>(documents)
  useEffect(() => { documentsRef.current = documents }, [documents])
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES)
  const [folders, setFolders] = useState<Folder[]>([])

  // ── Load documents từ API khi user đăng nhập ────────────────────────────
  useEffect(() => {
    if (!currentUser) {
      setDocuments([])
      return
    }
    let cancelled = false
    fetchDocumentsApi()
      .then(docs => {
        if (!cancelled) setDocuments(docs)
      })
      .catch(() => {
        // Giữ nguyên state nếu backend không khả dụng
      })
    return () => { cancelled = true }
  }, [currentUser?.id])

  // ── Load folder tree từ API khi user đăng nhập (FR-23) ─────────────────
  useEffect(() => {
    if (!currentUser) {
      setFolders([])
      return
    }
    let cancelled = false
    fetchFolderTreeApi()
      .then(flat => {
        if (!cancelled) setFolders(flat)
      })
      .catch(() => {
        // Giữ nguyên state rỗng nếu backend không khả dụng
      })
    return () => { cancelled = true }
  }, [currentUser?.id])

  // ── Thêm document vào state (dùng nội bộ sau khi upload) ────────────────
  const addDocument = useCallback((doc: Document) => {
    setDocuments(prev => [doc, ...prev])
  }, [])

  // ── Cập nhật document cục bộ (dùng cho edit metadata, progress, v.v.) ──
  const updateDocument = useCallback((id: string, updates: Partial<Document>) => {
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, ...updates } : d)))
  }, [])

  const refreshStorageUsage = useCallback(async () => {
    if (!currentUser) return
    try {
      const storage = await fetchStorageUsageApi()
      setCurrentUser(prev =>
        prev
          ? {
              ...prev,
              storageUsed: storage.used,
              storageLimit: storage.limit,
            }
          : prev,
      )
    } catch {
      // Storage refresh is supporting UI state; keep the successful document action.
    }
  }, [currentUser, setCurrentUser])

  // ── Upload tài liệu thật lên backend (BR-013 đến BR-018) ────────────────
  const uploadDocument = useCallback(
    async (
      file: File,
      subject: string,
      visibility: "private" | "public" = "private",
      folderId?: string | null,
      tags?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }

      // ── Xử lý trùng tên file (giống logic backend restoreDocument) ─────────
      const lastDot = file.name.lastIndexOf(".")
      const base    = lastDot > 0 ? file.name.slice(0, lastDot) : file.name
      const dotExt  = lastDot > 0 ? file.name.slice(lastDot) : ""

      // Dùng documentsRef.current để tránh stale closure trong useCallback
      const activeNames = new Set(
        documentsRef.current
          .filter(d => d.status !== "deleted")
          .map(d => d.name)
      )

      const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const escapedExt  = dotExt.replace(".", "\\.")
      const suffixRe    = new RegExp(`^${escapedBase} \\((\\d+)\\)${escapedExt}$`)
      let maxN = 0
      for (const name of activeNames) {
        const m = name.match(suffixRe)
        if (m) {
          const n = parseInt(m[1], 10)
          if (n > maxN) maxN = n
        }
      }

      let resolvedFile = file
      if (activeNames.has(file.name)) {
        const newName = maxN > 0
          ? `${base} (${maxN + 1})${dotExt}`
          : `${base} (2)${dotExt}`
        resolvedFile = new File([file], newName, { type: file.type })
      }
      // ── Hết xử lý trùng tên ───────────────────────────────────────────────

      const tempId = `temp-${Date.now()}-${Math.random()}`
      const ext = (resolvedFile.name.split(".").pop() ?? "pdf").toLowerCase() as "pdf" | "docx" | "pptx"
      const tempDoc: Document = {
        id: tempId,
        name: resolvedFile.name,
        type: ext,
        size: "",
        sizeBytes: file.size,
        uploadedAt: new Date(),
        uploadedBy: currentUser.id,
        categoryId: "",
        subject,
        folderId,
        status: "uploading",
        uploadProgress: 0,
        tags: [],
        downloadCount: 0,
        isPublic: visibility === "public",
        shareStatus: "none",
        embeddingStatus: "none",
      }
      setDocuments(prev => [tempDoc, ...prev])

      try {
        const realDoc = await uploadDocumentApi(resolvedFile, subject, undefined, visibility, progress => {
          setDocuments(prev =>
            prev.map(d => d.id === tempId ? { ...d, uploadProgress: progress } : d),
          )
        }, tags)

        setDocuments(prev =>
          prev.map(d => d.id === tempId ? { ...realDoc, folderId, status: "scanning" } : d),
        )

        // FR-23: Persist folderId lên backend sau khi upload thành công.
        // uploadDocumentApi không nhận folderId, nên phải gọi PATCH riêng.
        if (folderId) {
          updateDocumentFolderApi(realDoc.id, folderId).catch(() => {
            // Không throw — folderId vẫn đúng trong memory session này.
          })
        }
        void refreshStorageUsage()

        let attempts = 0
        const poll = setInterval(async () => {
          attempts++
          if (attempts > 24) { clearInterval(poll); return }
          try {
            const refreshed = await fetchDocumentsApi()
            const updated = refreshed.find(d => d.id === realDoc.id)
            if (updated && updated.status !== "scanning" && updated.status !== "uploading") {
              clearInterval(poll)
              setDocuments(prev =>
                prev.map(d => d.id === realDoc.id ? { ...updated, folderId } : d),
              )
            }
          } catch {
            clearInterval(poll)
          }
        }, 2500)

        return { success: true }
      } catch (error) {
        setDocuments(prev => prev.filter(d => d.id !== tempId))
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể upload tài liệu.",
        }
      }
    },
    [currentUser, refreshStorageUsage],
  )

  // ── Soft-delete → chuyển vào Trash (BR-022) ─────────────────────────────
  const deleteDocument = useCallback((id: string) => {
    const previousDoc = documentsRef.current.find(d => d.id === id)
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: "deleted" } : d))
    deleteDocumentApi(id)
      .then(() => refreshStorageUsage())
      .catch(() => {
        if (previousDoc) {
          setDocuments(prev => prev.map(d => d.id === id ? previousDoc : d))
        } else {
          setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: "ready" } : d))
        }
      })
  }, [refreshStorageUsage])

  // ── Khôi phục từ Trash (BR-023) ─────────────────────────────────────────
  // Doc bị xóa không có trong global documents (API không trả về) → phải ADD vào, không dùng .map()
  const restoreDocument = useCallback((id: string) => {
    restoreDocumentApi(id)
      .then(updated => {
        setDocuments(prev => {
          const exists = prev.some(d => d.id === id)
          // Nếu đã có (edge case) → update; nếu chưa có (từ trash) → thêm lên đầu
          return exists
            ? prev.map(d => d.id === id ? updated : d)
            : [updated, ...prev]
        })
        void refreshStorageUsage()
      })
      .catch(() => {
        // trash-page.tsx tự rollback trashDocs nếu lỗi
      })
  }, [refreshStorageUsage])

  // ── Đổi visibility public/private (BR-018, BR-019) ──────────────────────
  const changeDocumentVisibility = useCallback(
    async (id: string, isPublic: boolean): Promise<{ success: boolean; error?: string }> => {
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, isPublic } : d))
      try {
        const updated = await updateDocumentVisibilityApi(id, isPublic ? "public" : "private")
        setDocuments(prev => prev.map(d => d.id === id ? updated : d))
        return { success: true }
      } catch (error) {
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, isPublic: !isPublic } : d))
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể cập nhật chia sẻ tài liệu.",
        }
      }
    },
    [],
  )

  // ── Tải xuống file + tăng downloadCount (BR-021) ─────────────────────────
  const downloadDocument = useCallback((id: string) => {
    setDocuments(prev =>
      prev.map(d => d.id === id ? { ...d, downloadCount: d.downloadCount + 1 } : d),
    )
    downloadDocumentApi(id).catch(() => {
      setDocuments(prev =>
        prev.map(d => d.id === id
          ? { ...d, downloadCount: Math.max(0, d.downloadCount - 1) }
          : d,
        ),
      )
    })
  }, [])

  // ── FR-24: Xóa vĩnh viễn 1 file khỏi thùng rác ─────────────────────────
  const permanentDeleteDocument = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      // Optimistic: xóa khỏi state ngay
      setDocuments(prev => prev.filter(d => d.id !== id))
      try {
        await permanentDeleteDocumentApi(id)
        await refreshStorageUsage()
        return { success: true }
      } catch (error) {
        // Rollback: tải lại danh sách trash từ server
        fetchDocumentsApi().then(docs => setDocuments(docs)).catch(() => {})
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể xóa vĩnh viễn tài liệu.",
        }
      }
    },
    [refreshStorageUsage],
  )

  // ── FR-24: Dọn sạch toàn bộ thùng rác ──────────────────────────────────
  const emptyTrash = useCallback(
    async (): Promise<{ success: boolean; error?: string }> => {
      // Optimistic: xóa hết file status=deleted khỏi state
      setDocuments(prev => prev.filter(d => d.status !== "deleted"))
      try {
        await emptyTrashApi()
        await refreshStorageUsage()
        return { success: true }
      } catch (error) {
        // Rollback: tải lại từ server
        fetchDocumentsApi().then(docs => setDocuments(docs)).catch(() => {})
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể dọn sạch thùng rác.",
        }
      }
    },
    [refreshStorageUsage],
  )

  // ── Categories (local-only; không có API endpoint) ───────────────────────
  const addCategory = useCallback((name: string, color: string) => {
    const cat: Category = { id: `cat-${Date.now()}`, name, color }
    setCategories(prev => [...prev, cat])
  }, [])

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id))
  }, [])

  // ── FR-23: Tạo thư mục → POST /api/folders ──────────────────────────────
  // BR-080: quyền sở hữu; BR-082: gắn môn học; BR-086: backend validate tên trùng
  const createFolder = useCallback(
    async (
      name: string,
      parentId: string | null = null,
      subject?: string,
    ): Promise<{ success: boolean; folder?: Folder; error?: string }> => {
      if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }

      // Optimistic: thêm placeholder ngay
      const tempId = `temp-folder-${Date.now()}`
      const tempFolder: Folder = {
        id: tempId,
        name,
        parentId,
        subject,
        createdAt: new Date(),
        createdBy: currentUser.id,
      }
      setFolders(prev => [...prev, tempFolder])

      try {
        const realFolder = await createFolderApi(name, parentId, subject)
        setFolders(prev => prev.map(f => f.id === tempId ? realFolder : f))
        return { success: true, folder: realFolder }
      } catch (error) {
        setFolders(prev => prev.filter(f => f.id !== tempId))
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể tạo thư mục.",
        }
      }
    },
    [currentUser],
  )

  // ── FR-23: Đổi tên thư mục → PUT /api/folders/{id} ──────────────────────
  // BR-086: backend validate tên trùng trong cùng cấp
  const renameFolder = useCallback(
    async (
      id: string,
      name: string,
      subject?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      const prev = folders.find(f => f.id === id)
      // Optimistic
      setFolders(flds =>
        flds.map(f =>
          f.id === id
            ? { ...f, name, ...(subject !== undefined ? { subject } : {}) }
            : f,
        ),
      )

      try {
        await renameFolderApi(id, name, subject)
        return { success: true }
      } catch (error) {
        if (prev) setFolders(flds => flds.map(f => f.id === id ? prev : f))
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể đổi tên thư mục.",
        }
      }
    },
    [folders],
  )

  // ── FR-23: Xóa thư mục → DELETE /api/folders/{id} ───────────────────────
  // BR-084: cascade xóa con; BR-085: docs trong folder → folderId = null
  const deleteFolder = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      const collectIds = (parentId: string, all: Folder[]): string[] => {
        const children = all.filter(f => f.parentId === parentId)
        return [parentId, ...children.flatMap(c => collectIds(c.id, all))]
      }
      const idsToDelete = collectIds(id, folders)
      const prevFolders = folders
      const prevDocuments = documentsRef.current

      // Optimistic: xóa folder khỏi state ngay
      setFolders(prev => prev.filter(f => !idsToDelete.includes(f.id)))
      // Optimistic: docs trong folder → chuyển sang status "deleted" (đưa vào thùng rác)
      setDocuments(prev =>
        prev.map(d =>
          d.folderId != null && idsToDelete.includes(d.folderId)
            ? { ...d, status: "deleted" as const, folderId: null }
            : d,
        ),
      )

      try {
        await deleteFolderApi(id)
        return { success: true }
      } catch (error) {
        // Rollback cả folders lẫn documents
        setFolders(prevFolders)
        setDocuments(prevDocuments)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể xóa thư mục.",
        }
      }
    },
    [folders],
  )

  // ── FR-23: Di chuyển thư mục → PUT /api/folders/{id}/move ───────────────
  // BR-087: backend ngăn circular move; MoveFolderModal cũng lọc phía UI
  const moveFolder = useCallback(
    async (
      folderId: string,
      targetParentId: string | null,
    ): Promise<{ success: boolean; error?: string }> => {
      const prev = folders.find(f => f.id === folderId)
      setFolders(flds =>
        flds.map(f => f.id === folderId ? { ...f, parentId: targetParentId } : f),
      )

      try {
        await moveFolderApi(folderId, targetParentId)
        return { success: true }
      } catch (error) {
        if (prev) setFolders(flds => flds.map(f => f.id === folderId ? prev : f))
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể di chuyển thư mục.",
        }
      }
    },
    [folders],
  )

  // ── FR-23: Di chuyển tài liệu → PATCH /api/documents/{id} ──────────────
  // folderId = null → về root (BR-085)
  const moveDocumentToFolder = useCallback(
    async (
      docId: string,
      folderId: string | null,
    ): Promise<{ success: boolean; error?: string }> => {
      const prevFolderId = documents.find(d => d.id === docId)?.folderId ?? null
      setDocuments(prev =>
        prev.map(d => d.id === docId ? { ...d, folderId } : d),
      )

      try {
        await updateDocumentFolderApi(docId, folderId)
        return { success: true }
      } catch (error) {
        setDocuments(prev =>
          prev.map(d => d.id === docId ? { ...d, folderId: prevFolderId } : d),
        )
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể di chuyển tài liệu.",
        }
      }
    },
    [documents],
  )

  return {
    documents,
    /** Exposed so admin actions (e.g. deleteUserAccount) can soft-delete user docs */
    setDocuments,
    categories,
    folders,
    addDocument,
    updateDocument,
    uploadDocument,
    deleteDocument,
    restoreDocument,
    permanentDeleteDocument,
    emptyTrash,
    changeDocumentVisibility,
    downloadDocument,
    addCategory,
    deleteCategory,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    moveDocumentToFolder,
  }
}
