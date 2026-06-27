"use client"

import { useEffect, useState } from "react"
import { X, Download, ExternalLink, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, Document } from "@/lib/store"
import { previewDocumentApi } from "@/services/api/documents"

export function DocumentPreviewModal({
  doc,
  onClose,
  onDownload,
}: {
  doc: Document
  onClose: () => void
  onDownload: (id: string) => void
}) {
  const { categories, language } = useApp()
  const category = categories.find(c => c.id === doc.categoryId)
  const text = previewText[language]
  const [previewUrl, setPreviewUrl] = useState("")
  const [contentType, setContentType] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [previewError, setPreviewError] = useState("")

  useEffect(() => {
    let objectUrl = ""
    let cancelled = false

    setLoadingPreview(true)
    setPreviewError("")
    setPreviewUrl("")
    setContentType("")

    previewDocumentApi(doc.id)
      .then(result => {
        if (cancelled) {
          URL.revokeObjectURL(result.url)
          return
        }
        objectUrl = result.url
        setPreviewUrl(result.url)
        setContentType(result.contentType)
      })
      .catch(error => {
        if (!cancelled) {
          setPreviewError(error instanceof Error ? error.message : text.previewFailed)
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [doc.id, text.previewFailed])

  const canEmbedPreview = contentType.includes("pdf") || doc.type === "pdf"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh]">
        <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold text-foreground">{text.title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 overflow-hidden rounded-xl border border-border bg-muted/30">
            {loadingPreview ? (
              <div className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {text.loadingPreview}
              </div>
            ) : previewError ? (
              <div className="flex h-72 flex-col items-center justify-center gap-3 p-6 text-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm font-medium text-foreground">{text.previewFailed}</p>
                <p className="text-xs text-muted-foreground">{previewError}</p>
              </div>
            ) : previewUrl && canEmbedPreview ? (
              <iframe
                title={doc.name}
                src={previewUrl}
                className="h-[40vh] min-h-[200px] w-full bg-background"
              />
            ) : previewUrl ? (
              <div className="flex h-72 flex-col items-center justify-center gap-3 p-6 text-center">
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold",
                    doc.type === "pdf"
                      ? "bg-red-100 text-red-600"
                      : doc.type === "docx"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-orange-100 text-orange-600"
                  )}
                >
                  {doc.type.toUpperCase()}
                </div>
                <p className="text-sm font-medium text-foreground">{text.previewReady}</p>
                <p className="max-w-sm text-xs text-muted-foreground">{text.openPreviewHint}</p>
                <Button variant="outline" className="gap-2" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}>
                  <ExternalLink className="h-4 w-4" />
                  {text.openPreview}
                </Button>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                {text.previewUnavailable}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-lg font-semibold text-foreground">{doc.name}</h4>
            </div>
            {doc.description && (
              <p className="text-sm text-muted-foreground">{doc.description}</p>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{text.fileType}</p>
                <p className="font-medium text-foreground">{doc.type.toUpperCase()}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{text.size}</p>
                <p className="font-medium text-foreground">{doc.size}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{text.uploadDate}</p>
                <p className="font-medium text-foreground">
                  {doc.uploadedAt.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{text.downloads}</p>
                <p className="font-medium text-foreground">{doc.downloadCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{text.subject}:</span>
              <span className="rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary">
                {doc.subject || category?.name || text.uncategorized}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-border p-4">
          {previewUrl && (
            <Button variant="outline" className="gap-2" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="h-4 w-4" />
              {text.openPreview}
            </Button>
          )}
          <Button className="flex-1 gap-2" onClick={() => onDownload(doc.id)}>
            <Download className="h-4 w-4" />
            {text.download}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {text.close}
          </Button>
        </div>
      </div>
    </div>
  )
}

const previewText = {
  vi: {
    title: "Chi tiết tài liệu",
    loadingPreview: "Đang tải bản xem trước...",
    previewFailed: "Không thể tải bản xem trước",
    previewReady: "Bản xem trước đã sẵn sàng",
    openPreviewHint: "Trình duyệt không thể hiển thị trực tiếp loại file này trong khung xem trước. Bạn có thể mở file inline ở tab mới trước khi tải xuống.",
    openPreview: "Mở preview",
    previewUnavailable: "Preview không khả dụng",
    fileType: "Loại file",
    size: "Kích thước",
    uploadDate: "Ngày upload",
    downloads: "Lượt tải",
    subject: "Môn học",
    uncategorized: "Chưa đặt",
    download: "Tải xuống",
    close: "Đóng",
  },
  en: {
    title: "Document details",
    loadingPreview: "Loading preview...",
    previewFailed: "Could not load preview",
    previewReady: "Preview is ready",
    openPreviewHint: "This file type cannot be rendered directly inside the preview frame. You can open the inline file in a new tab before downloading.",
    openPreview: "Open preview",
    previewUnavailable: "Preview is not available",
    fileType: "File type",
    size: "Size",
    uploadDate: "Upload date",
    downloads: "Downloads",
    subject: "Subject",
    uncategorized: "Uncategorized",
    download: "Download",
    close: "Close",
  },
} as const
