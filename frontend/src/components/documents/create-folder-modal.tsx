"use client"

import { useState, useEffect, useRef } from "react"
import { FolderPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  language: "vi" | "en"
  /** Pre-fills name; khi có → chế độ Rename */
  initialName?: string
  /** Pre-fills subject (BR-082) */
  initialSubject?: string
  onConfirm: (name: string, subject?: string) => void
  onClose: () => void
}

const t = {
  vi: {
    titleCreate: "Tạo thư mục mới",
    titleRename: "Đổi tên thư mục",
    namePlaceholder: "Tên thư mục",
    subjectLabel: "Môn học",
    subjectPlaceholder: "Nhập môn học (tùy chọn)",
    create: "Tạo",
    rename: "Lưu",
    cancel: "Hủy",
  },
  en: {
    titleCreate: "New folder",
    titleRename: "Rename folder",
    namePlaceholder: "Folder name",
    subjectLabel: "Subject",
    subjectPlaceholder: "Enter subject (optional)",
    create: "Create",
    rename: "Save",
    cancel: "Cancel",
  },
} as const

export function CreateFolderModal({
  language,
  initialName = "",
  initialSubject = "",
  onConfirm,
  onClose,
}: Props) {
  const [name, setName] = useState(
    initialName || (language === "vi" ? "Thư mục mới" : "New folder"),
  )
  const [subject, setSubject] = useState(initialSubject)
  const inputRef = useRef<HTMLInputElement>(null)
  const text = t[language]
  const isRename = Boolean(initialName)

  useEffect(() => {
    setTimeout(() => inputRef.current?.select(), 50)
  }, [])

  const handleConfirm = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    onConfirm(trimmedName, subject.trim() || undefined)
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
          <h3 className="font-semibold text-foreground">
            {isRename ? text.titleRename : text.titleCreate}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Inputs */}
        <div className="space-y-3 px-5 py-4">
          {/* Tên thư mục */}
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleConfirm()
              if (e.key === "Escape") onClose()
            }}
            placeholder={text.namePlaceholder}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
          />

          {/* Môn học (BR-082) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {text.subjectLabel}
            </label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleConfirm()
                if (e.key === "Escape") onClose()
              }}
              placeholder={text.subjectPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button
            className="flex-1"
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
