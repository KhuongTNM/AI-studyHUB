"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useApp, Document } from "@/lib/store"
import { updateDocumentApi } from "@/services/api/documents"

export function EditDocModal({
  doc,
  onClose,
}: {
  doc: Document
  onClose: () => void
}) {
  const { updateDocument } = useApp()
  const [title, setTitle] = useState(doc.name)
  const [description, setDescription] = useState(doc.description || "")
  const [subject, setSubject] = useState(doc.subject)
  const [tags, setTags] = useState(doc.tags.join(", "))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!title.trim()) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const updated = await updateDocumentApi(doc.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        subject: subject.trim(),
        tags: tags.trim() || undefined,
      })
      // Đồng bộ local state sau khi API thành công
      updateDocument(doc.id, {
        name: updated.name,
        description: updated.description,
        subject: updated.subject,
        tags: updated.tags,
      })
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Không thể lưu thay đổi. Vui lòng thử lại.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold text-foreground">Chỉnh sửa thông tin</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 p-4">
          {saveError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span className="flex-1">{saveError}</span>
              <button onClick={() => setSaveError(null)}><X className="h-3 w-3" /></button>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Tiêu đề *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Mô tả
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Môn học
            </label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Tags
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(cách nhau bởi dấu phẩy)</span>
            </label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="toán học, đại số..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
        <div className="flex gap-2 border-t border-border p-4">
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
          >
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
        </div>
      </div>
    </div>
  )
}
