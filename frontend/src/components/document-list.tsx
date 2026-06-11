"use client"

import { FileText, Download, Trash2, MoreVertical, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"

export interface Document {
  id: string
  name: string
  type: "pdf" | "docx" | "pptx"
  size: string
  uploadedAt: Date
  category?: string
}

interface DocumentListProps {
  documents: Document[]
  onSelect: (doc: Document) => void
  onDelete: (id: string) => void
  onDownload: (id: string) => void
  selectedId?: string
}

const fileTypeColors: Record<string, string> = {
  pdf: "bg-red-100 text-red-600",
  docx: "bg-blue-100 text-blue-600",
  pptx: "bg-orange-100 text-orange-600",
}

export function DocumentList({ documents, onSelect, onDelete, onDownload, selectedId }: DocumentListProps) {
  const { language } = useApp()
  const text = documentListText[language]
  const dateLocale = language === "vi" ? "vi-VN" : "en-US"

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold text-foreground">{text.emptyTitle}</h3>
        <p className="text-sm text-muted-foreground">
          {text.emptyBody}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          onClick={() => onSelect(doc)}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-sm",
            selectedId === doc.id && "border-primary bg-primary/5"
          )}
        >
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", fileTypeColors[doc.type])}>
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
            <p className="text-xs text-muted-foreground">
              {doc.type.toUpperCase()} • {doc.size} • {doc.uploadedAt.toLocaleDateString(dateLocale)}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(doc); }}>
                <Eye className="mr-2 h-4 w-4" />
                {text.view}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(doc.id); }}>
                <Download className="mr-2 h-4 w-4" />
                {text.download}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {text.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  )
}

const documentListText = {
  vi: {
    emptyTitle: "Chưa có tài liệu nào",
    emptyBody: "Tải lên tài liệu đầu tiên để bắt đầu",
    view: "Xem",
    download: "Tải xuống",
    delete: "Xóa",
  },
  en: {
    emptyTitle: "No documents yet",
    emptyBody: "Upload your first document to get started",
    view: "View",
    download: "Download",
    delete: "Delete",
  },
} as const
