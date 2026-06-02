"use client"

import { Trash2, RefreshCw, AlertTriangle, FileText, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"

export function TrashPage() {
  const { documents, restoreDocument, updateDocument, currentUser, openAuthModal } = useApp()

  const trashedDocs = documents.filter(d => d.status === "deleted")

  if (!currentUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Trash2 className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">Đăng nhập để xem thùng rác</p>
        <Button onClick={() => openAuthModal("login")}>Đăng nhập</Button>
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
            <h1 className="text-xl font-bold text-foreground">Thùng rác</h1>
            <p className="text-sm text-muted-foreground">{trashedDocs.length} tài liệu đã xóa</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {trashedDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trash2 className="mb-4 h-14 w-14 text-muted-foreground" />
            <h3 className="mb-2 font-semibold text-foreground">Thùng rác trống</h3>
            <p className="text-sm text-muted-foreground">Không có tài liệu nào trong thùng rác</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Tài liệu trong thùng rác sẽ bị xóa vĩnh viễn sau 30 ngày (BR-36).
              Admin có thể khôi phục tài liệu (BR-37).
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
                    <p className="text-xs text-muted-foreground">{doc.size} • Đã xóa</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => restoreDocument(doc.id)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Khôi phục
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={() => handlePermanentDelete(doc.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Xóa vĩnh viễn
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
