"use client"

import { useState, useRef } from "react"
import { Upload, FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"

export function UploadModal({
  initialSubject = "",
  hideSubject = false,
  onClose,
  onUpload,
}: {
  initialSubject?: string
  hideSubject?: boolean
  onClose: () => void
  onUpload: (files: File[], subject: string, tags?: string) => void
}) {
  const [subject, setSubject] = useState(initialSubject)
  const [tags, setTags] = useState("")
  const [dragging, setDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { language } = useApp()
  const text = uploadText[language]

  const validTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]

  const maxFileSize = 50 * 1024 * 1024 // 50MB
  const maxFilesCount = 5

  const handleFiles = (files: File[]) => {
    setError(null)
    const valid: File[] = []
    let hasOversized = false
    let hasInvalidType = false

    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase()
      const isValidExt = ext && ["pdf", "docx", "pptx"].includes(ext)
      const isValidType = validTypes.includes(f.type) || isValidExt

      if (!isValidType) {
        hasInvalidType = true
        continue
      }

      if (f.size > maxFileSize) {
        hasOversized = true
        continue
      }

      valid.push(f)
    }

    if (hasInvalidType) {
      setError(language === "vi" 
        ? "Chỉ hỗ trợ file PDF, DOCX, PPTX." 
        : "Only PDF, DOCX, and PPTX files are supported."
      )
    } else if (hasOversized) {
      setError(language === "vi" 
        ? "Có file vượt quá dung lượng tối đa cho phép (50MB)." 
        : "Some files exceed the maximum allowed size (50MB)."
      )
    }

    setSelectedFiles(prev => {
      const combined = [...prev, ...valid]
      if (combined.length > maxFilesCount) {
        setError(language === "vi" 
          ? `Chỉ được upload tối đa ${maxFilesCount} file cùng lúc.` 
          : `You can only upload up to ${maxFilesCount} files at a time.`
        )
        return combined.slice(0, maxFilesCount)
      }
      return combined
    })
  }

  const handleUpload = () => {
    if (!selectedFiles.length || (!hideSubject && !subject.trim())) return
    onUpload(selectedFiles, subject.trim(), tags.trim() || undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold text-foreground">{text.title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 p-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span className="flex-1 font-medium">{error}</span>
              <button onClick={() => setError(null)} className="text-destructive hover:opacity-80">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Subject name */}
          {!hideSubject && (
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
          )}

          {/* Tags — BR-020 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {text.tags}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{text.tagsHint}</span>
            </label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder={text.tagsPlaceholder}
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
            <p className="mt-1 text-xs text-amber-500 font-medium">
              {language === "vi" 
                ? "Tối đa 5 file, mỗi file không quá 50MB" 
                : "Max 5 files, up to 50MB per file"}
            </p>
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
            disabled={!selectedFiles.length || (!hideSubject && !subject.trim())}
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
    tags: "Tags",
    tagsHint: "(không bắt buộc)",
    tagsPlaceholder: "toán học, đại số, vi tích phân...",
    dropOrClick: "Kéo thả hoặc click để chọn file",
    upload: "Upload",
    cancel: "Hủy",
  },
  en: {
    title: "Upload document",
    subject: "Subject",
    subjectPlaceholder: "Enter subject name",
    tags: "Tags",
    tagsHint: "(optional)",
    tagsPlaceholder: "math, algebra, calculus...",
    dropOrClick: "Drag and drop or click to choose files",
    upload: "Upload",
    cancel: "Cancel",
  },
} as const
