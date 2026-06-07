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
  const { currentUser, documents, openAuthModal, deleteDocument, updateDocument } = useApp()
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

  const handleDownload = (id: string) => {
    updateDocument(id, { downloadCount: (documents.find(d => d.id === id)?.downloadCount ?? 0) + 1 })
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
            id="sync-btn"
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className={cn("gap-2", syncDone && "border-green-500 text-green-600")}
          >
            {syncing ? (
              <><RefreshCw className="h-4 w-4 animate-spin" />Đang đồng bộ...</>
            ) : syncDone ? (
              <><CheckCircle2 className="h-4 w-4" />Đã đồng bộ!</>
            ) : (
              <><RefreshCw className="h-4 w-4" />Đồng bộ</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Storage Overview */}
        <div className="mb-6 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
              <Cloud className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Dung lượng Cloud</h3>
              <p className="text-sm text-muted-foreground">
                {formatBytes(currentUser.storageUsed)} / {formatBytes(currentUser.storageLimit)}
              </p>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/50">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                storagePercent > 80 ? "bg-destructive" : storagePercent > 60 ? "bg-yellow-500" : "bg-primary"
              )}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{storagePercent}% đã sử dụng</span>
            <span>{formatBytes(currentUser.storageLimit - currentUser.storageUsed)} còn trống</span>
          </div>
          {storagePercent > 80 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Dung lượng sắp đầy! Hãy xóa bớt tài liệu hoặc nâng cấp gói.
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(stat => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4 text-center">
              <stat.icon className={cn("mx-auto mb-2 h-6 w-6", stat.color)} />
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Security Info */}
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
          <h4 className="mb-2 flex items-center gap-2 font-semibold text-green-800 dark:text-green-400">
            <Shield className="h-4 w-4" />
            Bảo mật dữ liệu
          </h4>
          <ul className="space-y-1 text-sm text-green-700 dark:text-green-500">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" />Mã hóa AES-256 trong quá trình truyền tải (BR-50)</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" />Backup tự động mỗi 24 giờ (BR-51)</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" />Chỉ bạn mới truy cập được file của mình (BR-52)</li>
          </ul>
        </div>

        {/* File List */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Files trên Cloud ({readyDocs.length})</h3>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <Wifi className="h-3 w-3" />
              Đã đồng bộ
            </div>
          </div>
          <div className="space-y-2">
            {readyDocs.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                  doc.type === "pdf" ? "bg-red-100 text-red-600" :
                  doc.type === "docx" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                )}>
                  {doc.type.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.size} • {doc.uploadedAt.toLocaleDateString("vi-VN")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-green-600 mr-1">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    </div>
                    <span className="hidden sm:inline">Đã sync</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setReviewDocId(doc.id)}
                    title="Review file"
                  >
                    <Eye className="h-3 w-3" />
                    <span className="hidden sm:inline">Review</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => handleDownload(doc.id)}
                    title="Tải về"
                  >
                    <Download className="h-3 w-3" />
                    <span className="hidden sm:inline">Tải về</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:border-destructive/50"
                    onClick={() => deleteDocument(doc.id)}
                    title="Xóa"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span className="hidden sm:inline">Xóa</span>
                  </Button>
                </div>
              </div>
            ))}
            {readyDocs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium text-foreground">Chưa có file nào trên cloud</p>
                <p className="text-sm text-muted-foreground">Upload tài liệu để lưu trữ an toàn</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {reviewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Review file</h3>
              <Button variant="ghost" size="icon" onClick={() => setReviewDocId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
              <div className={cn(
                "mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl text-sm font-bold",
                reviewDoc.type === "pdf" ? "bg-red-100 text-red-600" :
                reviewDoc.type === "docx" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
              )}>
                {reviewDoc.type.toUpperCase()}
              </div>
              <p className="font-medium text-foreground">{reviewDoc.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{reviewDoc.size} • {reviewDoc.uploadedAt.toLocaleDateString("vi-VN")}</p>
              <p className="mt-3 text-sm text-muted-foreground">Bản prototype hiển thị thông tin file để review nhanh trước khi tải xuống.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
