"use client"

import { useState } from "react"
import {
  Cloud, HardDrive, Upload, FileText,
  AlertCircle, Zap, Download, Trash2,
  Eye, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, formatBytes } from "@/lib/store"

export function CloudStorage() {
  const {
    currentUser, documents, openAuthModal,
    deleteDocument, downloadDocument, language,
  } = useApp()

  const [reviewDocId, setReviewDocId] = useState<string | null>(null)
  const text = cloudText[language]

  if (!currentUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Cloud className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Cloud Storage</h2>
        <p className="text-muted-foreground">{text.loginToAccess}</p>
        <Button onClick={() => openAuthModal("login")}>{text.login}</Button>
      </div>
    )
  }

  const readyDocs = documents.filter(d => d.status === "ready")
  const storagePercent = Math.round((currentUser.storageUsed / currentUser.storageLimit) * 100)
  const totalDownloads = readyDocs.reduce((sum, d) => sum + d.downloadCount, 0)
  const reviewDoc = readyDocs.find(doc => doc.id === reviewDocId)

  /**
   * Tải file từ server và tăng downloadCount qua POST /api/documents/{id}/download (BR-021).
   * Trước đây chỉ cập nhật local state; giờ gọi API thật.
   */
  const handleDownload = (id: string) => {
    downloadDocument(id)
  }

  const stats = [
    { icon: FileText, label: text.documents, value: readyDocs.length, color: "text-primary" },
    { icon: HardDrive, label: text.used, value: formatBytes(currentUser.storageUsed), color: "text-blue-500" },
    { icon: Zap, label: text.downloads, value: totalDownloads, color: "text-yellow-500" },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Cloud Storage</h1>
            <p className="text-sm text-muted-foreground">{text.subtitle}</p>
          </div>

        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
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
            <span className="text-sm font-medium text-foreground">{text.storageUsage}</span>
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
            <span>{formatBytes(currentUser.storageUsed)} {text.usedLower}</span>
            <span>{formatBytes(currentUser.storageLimit)} {text.total}</span>
          </div>
          {/* BR-027: cảnh báo khi vượt 80% */}
          {storagePercent >= 80 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {text.storageWarning}
            </div>
          )}
        </div>

        {/* Document list */}
        {readyDocs.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              {text.syncedDocuments} ({readyDocs.length})
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
                      {doc.size} · {doc.downloadCount} {text.downloadsLower}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setReviewDocId(reviewDocId === doc.id ? null : doc.id)}
                      title={text.preview}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDownload(doc.id)}
                      title={text.download}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteDocument(doc.id)}
                      title={text.delete}
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
            <p className="font-medium text-foreground">{text.noDocuments}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text.uploadToSync}</p>
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
                <p>{text.previewDeveloping} {reviewDoc.type.toUpperCase()}.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 gap-1"
                  onClick={() => handleDownload(reviewDoc.id)}
                >
                  <Download className="h-3 w-3" /> {text.downloadToView}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const cloudText = {
  vi: {
    loginToAccess: "Đăng nhập để truy cập cloud storage",
    login: "Đăng nhập",
    documents: "Tài liệu",
    used: "Đã dùng",
    downloads: "Lượt tải",
    subtitle: "Tài liệu được lưu trữ trên cloud",
    storageUsage: "Dung lượng sử dụng",
    usedLower: "đã dùng",
    total: "tổng",
    storageWarning: "Bạn đã sử dụng hơn 80% dung lượng. Hãy xoá bớt hoặc nâng cấp gói.",
    syncedDocuments: "Tài liệu đã đồng bộ",
    downloadsLower: "lượt tải",
    preview: "Xem preview",
    download: "Tải xuống",
    delete: "Xoá",
    noDocuments: "Chưa có tài liệu nào",
    uploadToSync: "Upload tài liệu để bắt đầu đồng bộ",
    previewDeveloping: "Preview cho",
    downloadToView: "Tải xuống để xem",
  },
  en: {
    loginToAccess: "Log in to access cloud storage",
    login: "Log in",
    documents: "Documents",
    used: "Used",
    downloads: "Downloads",
    subtitle: "Documents stored in the cloud",
    storageUsage: "Storage usage",
    usedLower: "used",
    total: "total",
    storageWarning: "You have used more than 80% of your storage. Delete files or upgrade your plan.",
    syncedDocuments: "Synced documents",
    downloadsLower: "downloads",
    preview: "Preview",
    download: "Download",
    delete: "Delete",
    noDocuments: "No documents yet",
    uploadToSync: "Upload documents to get started",
    previewDeveloping: "Preview for",
    downloadToView: "Download to view",
  },
} as const
