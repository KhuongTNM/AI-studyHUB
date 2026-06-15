"use client"

import { useState, useEffect, useRef } from "react"
import { FolderPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  language: "vi" | "en"
  /** If provided, pre-populates for rename mode */
  initialName?: string
  onConfirm: (name: string) => void
  onClose: () => void
}

const t = {
  vi: {
    titleCreate: "Tạo thư mục mới",
    titleRename: "Đổi tên thư mục",
    placeholder: "Tên thư mục",
    create: "Tạo",
    rename: "Đổi tên",
    cancel: "Hủy",
  },
  en: {
    titleCreate: "New folder",
    titleRename: "Rename folder",
    placeholder: "Folder name",
    create: "Create",
    rename: "Rename",
    cancel: "Cancel",
  },
} as const

export function CreateFolderModal({ language, initialName = "", onConfirm, onClose }: Props) {
  const [name, setName] = useState(initialName || (language === "vi" ? "Thư mục mới" : "New folder"))
  const inputRef = useRef<HTMLInputElement>(null)
  const text = t[language]
  const isRename = Boolean(initialName)

  useEffect(() => {
    // Auto-select the text so the user can type immediately
    setTimeout(() => {
      inputRef.current?.select()
    }, 50)
  }, [])

  const handleConfirm = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <FolderPlus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="font-semibold text-foreground">{isRename ? text.titleRename : text.titleCreate}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Input */}
        <div className="px-5 py-4">
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleConfirm()
              if (e.key === "Escape") onClose()
            }}
            placeholder={text.placeholder}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
          />
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button
            className="flex-1 gap-2"
            onClick={handleConfirm}
            disabled={!name.trim()}
          >
            {isRename ? text.rename : text.create}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {text.cancel}
          </Button>
        </div>
      </div>
    </div>
  )
}
