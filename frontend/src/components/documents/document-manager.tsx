"use client"

import { useState, useCallback } from "react"
import {
  Upload, Search, Filter, Grid3X3, List, ChevronDown, X, ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useApp, Document, formatBytes } from "@/lib/store"
import { UploadProgress } from "./upload-progress"
import { DocumentPreviewModal } from "./document-preview-modal"
import { EditDocModal } from "./edit-doc-modal"
import { UploadModal } from "./upload-modal"
import { DocumentCard } from "./document-card"

// ─── Main Document Manager ────────────────────────────────────────────────────
export function DocumentManager() {
  const { documents, categories, addDocument, deleteDocument, updateDocument, currentUser, setCurrentPage, generateFlashcardsFromDocument } = useApp()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const activeDocs = documents.filter(d => d.status !== "deleted")

  const filtered = activeDocs
    .filter(d => {
      const matchSearch = !searchQuery ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchCat = selectedCategory === "all" || d.categoryId === selectedCategory
      return matchSearch && matchCat
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === "date") cmp = a.uploadedAt.getTime() - b.uploadedAt.getTime()
      else if (sortBy === "name") cmp = a.name.localeCompare(b.name)
      else cmp = a.sizeBytes - b.sizeBytes
      return sortOrder === "desc" ? -cmp : cmp
    })

  const simulateUpload = useCallback((files: File[], subject: string) => {
    if (!currentUser) return
    files.forEach(file => {
      const ext = file.name.split(".").pop() as "pdf" | "docx" | "pptx"
      const newDoc: Document = {
        id: `doc-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: ext,
        size: formatBytes(file.size),
        sizeBytes: file.size,
        uploadedAt: new Date(),
        uploadedBy: currentUser.id,
        categoryId: "",
        subject,
        status: "uploading",
        uploadProgress: 0,
        tags: [],
        downloadCount: 0,
        isPublic: false,
        shareStatus: "none",
      }
      addDocument(newDoc)
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 20 + 5
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
          updateDocument(newDoc.id, { status: "scanning", uploadProgress: 100 })
          setTimeout(() => updateDocument(newDoc.id, { status: "ready", uploadProgress: 100 }), 1200)
        } else {
          updateDocument(newDoc.id, { uploadProgress: Math.round(progress) })
        }
      }, 200)
    })
  }, [currentUser, addDocument, updateDocument])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // When dragging directly, open modal with default category
    setShowUploadModal(true)
  }, [])

  const handleDownload = (id: string) => {
    updateDocument(id, { downloadCount: (documents.find(d => d.id === id)?.downloadCount ?? 0) + 1 })
  }

  const uploadingDocs = documents.filter(d => d.status === "uploading" || d.status === "scanning")

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Tài liệu của tôi</h1>
            <p className="text-sm text-muted-foreground">{activeDocs.length} tài liệu</p>
          </div>
          <Button className="gap-2" onClick={() => setShowUploadModal(true)} disabled={!currentUser}>
            <Upload className="h-4 w-4" />
            Upload tài liệu
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Upload progress */}
        {uploadingDocs.length > 0 && (
          <div className="mb-4 space-y-2">
            <h3 className="text-sm font-medium text-foreground">Đang tải lên</h3>
            {uploadingDocs.map(doc => <UploadProgress key={doc.id} doc={doc} />)}
          </div>
        )}

        {/* Empty state */}
        {activeDocs.length === 0 && uploadingDocs.length === 0 && (
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "mb-6 flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            )}
          >
            <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Kéo & thả tài liệu vào đây</p>
            <p className="text-xs text-muted-foreground">Hỗ trợ: PDF, DOCX, PPTX</p>
            <Button className="mt-3 gap-2" variant="outline" onClick={() => setShowUploadModal(true)}>
              <Upload className="h-4 w-4" /> Chọn file
            </Button>
          </div>
        )}

        {/* Filter & Search */}
        {activeDocs.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm tài liệu..."
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Category filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Filter className="h-3 w-3" />
                  {selectedCategory === "all" ? "Tất cả môn" : categories.find(c => c.id === selectedCategory)?.name}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSelectedCategory("all")}>Tất cả môn học</DropdownMenuItem>
                <DropdownMenuSeparator />
                {categories.map(c => (
                  <DropdownMenuItem key={c.id} onClick={() => setSelectedCategory(c.id)}>
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ArrowUpDown className="h-3 w-3" />Sắp xếp<ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => { setSortBy("date"); setSortOrder("desc") }}>Mới nhất</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("date"); setSortOrder("asc") }}>Cũ nhất</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("name"); setSortOrder("asc") }}>Tên A-Z</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("name"); setSortOrder("desc") }}>Tên Z-A</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("size"); setSortOrder("desc") }}>Lớn nhất</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View toggle */}
            <div className="flex rounded-lg border border-border">
              <button onClick={() => setViewMode("grid")} className={cn("p-2 rounded-l-lg", viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-r-lg", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Category tabs */}
        {activeDocs.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all",
                selectedCategory === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              Tất cả ({activeDocs.length})
            </button>
            {categories.map(c => {
              const count = activeDocs.filter(d => d.categoryId === c.id).length
              if (count === 0) return null
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all",
                    selectedCategory === c.id ? "text-white" : "border border-border text-muted-foreground hover:border-primary/40"
                  )}
                  style={selectedCategory === c.id ? { backgroundColor: c.color } : {}}
                >
                  {c.name} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* Drag drop zone for existing docs */}
        {activeDocs.length > 0 && (
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "mb-4 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-3 text-sm transition-all cursor-pointer",
              isDragging ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"
            )}
            onClick={() => setShowUploadModal(true)}
          >
            <Upload className="h-4 w-4" />
            Kéo file hoặc click để upload thêm
          </div>
        )}

        {/* Empty search */}
        {filtered.length === 0 && activeDocs.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-foreground">Không tìm thấy tài liệu</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearchQuery(""); setSelectedCategory("all") }}>
              Xóa bộ lọc
            </Button>
          </div>
        )}

        {/* Grid/List */}
        <div className={cn(
          viewMode === "grid"
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "space-y-2"
        )}>
          {filtered.map(doc => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              viewMode={viewMode}
              onPreview={setPreviewDoc}
              onEdit={setEditDoc}
              onDelete={deleteDocument}
              onDownload={handleDownload}
              onChat={() => setCurrentPage("chat")}
              onGenerateFlashcards={(document) => {
                generateFlashcardsFromDocument(document.id)
                setCurrentPage("flashcards")
              }}
              categories={categories}
            />
          ))}
        </div>

        {!currentUser && (
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
            <p className="font-medium text-foreground">Đăng nhập để quản lý tài liệu của bạn</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showUploadModal && (
        <UploadModal onClose={() => setShowUploadModal(false)} onUpload={simulateUpload} />
      )}
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} onDownload={handleDownload} />
      )}
      {editDoc && <EditDocModal doc={editDoc} onClose={() => setEditDoc(null)} />}
    </div>
  )
}
