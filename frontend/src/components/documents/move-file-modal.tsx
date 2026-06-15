"use client"

import { useState } from "react"
import { Move, Folder as FolderIcon, Home, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Document, Folder } from "@/lib/store"

interface Props {
  doc: Document
  folders: Folder[]
  currentFolderId: string | null
  language: "vi" | "en"
  onMove: (folderId: string | null) => void
  onClose: () => void
}

const t = {
  vi: {
    title: "Di chuyển tài liệu",
    moveTo: "Di chuyển đến",
    root: "Tài liệu của tôi (Gốc)",
    move: "Di chuyển",
    cancel: "Hủy",
    current: "Vị trí hiện tại",
  },
  en: {
    title: "Move document",
    moveTo: "Move to",
    root: "My Documents (Root)",
    move: "Move here",
    cancel: "Cancel",
    current: "Current location",
  },
} as const

export function MoveFileModal({ doc, folders, currentFolderId, language, onMove, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(doc.folderId ?? null)
  const text = t[language]

  const getFolderPathName = (folder: Folder): string => {
    const parts = [folder.name]
    let current = folder
    let depth = 0
    while (current.parentId && depth < 10) {
      const parent = folders.find(f => f.id === current.parentId)
      if (parent) {
        parts.unshift(parent.name)
        current = parent
        depth++
      } else {
        break
      }
    }
    return parts.join(" / ")
  }

  const sortedFolders = [...folders]
    .map(f => ({ ...f, displayName: getFolderPathName(f) }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  const handleMove = () => {
    onMove(selected)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Move className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">{text.title}</h3>
            <p className="truncate text-xs text-muted-foreground">{doc.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Folder list */}
        <div className="max-h-64 overflow-y-auto px-3 py-3 space-y-1">
          {/* Root option */}
          <button
            onClick={() => setSelected(null)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              selected === null
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-accent text-foreground",
            )}
          >
            <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
            {text.root}
            {doc.folderId === null && (
              <span className="ml-auto text-xs text-muted-foreground">{text.current}</span>
            )}
          </button>

          {/* Folder list */}
          {sortedFolders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setSelected(folder.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                selected === folder.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent text-foreground",
              )}
            >
              <FolderIcon className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="flex-1 truncate text-left">{folder.displayName}</span>
              {doc.folderId === folder.id && (
                <span className="text-xs text-muted-foreground">{text.current}</span>
              )}
            </button>
          ))}

          {folders.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {language === "vi" ? "Chưa có thư mục nào" : "No folders yet"}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button
            className="flex-1 gap-2"
            onClick={handleMove}
            disabled={selected === (doc.folderId ?? null)}
          >
            <Move className="h-4 w-4" />
            {text.move}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {text.cancel}
          </Button>
        </div>
      </div>
    </div>
  )
}
