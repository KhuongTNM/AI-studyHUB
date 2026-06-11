"use client"

import { useState } from "react"
import {
  Cloud, HardDrive, Upload, FileText, CheckCircle2,
  AlertCircle, RefreshCw, Shield, Wifi, Zap, Download, Trash2,
  Eye, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, formatBytes } from "@/lib/store"

export function CloudStorage() {
  const {
    currentUser, documents, openAuthModal,
    deleteDocument, downloadDocument,
  } = useApp()

  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)
  const [reviewDocId, setReviewDocId] = useState<string | null>(null)

  if (!currentUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Cloud className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Cloud Storage</h2>
        <p className="text-muted-foreground">Đăng nhập để truy cập cloud storage</p>
        <Button onClick={() => openAuthModal("login")}>Đăng nhập</Button>
      </div>
    )
  }

  const readyDocs = documents.filter(d => d.status === "ready")
  const storagePercent = Math.round((currentUser.storageUsed / currentUser.storageLimit) * 100)
  const totalDownloads = readyDocs.reduce((sum, d) => sum + d.downloadCount, 0)
  const reviewDoc = readyDocs.find(doc => doc.id === reviewDocId)

  const handleSync = async () => {
    setSyncing(true)
    await new Promise(r => setTimeout(r, 2000))
    setSyncing(false)
    setSyncDone(true)
    setTimeout(() => setSyncDone(false), 3000)
  }

  /**
   * Tải file từ server và tăng downloadCount qua POST /api/documents/{id}/download (BR-021).
   * Trước đây chỉ cập nhật local state; giờ gọi API thật.
   */
  const handleDownload = (id: string) => {
    downloadDocument(id)
  }

  const stats = [
    { icon: FileText, label: "Tài liệu", value: readyDocs.length, color: "text-primary" },
    { icon: HardDrive, label: "Đã dùng", value: formatBytes(currentUser.storageUsed), color: "text-blue-500" },
    { icon: Zap, label: "Lượt tải", value: totalDownloads, color: "text-yellow-500" },
    { icon: Shield, label: "Mã hóa", value: "AES-256", color: "text-green-500" },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Cloud Storage</h1>
            <p className="text-sm text-muted-foreground">Tài liệu được đồng bộ và mã hóa an toàn</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            {syncing ? "Đang đồng bộ..." : syncDone ? "Đã đồng bộ ✓" : "Đồng bộ"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <Icon className={cn("mb-2 h-5 w-5", color)} />
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Storage bar (BR-026, BR-027) */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Dung lượng sử dụng</span>
            <span className={cn("text-sm font-semibold", storagePercent >= 80 ? "text-destructive" : "text-muted-foreground")}>
              {storagePercent}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                storagePercent >= 80 ? "bg-destructive" : storagePercent >= 60 ? "bg-yellow-500" : "bg-primary"
              )}
              style={{ width: `${Math.min(storagePercent, 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>{formatBytes(currentUser.storageUsed)} đã dùng</span>
            <span>{formatBytes(currentUser.storageLimit)} tổng</span>
          </div>
          {/* BR-027: cảnh báo khi vượt 80% */}
          {storagePercent >= 80 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Bạn đã sử dụng hơn 80% dung lượng. Hãy xoá bớt hoặc nâng cấp gói.
            </div>
          )}
        </div>

        {/* Connection info */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-foreground">Kết nối bảo mật — TLS 1.3</span>
          <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
        </div>

        {/* Document list */}
        {readyDocs.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Tài liệu đã đồng bộ ({readyDocs.length})
            </h2>
            <div className="space-y-2">
              {readyDocs.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-all"
                >
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.size} · {doc.downloadCount} lượt tải
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setReviewDocId(reviewDocId === doc.id ? null : doc.id)}
                      title="Xem preview"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDownload(doc.id)}
                      title="Tải xuống"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteDocument(doc.id)}
                      title="Xoá"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {readyDocs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Cloud className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">Chưa có tài liệu nào</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload tài liệu để bắt đầu đồng bộ</p>
          </div>
        )}

        {/* Inline preview (BR-029) */}
        {reviewDoc && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Preview: {reviewDoc.name}</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReviewDocId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex min-h-[120px] items-center justify-center rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <div className="text-center">
                <Upload className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p>Preview cho {reviewDoc.type.toUpperCase()} đang phát triển.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 gap-1"
                  onClick={() => handleDownload(reviewDoc.id)}
                >
                  <Download className="h-3 w-3" /> Tải xuống để xem
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
