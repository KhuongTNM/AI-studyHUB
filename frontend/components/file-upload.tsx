"use client"

import { useState, useCallback } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  onFileUpload: (files: File[]) => void
  onUrlSubmit: (url: string) => void
}

export function FileUpload({ onFileUpload, onUrlSubmit }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      const validFiles = files.filter((file) =>
        ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation"].includes(file.type)
      )
      if (validFiles.length > 0) {
        onFileUpload(validFiles)
      }
    },
    [onFileUpload]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        onFileUpload(files)
      }
    },
    [onFileUpload]
  )

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-primary/30 bg-background hover:border-primary/50"
      )}
    >
      <Upload className="mb-3 h-8 w-8 text-primary" />
      <p className="mb-3 text-sm text-muted-foreground">
        {"Kéo & thả tài liệu hoặc"}
      </p>
      <label>
        <Button className="cursor-pointer gap-2">
          Tải lên
          <Upload className="h-4 w-4" />
        </Button>
        <input
          type="file"
          className="hidden"
          accept=".pdf,.docx,.pptx"
          multiple
          onChange={handleFileSelect}
        />
      </label>
    </div>
  )
}
