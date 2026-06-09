"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useApp, Document } from "@/lib/store"

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

  const handleSave = () => {
    updateDocument(doc.id, {
      name: title,
      description,
      subject,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    })
    onClose()
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
              Tags (cách nhau bởi dấu phẩy)
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
          <Button className="flex-1" onClick={handleSave} disabled={!title.trim()}>
            Lưu thay đổi
          </Button>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
        </div>
      </div>
    </div>
  )
}
