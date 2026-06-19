"use client"

import { useState } from "react"
import { Move, Folder as FolderIcon, Home, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Folder } from "@/lib/store"

interface Props {
  /** Thư mục đang được di chuyển */
  folder: Folder
  /** Toàn bộ danh sách thư mục của user */
  allFolders: Folder[]
  language: "vi" | "en"
  onMove: (targetParentId: string | null) => void
  onClose: () => void
}

const t = {
  vi: {
    title: "Di chuyển thư mục",
    root: "Tài liệu của tôi (Gốc)",
    move: "Di chuyển đến đây",
    cancel: "Hủy",
    current: "Vị trí hiện tại",
    empty: "Không có thư mục nào khả dụng",
  },
  en: {
    title: "Move folder",
    root: "My Documents (Root)",
    move: "Move here",
    cancel: "Cancel",
    current: "Current location",
    empty: "No available destination folders",
  },
} as const

/**
 * Lấy toàn bộ ID con cháu của một thư mục (bao gồm chính nó).
 * Dùng để lọc các đích không hợp lệ — tuân thủ BR-087 phía UI.
 */
function getDescendantIds(folderId: string, allFolders: Folder[]): Set<string> {
  const result = new Set<string>([folderId])
  for (const f of allFolders) {
    if (f.parentId === folderId) {
      getDescendantIds(f.id, allFolders).forEach(id => result.add(id))
    }
  }
  return result
}

/** Xây đường dẫn đầy đủ "Cha / Con / Cháu" để hiển thị */
function getFolderPath(folder: Folder, allFolders: Folder[]): string {
  const parts = [folder.name]
  let current = folder
  let depth = 0
  while (current.parentId && depth < 20) {
    const parent = allFolders.find(f => f.id === current.parentId)
    if (!parent) break
    parts.unshift(parent.name)
    current = parent
    depth++
  }
  return parts.join(" / ")
}

export function MoveFolderModal({ folder, allFolders, language, onMove, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(folder.parentId)
  const text = t[language]

  // BR-087: tập các ID không được chọn (chính mình + con cháu)
  const forbidden = getDescendantIds(folder.id, allFolders)

  const available = allFolders
    .filter(f => !forbidden.has(f.id))
    .map(f => ({ ...f, displayName: getFolderPath(f, allFolders) }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, language === "vi" ? "vi" : "en"))

  const handleMove = () => {
    onMove(selected)
    onClose()
  }

  const isUnchanged = selected === folder.parentId

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
            <p className="truncate text-xs text-muted-foreground">{folder.name}</p>
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
            {folder.parentId === null && (
              <span className="ml-auto text-xs text-muted-foreground">{text.current}</span>
            )}
          </button>

          {available.map(f => (
            <button
              key={f.id}
              onClick={() => setSelected(f.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                selected === f.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent text-foreground",
              )}
            >
              <FolderIcon className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="flex-1 truncate text-left">{f.displayName}</span>
              {folder.parentId === f.id && (
                <span className="text-xs text-muted-foreground">{text.current}</span>
              )}
            </button>
          ))}

          {available.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{text.empty}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button className="flex-1 gap-2" onClick={handleMove} disabled={isUnchanged}>
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
