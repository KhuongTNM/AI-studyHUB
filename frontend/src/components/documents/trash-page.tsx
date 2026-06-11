"use client"

import { Trash2, RefreshCw, AlertTriangle, FileText, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"

export function TrashPage() {
  const { documents, restoreDocument, updateDocument, currentUser, openAuthModal, language } = useApp()
  const text = trashText[language]

  const trashedDocs = documents.filter(d => d.status === "deleted")

  if (!currentUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Trash2 className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">{text.loginToView}</p>
        <Button onClick={() => openAuthModal("login")}>{text.login}</Button>
      </div>
    )
  }

  const handlePermanentDelete = (id: string) => {
    // In real system this would permanently remove; in prototype just filter out
    updateDocument(id, { status: "failed" as any })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{text.title}</h1>
            <p className="text-sm text-muted-foreground">{trashedDocs.length} {text.deletedDocuments}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {trashedDocs.length === 0 ? (
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
              {trashedDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 opacity-70">
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    doc.type === "pdf" ? "bg-red-100 text-red-600" :
                    doc.type === "docx" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
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
                      onClick={() => restoreDocument(doc.id)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      {text.restore}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={() => handlePermanentDelete(doc.id)}
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
    emptyTitle: "Thùng rác trống",
    emptyBody: "Không có tài liệu nào trong thùng rác",
    retentionWarning: "Tài liệu trong thùng rác sẽ bị xóa vĩnh viễn sau 30 ngày (BR-36). Admin có thể khôi phục tài liệu (BR-37).",
    deleted: "Đã xóa",
    restore: "Khôi phục",
    deleteForever: "Xóa vĩnh viễn",
  },
  en: {
    loginToView: "Log in to view trash",
    login: "Log in",
    title: "Trash",
    deletedDocuments: "deleted documents",
    emptyTitle: "Trash is empty",
    emptyBody: "There are no documents in trash",
    retentionWarning: "Documents in trash are permanently deleted after 30 days (BR-36). Admins can restore documents (BR-37).",
    deleted: "Deleted",
    restore: "Restore",
    deleteForever: "Delete forever",
  },
} as const
