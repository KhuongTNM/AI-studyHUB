"use client"

import { useState, useEffect, useRef } from "react"
import { BookOpen, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  language: "vi" | "en"
  onConfirm: (name: string) => void
  onClose: () => void
}

const t = {
  vi: {
    titleCreate: "Tạo môn học mới",
    placeholder: "Tên môn học (ví dụ: Toán học, Lịch sử)",
    create: "Tạo",
    cancel: "Hủy",
  },
  en: {
    titleCreate: "New subject",
    placeholder: "Subject name (e.g. Mathematics, History)",
    create: "Create",
    cancel: "Cancel",
  },
} as const

export function CreateSubjectModal({ language, onConfirm, onClose }: Props) {
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const text = t[language]

  useEffect(() => {
    // Focus the input so the user can type immediately
    setTimeout(() => {
      inputRef.current?.focus()
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">{text.titleCreate}</h3>
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
            {text.create}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {text.cancel}
          </Button>
        </div>
      </div>
    </div>
  )
}
