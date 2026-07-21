"use client"

import { useState, useRef } from "react"
import { Upload, FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  ACCEPTED_UPLOAD_INPUT_TYPES,
  ACCEPTED_UPLOAD_LABEL,
  ACCEPTED_UPLOAD_MIME_TYPES,
} from "@/configs/upload"
import { useUploadSettings } from "@/hooks/useUploadSettings"

export function UploadModal({
  initialSubject = "",
  hideSubject = false,
  onClose,
  onUpload,
}: {
  initialSubject?: string
  hideSubject?: boolean
  onClose: () => void
  /**
   * Trả về { success, error }. Nếu success=false (vd 409 trùng tên trong
   * cùng folder), modal PHẢI giữ nguyên — không clear file/form — để user
   * tự đổi tên/thư mục rồi bấm Upload lại ngay (mục 3, docx).
   */
  onUpload: (files: File[], subject: string, tags?: string) => Promise<{ success: boolean; error?: string } | void>
}) {
  const [subject, setSubject] = useState(initialSubject)
  const [tags, setTags] = useState("")
  const [dragging, setDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { language } = useApp()
  const text = uploadText[language]
  const { maxFileSizeBytes, maxFileSizeMb, maxFilesPerUpload } = useUploadSettings()

  const handleFiles = (files: File[]) => {
    setError(null)
    const valid: File[] = []
    let hasOversized = false
    let hasInvalidType = false

    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase()
      const isValidExt = ext ? (ACCEPTED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext) : false
      const isValidType = (ACCEPTED_UPLOAD_MIME_TYPES as readonly string[]).includes(f.type) || isValidExt

      if (!isValidType) {
        hasInvalidType = true
        continue
      }

      if (f.size > maxFileSizeBytes) {
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
        ? `Có file vượt quá dung lượng tối đa cho phép (${maxFileSizeMb}MB).`
        : `Some files exceed the maximum allowed size (${maxFileSizeMb}MB).`
      )
    }

    setSelectedFiles(prev => {
      const combined = [...prev, ...valid]
      if (combined.length > maxFilesPerUpload) {
        setError(language === "vi" 
          ? `Chỉ được upload tối đa ${maxFilesPerUpload} file cùng lúc.`
          : `You can only upload up to ${maxFilesPerUpload} files at a time.`
        )
        return combined.slice(0, maxFilesPerUpload)
      }
      return combined
    })
  }

  const handleUpload = async () => {
    if (!selectedFiles.length || (!hideSubject && !subject.trim())) return
    setError(null)
    setIsUploading(true)
    try {
      const result = await onUpload(selectedFiles, subject.trim(), tags.trim() || undefined)
      // Không có kết quả trả về (luồng cũ) → coi như thành công, giữ hành vi trước đây.
      if (!result || result.success) {
        onClose()
        return
      }
      // Thất bại (vd 409 File đã tồn tại trong thư mục này) → GIỮ NGUYÊN form,
      // file đã chọn, để user tự đổi tên hoặc chọn thư mục khác rồi thử lại ngay.
      setError(result.error ?? null)
    } finally {
      setIsUploading(false)
    }
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
            <p className="text-xs text-muted-foreground">{ACCEPTED_UPLOAD_LABEL}</p>
            <p className="mt-1 text-xs text-amber-500 font-medium">
              {language === "vi" 
                ? `Tối đa ${maxFilesPerUpload} file, mỗi file không quá ${maxFileSizeMb}MB`
                : `Max ${maxFilesPerUpload} files, up to ${maxFileSizeMb}MB per file`}
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={ACCEPTED_UPLOAD_INPUT_TYPES}
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
            disabled={isUploading || !selectedFiles.length || (!hideSubject && !subject.trim())}
          >
            <Upload className="h-4 w-4" />
            {isUploading ? text.uploading : `${text.upload} ${selectedFiles.length > 0 ? `(${selectedFiles.length} file)` : ""}`}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
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
    uploading: "Đang upload...",
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
    uploading: "Uploading...",
    cancel: "Cancel",
  },
} as const
