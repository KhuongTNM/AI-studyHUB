"use client"

import { X, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, Document } from "@/lib/store"

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold text-foreground">{text.title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6">
          <div className="mb-4 flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
            <div className="text-center">
              <div
                className={cn(
                  "mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold",
                  doc.type === "pdf"
                    ? "bg-red-100 text-red-600"
                    : doc.type === "docx"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-orange-100 text-orange-600"
                )}
              >
                {doc.type.toUpperCase()}
              </div>
              <p className="text-xs text-muted-foreground">
                {text.previewUnavailable}
              </p>
            </div>
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
        <div className="flex gap-2 border-t border-border p-4">
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
    previewUnavailable: "Preview không khả dụng trong prototype",
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
    previewUnavailable: "Preview is not available in this prototype",
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
