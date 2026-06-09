"use client"

import {
  Download,
  MoreVertical,
  Trash2,
  Eye,
  Edit3,
  BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useApp, Document } from "@/lib/store"

export const fileTypeColors: Record<string, string> = {
  pdf: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  docx: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  pptx: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
}

export function DocumentCard({
  doc,
  viewMode,
  onPreview,
  onEdit,
  onDelete,
  onDownload,
  onChat,
  onGenerateFlashcards,
  categories,
}: {
  doc: Document
  viewMode: "grid" | "list"
  onPreview: (doc: Document) => void
  onEdit: (doc: Document) => void
  onDelete: (id: string) => void
  onDownload: (id: string) => void
  onChat: (doc: Document) => void
  onGenerateFlashcards: (doc: Document) => void
  categories: ReturnType<typeof useApp>["categories"]
}) {
  const category = categories.find(c => c.id === doc.categoryId)
  const subject = doc.subject || category?.name || "Chưa đặt"

  if (viewMode === "list") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
            fileTypeColors[doc.type]
          )}
        >
          {doc.type.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>{doc.size}</span>
            <span>•</span>
            <span>{doc.uploadedAt.toLocaleDateString("vi-VN")}</span>
            <span>•</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {subject}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChat(doc)}
            title="Chat AI"
          >
            <span className="text-xs">💬</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onGenerateFlashcards(doc)}
            title="Tạo flashcard từ tài liệu"
          >
            <BookOpen className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDownload(doc.id)}
            title="Tải xuống"
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(doc.id)}
            title="Xóa"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPreview(doc)}>
                <Eye className="mr-2 h-4 w-4" />
                Xem chi tiết
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(doc)}>
                <Edit3 className="mr-2 h-4 w-4" />
                Chỉnh sửa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  return (
    <div className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md flex flex-col">
      <div className="mb-3 flex items-start justify-between">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold",
            fileTypeColors[doc.type]
          )}
        >
          {doc.type.toUpperCase()}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPreview(doc)}>
              <Eye className="mr-2 h-4 w-4" />
              Xem chi tiết
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(doc)}>
              <Edit3 className="mr-2 h-4 w-4" />
              Chỉnh sửa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(doc.id)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mb-1 truncate text-sm font-semibold text-foreground">{doc.name}</p>
      {doc.description && (
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{doc.description}</p>
      )}
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{doc.size}</span>
        <span>•</span>
        <span>{doc.uploadedAt.toLocaleDateString("vi-VN")}</span>
      </div>
      <span className="mb-3 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        {subject}
      </span>
      <div className="mt-auto flex gap-2">
        <Button
          size="sm"
          className="flex-1 gap-1 text-xs"
          onClick={() => onChat(doc)}
        >
          💬 Chat AI
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={() => onGenerateFlashcards(doc)}
        >
          <BookOpen className="h-3 w-3" />
          Flashcards
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={() => onDownload(doc.id)}
          title="Tải xuống"
        >
          <Download className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs text-destructive hover:text-destructive"
          onClick={() => onDelete(doc.id)}
          title="Xóa"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
