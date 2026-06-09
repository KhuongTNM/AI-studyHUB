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
  const { categories } = useApp()
  const category = categories.find(c => c.id === doc.categoryId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold text-foreground">Chi tiết tài liệu</h3>
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
                Preview không khả dụng trong prototype
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
                <p className="text-xs text-muted-foreground">Loại file</p>
                <p className="font-medium text-foreground">{doc.type.toUpperCase()}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Kích thước</p>
                <p className="font-medium text-foreground">{doc.size}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Ngày upload</p>
                <p className="font-medium text-foreground">
                  {doc.uploadedAt.toLocaleDateString("vi-VN")}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Lượt tải</p>
                <p className="font-medium text-foreground">{doc.downloadCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Môn học:</span>
              <span className="rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary">
                {doc.subject || category?.name || "Chưa đặt"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-border p-4">
          <Button className="flex-1 gap-2" onClick={() => onDownload(doc.id)}>
            <Download className="h-4 w-4" />
            Tải xuống
          </Button>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  )
}
