"use client"

import { useState, useRef } from "react"
import { Upload, FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"

export function UploadModal({
  onClose,
  onUpload,
}: {
  onClose: () => void
  onUpload: (files: File[], subject: string) => void
}) {
  const [subject, setSubject] = useState("")
  const [dragging, setDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const { language } = useApp()
  const text = uploadText[language]

  const validTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]

  const handleFiles = (files: File[]) => {
    const valid = files.filter(f => validTypes.includes(f.type))
    setSelectedFiles(prev => [...prev, ...valid])
  }

  const handleUpload = () => {
    if (!selectedFiles.length || !subject.trim()) return
    onUpload(selectedFiles, subject.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold text-foreground">{text.title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 p-4">
          {/* Subject name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {text.subject} <span className="text-destructive">*</span>
            </label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={text.subjectPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setDragging(false)
              handleFiles(Array.from(e.dataTransfer.files))
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all",
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            )}
          >
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {text.dropOrClick}
            </p>
            <p className="text-xs text-muted-foreground">PDF, DOCX, PPTX</p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.pptx"
              multiple
              onChange={e => handleFiles(Array.from(e.target.files || []))}
            />
          </div>

          {/* File list */}
          {selectedFiles.length > 0 && (
            <div className="space-y-1.5">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-xs text-foreground">{f.name}</span>
                  <button
                    onClick={() =>
                      setSelectedFiles(prev => prev.filter((_, j) => j !== i))
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-border p-4">
          <Button
            className="flex-1 gap-2"
            onClick={handleUpload}
            disabled={!selectedFiles.length || !subject.trim()}
          >
            <Upload className="h-4 w-4" />
            {text.upload} {selectedFiles.length > 0 ? `(${selectedFiles.length} file)` : ""}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {text.cancel}
          </Button>
        </div>
      </div>
    </div>
  )
}

const uploadText = {
  vi: {
    title: "Upload tài liệu",
    subject: "Môn học",
    subjectPlaceholder: "Nhập tên môn học",
    dropOrClick: "Kéo thả hoặc click để chọn file",
    upload: "Upload",
    cancel: "Hủy",
  },
  en: {
    title: "Upload document",
    subject: "Subject",
    subjectPlaceholder: "Enter subject name",
    dropOrClick: "Drag and drop or click to choose files",
    upload: "Upload",
    cancel: "Cancel",
  },
} as const
