"use client"

import {
  Download,
  MoreVertical,
  Trash2,
  Eye,
  EyeOff,
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
  onToggleVisibility,
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
  onToggleVisibility: (id: string, isPublic: boolean) => void
  onChat: (doc: Document) => void
  onGenerateFlashcards: (doc: Document) => void
  categories: ReturnType<typeof useApp>["categories"]
}) {
  const { language } = useApp()
  const text = documentCardText[language]
  const category = categories.find(c => c.id === doc.categoryId)
  const subject = doc.subject || category?.name || text.uncategorized
  const dateLocale = language === "vi" ? "vi-VN" : "en-US"

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
            <span>{doc.uploadedAt.toLocaleDateString(dateLocale)}</span>
            <span>•</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {subject}
            </span>
            {doc.tags.length > 0 && doc.tags.map(tag => (
              <span key={tag} className="rounded-full bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
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
            title={text.createFlashcards}
          >
            <BookOpen className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onToggleVisibility(doc.id, !doc.isPublic)}
            title={doc.isPublic ? text.makePrivate : text.makePublic}
          >
            {doc.isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDownload(doc.id)}
            title={text.download}
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(doc.id)}
            title={text.delete}
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
                {text.viewDetails}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(doc)}>
                <Edit3 className="mr-2 h-4 w-4" />
                {text.edit}
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
              {text.viewDetails}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(doc)}>
              <Edit3 className="mr-2 h-4 w-4" />
              {text.edit}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onToggleVisibility(doc.id, !doc.isPublic)}>
              {doc.isPublic ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {doc.isPublic ? text.makePrivate : text.makePublic}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(doc.id)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              {text.delete}
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
        <span>{doc.uploadedAt.toLocaleDateString(dateLocale)}</span>
      </div>
      <span className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        {subject}
      </span>
      {doc.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {doc.tags.map(tag => (
            <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onToggleVisibility(doc.id, !doc.isPublic)}
        className={cn(
          "mb-3 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
          doc.isPublic
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-border bg-muted text-muted-foreground hover:bg-muted/80",
        )}
      >
        {doc.isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        {doc.isPublic ? text.publicStatus : text.privateStatus}
      </button>
      <div className="mt-auto grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem_2.25rem] gap-2">
        <Button
          size="sm"
          className="min-w-0 gap-1 px-2 text-xs"
          onClick={() => onChat(doc)}
        >
          <span className="shrink-0">💬</span>
          <span className="truncate">Chat AI</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-w-0 gap-1 px-2 text-xs"
          onClick={() => onGenerateFlashcards(doc)}
        >
          <BookOpen className="h-3 w-3 shrink-0" />
          <span className="truncate">Flashcards</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-9 px-0 text-xs"
          onClick={() => onDownload(doc.id)}
          title={text.download}
        >
          <Download className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-9 px-0 text-xs text-destructive hover:text-destructive"
          onClick={() => onDelete(doc.id)}
          title={text.delete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

const documentCardText = {
  vi: {
    uncategorized: "Chưa đặt",
    createFlashcards: "Tạo flashcard từ tài liệu",
    download: "Tải xuống",
    delete: "Xóa",
    viewDetails: "Xem chi tiết",
    edit: "Chỉnh sửa",
    publicStatus: "Public",
    privateStatus: "Private",
    makePublic: "Đặt Public",
    makePrivate: "Đặt Private",
  },
  en: {
    uncategorized: "Uncategorized",
    createFlashcards: "Create flashcards from document",
    download: "Download",
    delete: "Delete",
    viewDetails: "View details",
    edit: "Edit",
    publicStatus: "Public",
    privateStatus: "Private",
    makePublic: "Make Public",
    makePrivate: "Make Private",
  },
} as const
