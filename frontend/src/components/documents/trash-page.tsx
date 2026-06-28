"use client"

import { useEffect, useState, useCallback } from "react"
import { Trash2, RefreshCw, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"
import {
  fetchTrashDocumentsApi,
  permanentDeleteDocumentApi,
  emptyTrashApi,
} from "@/services/api/documents"

export function TrashPage() {
  const { currentUser, openAuthModal, language, restoreDocument } = useApp()
  const text = trashText[language]

  const [trashDocs, setTrashDocs] = useState<Document[]>([])
  const [fetching, setFetching] = useState(false)
  const [confirmId, setConfirmId] = useState<string | "all" | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Fetch trash documents từ API mỗi khi vào trang
  const loadTrash = useCallback(async () => {
    if (!currentUser) return
    setFetching(true)
    try {
      const docs = await fetchTrashDocumentsApi()
      setTrashDocs(docs)
    } catch {
      // giữ nguyên nếu lỗi mạng
    } finally {
      setFetching(false)
    }
  }, [currentUser?.id])

  useEffect(() => {
    loadTrash()
  }, [loadTrash])

  if (!currentUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Trash2 className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">{text.loginToView}</p>
        <Button onClick={() => openAuthModal("login")}>{text.login}</Button>
      </div>
    )
  }

  const handleRestore = (id: string) => {
    // Xóa khỏi local trash state ngay lập tức
    setTrashDocs(prev => prev.filter(d => d.id !== id))
    // Gọi global restoreDocument → ADD doc vào global documents state (không cần refresh trang)
    restoreDocument(id)
  }

  const handleConfirmDelete = async () => {
    if (!confirmId) return
    setLoading(true)
    setErrorMsg(null)
    try {
      if (confirmId === "all") {
        await emptyTrashApi()
        setTrashDocs([])
      } else {
        await permanentDeleteDocumentApi(confirmId)
        setTrashDocs(prev => prev.filter(d => d.id !== confirmId))
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : text.genericError)
      loadTrash()
    } finally {
      setLoading(false)
      setConfirmId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{text.title}</h1>
            <p className="text-sm text-muted-foreground">
              {trashDocs.length} {text.deletedDocuments}
            </p>
          </div>
          {trashDocs.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => { setConfirmId("all"); setErrorMsg(null) }}
            >
              <Trash2 className="h-4 w-4" />
              {text.emptyTrash}
            </Button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Confirm dialog overlay */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl">
            <h2 className="mb-2 text-base font-semibold text-foreground">
              {confirmId === "all" ? text.confirmEmptyTitle : text.confirmDeleteTitle}
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              {confirmId === "all" ? text.confirmEmptyBody : text.confirmDeleteBody}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => { setConfirmId(null); setErrorMsg(null) }}
              >
                {text.cancel}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={loading}
                onClick={handleConfirmDelete}
              >
                {loading
                  ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />{text.deleting}</>
                  : text.confirmBtn
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {fetching ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mb-3 h-8 w-8 animate-spin" />
            <p className="text-sm">{text.loading}</p>
          </div>
        ) : trashDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trash2 className="mb-4 h-14 w-14 text-muted-foreground" />
            <h3 className="mb-2 font-semibold text-foreground">{text.emptyTitle}</h3>
            <p className="text-sm text-muted-foreground">{text.emptyBody}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {text.retentionWarning}
            </div>
            <div className="space-y-2">
              {trashDocs.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 opacity-70"
                >
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    doc.type === "pdf"   ? "bg-red-100 text-red-600"
                    : doc.type === "docx" ? "bg-blue-100 text-blue-600"
                    : "bg-orange-100 text-orange-600"
                  )}>
                    {doc.type.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground line-through">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.size} • {text.deleted}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => handleRestore(doc.id)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      {text.restore}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={() => { setConfirmId(doc.id); setErrorMsg(null) }}
                    >
                      <Trash2 className="h-3 w-3" />
                      {text.deleteForever}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const trashText = {
  vi: {
    loginToView: "Đăng nhập để xem thùng rác",
    login: "Đăng nhập",
    title: "Thùng rác",
    deletedDocuments: "tài liệu đã xóa",
    emptyTrash: "Dọn sạch thùng rác",
    loading: "Đang tải...",
    emptyTitle: "Thùng rác trống",
    emptyBody: "Không có tài liệu nào trong thùng rác",
    retentionWarning:
      "Tài liệu trong thùng rác sẽ bị xóa vĩnh viễn sau 30 ngày (BR-36). Admin có thể khôi phục tài liệu (BR-37).",
    deleted: "Đã xóa",
    restore: "Khôi phục",
    deleteForever: "Xóa vĩnh viễn",
    confirmDeleteTitle: "Xóa vĩnh viễn tài liệu?",
    confirmDeleteBody: "Hành động này không thể hoàn tác. File sẽ bị xóa hoàn toàn khỏi hệ thống.",
    confirmEmptyTitle: "Dọn sạch toàn bộ thùng rác?",
    confirmEmptyBody: "Tất cả tài liệu trong thùng rác sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.",
    confirmBtn: "Xóa vĩnh viễn",
    cancel: "Hủy",
    deleting: "Đang xóa…",
    genericError: "Đã xảy ra lỗi. Vui lòng thử lại.",
  },
  en: {
    loginToView: "Log in to view trash",
    login: "Log in",
    title: "Trash",
    deletedDocuments: "deleted documents",
    emptyTrash: "Empty trash",
    loading: "Loading...",
    emptyTitle: "Trash is empty",
    emptyBody: "There are no documents in trash",
    retentionWarning:
      "Documents in trash are permanently deleted after 30 days (BR-36). Admins can restore documents (BR-37).",
    deleted: "Deleted",
    restore: "Restore",
    deleteForever: "Delete forever",
    confirmDeleteTitle: "Permanently delete this document?",
    confirmDeleteBody: "This action cannot be undone. The file will be completely removed from the system.",
    confirmEmptyTitle: "Empty entire trash?",
    confirmEmptyBody: "All documents in trash will be permanently deleted. This action cannot be undone.",
    confirmBtn: "Delete forever",
    cancel: "Cancel",
    deleting: "Deleting…",
    genericError: "An error occurred. Please try again.",
  },
} as const
