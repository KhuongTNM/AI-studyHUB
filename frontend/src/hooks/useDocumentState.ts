"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  ApiError,
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

type UploadPoll = {
  intervalId?: number
  cancelled: boolean
}

export function useDocumentState({ currentUser, setCurrentUser }: DocumentStateDeps) {
  const [documents, setDocuments] = useState<Document[]>([])
  // Ref để uploadDocument luôn đọc documents mới nhất (tránh stale closure)
  const documentsRef = useRef<Document[]>(documents)
  const uploadPollsRef = useRef(new Map<string, UploadPoll>())
  useEffect(() => { documentsRef.current = documents }, [documents])
  const [categories, setCategories] = useState<Category[]>([])
  const [folders, setFolders] = useState<Folder[]>([])

  // Upload processing polls must not survive an account switch or unmount.
  useEffect(() => {
    return () => {
      for (const poll of uploadPollsRef.current.values()) {
        poll.cancelled = true
        if (poll.intervalId !== undefined) window.clearInterval(poll.intervalId)
      }
      uploadPollsRef.current.clear()
    }
  }, [currentUser?.id])

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
      batchId?: string,
    ): Promise<{ success: boolean; error?: string; code?: string; details?: { fileName?: string; folderId?: string | null } }> => {
      if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }

      // BR mới (mục 3, docx): KHÔNG tự đổi tên khi trùng — BE/mock từ chối
      // upload và trả 409 nếu originalName trùng trong cùng folder. FE chỉ
      // hiển thị lỗi và giữ nguyên form để user tự đổi tên/thư mục rồi thử lại.
      const tempId = `temp-${Date.now()}-${Math.random()}`
      const ext = (file.name.split(".").pop() ?? "pdf").toLowerCase() as "pdf" | "docx" | "pptx"
      const tempDoc: Document = {
        id: tempId,
        name: file.name,
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
        const realDoc = await uploadDocumentApi(file, subject, undefined, visibility, progress => {
          setDocuments(prev =>
            prev.map(d => d.id === tempId ? { ...d, uploadProgress: progress } : d),
          )
        }, tags, folderId, batchId)

        setDocuments(prev =>
          prev.map(d => d.id === tempId ? { ...realDoc, folderId, status: "scanning" } : d),
        )

        // uploadDocumentApi đã gửi kèm folderId ngay trong request upload
        // (formData) — KHÔNG cần gọi PATCH riêng để persist folderId nữa.
        void refreshStorageUsage()

        let attempts = 0
        let requestInFlight = false
        const pollState: UploadPoll = { cancelled: false }
        const stopPolling = () => {
          pollState.cancelled = true
          if (pollState.intervalId !== undefined) window.clearInterval(pollState.intervalId)
          if (uploadPollsRef.current.get(realDoc.id) === pollState) {
            uploadPollsRef.current.delete(realDoc.id)
          }
        }

        const poll = window.setInterval(async () => {
          if (pollState.cancelled || requestInFlight) return
          requestInFlight = true
          attempts++
          if (attempts > 40) {
            stopPolling()
            requestInFlight = false
            return
          }
          try {
            const refreshed = await fetchDocumentsApi()
            if (pollState.cancelled) return

            const updated = refreshed.find(d => d.id === realDoc.id)
            if (updated) {
              setDocuments(prev =>
                prev.map(d => d.id === realDoc.id ? { ...updated, folderId } : d),
              )
              const isStatusReady = updated.status !== "scanning" && updated.status !== "uploading"
              const isEmbeddingReady = updated.embeddingStatus === "done" || updated.embeddingStatus === "failed"
              if (isStatusReady && isEmbeddingReady) {
                stopPolling()
              }
            }
          } catch {
            stopPolling()
          } finally {
            requestInFlight = false
          }
        }, 2500)
        pollState.intervalId = poll
        uploadPollsRef.current.set(realDoc.id, pollState)

        return { success: true }
      } catch (error) {
        setDocuments(prev => prev.filter(d => d.id !== tempId))
        if (error instanceof ApiError) {
          return { success: false, error: error.message, code: error.code, details: error.details }
        }
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

  // ── Khôi phục từ Trash (BR-023, restore-duplicate-guard.md) ────────────────
  // Doc bị xóa không có trong global documents (API không trả về) → phải ADD vào, không dùng .map()
  // autoRename=true → BE tự thêm hậu tố (n) khi trùng tên; false/undefined → 409 nếu trùng.
  const restoreDocument = useCallback(
    async (
      id: string,
      autoRename?: boolean,
    ): Promise<{ success: boolean; error?: string; code?: string; details?: { fileName?: string; folderId?: string | null } }> => {
      try {
        const updated = await restoreDocumentApi(id, autoRename)
        setDocuments(prev => {
          const exists = prev.some(d => d.id === id)
          // Nếu đã có (edge case) → update; nếu chưa có (từ trash) → thêm lên đầu
          return exists
            ? prev.map(d => d.id === id ? updated : d)
            : [updated, ...prev]
        })
        void refreshStorageUsage()
        return { success: true }
      } catch (error) {
        // Khi 409 DUPLICATE_FILE_NAME: KHÔNG thêm doc vào state (file vẫn nằm trong Thùng rác)
        if (error instanceof ApiError) {
          return { success: false, error: error.message, code: error.code, details: error.details }
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể khôi phục tài liệu.",
        }
      }
    },
    [refreshStorageUsage],
  )

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
