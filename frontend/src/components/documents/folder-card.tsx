"use client"

import { Folder as FolderIcon, MoreVertical, Pencil, Trash2, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Folder } from "@/lib/store"

interface Props {
  folder: Folder
  viewMode: "grid" | "list"
  docCount: number
  language: "vi" | "en"
  onOpen: (folder: Folder) => void
  onRename: (folder: Folder) => void
  onDelete: (folder: Folder) => void
  onContextMenu: (e: React.MouseEvent, folder: Folder) => void
}

const t = {
  vi: { items: "mục", open: "Mở", rename: "Đổi tên", delete: "Xóa" },
  en: { items: "items", open: "Open", rename: "Rename", delete: "Delete" },
} as const

export function FolderCard({ folder, viewMode, docCount, language, onOpen, onRename, onDelete, onContextMenu }: Props) {
  const text = t[language]

  if (viewMode === "list") {
    return (
      <div
        onContextMenu={e => onContextMenu(e, folder)}
        onDoubleClick={() => onOpen(folder)}
        className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-all hover:border-amber-300/60 hover:bg-amber-50/40 hover:shadow-sm dark:hover:bg-amber-900/10"
      >
        <FolderIcon className="h-8 w-8 shrink-0 text-amber-400 fill-amber-300/60" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{folder.name}</p>
          <p className="text-xs text-muted-foreground">{docCount} {text.items}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={e => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpen(folder)}>
              <FolderIcon className="mr-2 h-4 w-4" />{text.open}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(folder)}>
              <Pencil className="mr-2 h-4 w-4" />{text.rename}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(folder)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />{text.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div
      onContextMenu={e => onContextMenu(e, folder)}
      onDoubleClick={() => onOpen(folder)}
      className="group relative cursor-pointer rounded-xl border border-border bg-card p-4 transition-all hover:border-amber-300/60 hover:bg-amber-50/40 hover:shadow-md dark:hover:bg-amber-900/10"
    >
      {/* Folder icon area */}
      <div className="mb-3 flex items-center justify-between">
        <div className="relative">
          {/* Folder tab shape */}
          <div className="absolute -top-1.5 left-1 h-2 w-10 rounded-t-md bg-amber-300/80 dark:bg-amber-600/50" />
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/30 shadow-inner">
            <FolderIcon className="h-7 w-7 text-amber-500 fill-amber-300/60 dark:fill-amber-700/40" />
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpen(folder)}>
              <FolderIcon className="mr-2 h-4 w-4" />{text.open}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(folder)}>
              <Pencil className="mr-2 h-4 w-4" />{text.rename}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(folder)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />{text.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="truncate text-sm font-semibold text-foreground">{folder.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{docCount} {text.items}</p>

      {/* Hover overlay hint */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
        "bg-amber-400/5",
      )}>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          {language === "vi" ? "Double-click để mở" : "Double-click to open"}
        </span>
      </div>
    </div>
  )
}
