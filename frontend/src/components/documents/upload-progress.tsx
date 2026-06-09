"use client"

import { FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Document } from "@/lib/store"

export function UploadProgress({ doc }: { doc: Document }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium text-foreground">{doc.name}</span>
        {doc.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {doc.status === "scanning" && <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />}
        {doc.status === "ready" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
        {doc.status === "failed" && <AlertCircle className="h-4 w-4 text-destructive" />}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            doc.status === "failed" ? "bg-destructive" :
            doc.status === "ready" ? "bg-green-500" :
            doc.status === "scanning" ? "bg-yellow-500" : "bg-primary"
          )}
          style={{ width: `${doc.uploadProgress ?? 0}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {doc.status === "uploading" && `Đang tải lên... ${doc.uploadProgress ?? 0}%`}
        {doc.status === "scanning" && "Đang quét file an toàn..."}
        {doc.status === "ready" && "Hoàn thành!"}
        {doc.status === "failed" && "Upload thất bại. Thử lại?"}
      </p>
    </div>
  )
}
