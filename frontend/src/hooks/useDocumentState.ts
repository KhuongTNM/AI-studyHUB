"use client"

import { useCallback, useEffect, useState } from "react"
import { MOCK_CATEGORIES } from "@/states/mock-data"
import {
  fetchDocumentsApi,
  uploadDocumentApi,
  deleteDocumentApi,
  updateDocumentVisibilityApi,
  restoreDocumentApi,
  downloadDocumentApi,
} from "@/services/api/documents"
import type { Category, Document, User } from "@/states/types"

interface DocumentStateDeps {
  currentUser: User | null
}

export function useDocumentState({ currentUser }: DocumentStateDeps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES)

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
    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  // ── Thêm document vào state (dùng nội bộ sau khi upload) ────────────────
  const addDocument = useCallback((doc: Document) => {
    setDocuments(prev => [doc, ...prev])
  }, [])

  // ── Cập nhật document cục bộ (dùng cho edit metadata, progress, v.v.) ──
  const updateDocument = useCallback((id: string, updates: Partial<Document>) => {
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, ...updates } : d)))
  }, [])

  // ── Upload tài liệu thật lên backend (BR-013 đến BR-018) ────────────────
  const uploadDocument = useCallback(
    async (
      file: File,
      subject: string,
      visibility: "private" | "public" = "private",
    ): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }

      // Optimistic: thêm placeholder với status "uploading"
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
        status: "uploading",
        uploadProgress: 0,
        tags: [],
        downloadCount: 0,
        isPublic: visibility === "public",
        shareStatus: "none",
      }
      setDocuments(prev => [tempDoc, ...prev])

      try {
        const realDoc = await uploadDocumentApi(file, subject, undefined, visibility, progress => {
          setDocuments(prev =>
            prev.map(d => d.id === tempId ? { ...d, uploadProgress: progress } : d),
          )
        })

        // Thay placeholder bằng doc thật (bắt đầu scanning)
        setDocuments(prev =>
          prev.map(d => d.id === tempId ? { ...realDoc, status: "scanning" } : d),
        )

        // Poll backend cho đến khi status chuyển sang ready / failed (BR-016)
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
                prev.map(d => d.id === realDoc.id ? updated : d),
              )
            }
          } catch {
            clearInterval(poll)
          }
        }, 2500)

        return { success: true }
      } catch (error) {
        // Xoá placeholder khi thất bại
        setDocuments(prev => prev.filter(d => d.id !== tempId))
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể upload tài liệu.",
        }
      }
    },
    [currentUser],
  )

  // ── Soft-delete → chuyển vào Trash (BR-022) ─────────────────────────────
  const deleteDocument = useCallback((id: string) => {
    // Optimistic
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: "deleted" } : d))
    deleteDocumentApi(id).catch(() => {
      // Revert nếu API lỗi
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: "ready" } : d))
    })
  }, [])

  // ── Khôi phục từ Trash (BR-023) ─────────────────────────────────────────
  const restoreDocument = useCallback((id: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: "ready" } : d))
    restoreDocumentApi(id)
      .then(updated => {
        setDocuments(prev => prev.map(d => d.id === id ? updated : d))
      })
      .catch(() => {
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: "deleted" } : d))
      })
  }, [])

  // ── Đổi visibility public/private (BR-018, BR-019) ──────────────────────
  const changeDocumentVisibility = useCallback(
    (id: string, isPublic: boolean) => {
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, isPublic } : d))
      updateDocumentVisibilityApi(id, isPublic ? "public" : "private")
        .then(updated => {
          setDocuments(prev => prev.map(d => d.id === id ? updated : d))
        })
        .catch(() => {
          setDocuments(prev => prev.map(d => d.id === id ? { ...d, isPublic: !isPublic } : d))
        })
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

  // ── Categories (local-only; không có API endpoint) ───────────────────────
  const addCategory = useCallback((name: string, color: string) => {
    const cat: Category = { id: `cat-${Date.now()}`, name, color }
    setCategories(prev => [...prev, cat])
  }, [])

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id))
  }, [])

  return {
    documents,
    /** Exposed so admin actions (e.g. deleteUserAccount) can soft-delete user docs */
    setDocuments,
    categories,
    addDocument,
    updateDocument,
    uploadDocument,
    deleteDocument,
    restoreDocument,
    changeDocumentVisibility,
    downloadDocument,
    addCategory,
    deleteCategory,
  }
}
