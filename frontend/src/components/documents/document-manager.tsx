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
import { useApp, Document } from "@/lib/store"
import { UploadProgress } from "./upload-progress"
import { DocumentPreviewModal } from "./document-preview-modal"
import { EditDocModal } from "./edit-doc-modal"
import { UploadModal } from "./upload-modal"
import { DocumentCard } from "./document-card"

// ─── Main Document Manager ────────────────────────────────────────────────────
export function DocumentManager() {
  const {
    documents, categories, deleteDocument, updateDocument,
    uploadDocument, downloadDocument,
    currentUser, setCurrentPage, generateFlashcardsFromDocument, language,
  } = useApp()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const text = documentManagerText[language]

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

  /**
   * Gọi API thật upload tài liệu (BR-013 đến BR-018).
   * Thay thế hoàn toàn simulateUpload cũ.
   */
  const handleUpload = useCallback(async (files: File[], subject: string) => {
    if (!currentUser) return
    setUploadError(null)

    // Upload từng file tuần tự
    for (const file of files) {
      const result = await uploadDocument(file, subject)
      if (!result.success && result.error) {
        setUploadError(result.error)
        break
      }
    }
  }, [currentUser, uploadDocument])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setShowUploadModal(true)
  }, [])

  /** Tải file từ server và tăng downloadCount qua API (BR-021) */
  const handleDownload = useCallback((id: string) => {
    downloadDocument(id)
  }, [downloadDocument])

  const uploadingDocs = documents.filter(d => d.status === "uploading" || d.status === "scanning")

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{text.title}</h1>
            <p className="text-sm text-muted-foreground">{activeDocs.length} {activeDocs.length === 1 ? text.document : text.documents}</p>
          </div>
          <Button className="gap-2" onClick={() => setShowUploadModal(true)} disabled={!currentUser}>
            <Upload className="h-4 w-4" />
            {text.uploadDocument}
          </Button>
        </div>

        {/* Upload error banner */}
        {uploadError && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="flex-1">{uploadError}</span>
            <button onClick={() => setUploadError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Upload progress */}
        {uploadingDocs.length > 0 && (
          <div className="mb-4 space-y-2">
            <h3 className="text-sm font-medium text-foreground">{text.processing}</h3>
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
            <p className="text-sm font-medium text-foreground">{text.dropHere}</p>
            <p className="text-xs text-muted-foreground">{text.supportedFiles}</p>
            <Button className="mt-3 gap-2" variant="outline" onClick={() => setShowUploadModal(true)}>
              <Upload className="h-4 w-4" /> {text.chooseFile}
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
                placeholder={text.searchPlaceholder}
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
                  {selectedCategory === "all" ? text.allSubjects : categories.find(c => c.id === selectedCategory)?.name}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSelectedCategory("all")}>{text.allSubjectsFull}</DropdownMenuItem>
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
                  <ArrowUpDown className="h-3 w-3" />{text.sort}<ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => { setSortBy("date"); setSortOrder("desc") }}>{text.newest}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("date"); setSortOrder("asc") }}>{text.oldest}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("name"); setSortOrder("asc") }}>{text.nameAsc}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("name"); setSortOrder("desc") }}>{text.nameDesc}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("size"); setSortOrder("desc") }}>{text.largest}</DropdownMenuItem>
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
              {text.all} ({activeDocs.length})
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
            {text.dropMore}
          </div>
        )}

        {/* Empty search */}
        {filtered.length === 0 && activeDocs.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-foreground">{text.noResults}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearchQuery(""); setSelectedCategory("all") }}>
              {text.clearFilters}
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
            <p className="font-medium text-foreground">{text.loginToManage}</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showUploadModal && (
        <UploadModal onClose={() => setShowUploadModal(false)} onUpload={handleUpload} />
      )}
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} onDownload={handleDownload} />
      )}
      {editDoc && <EditDocModal doc={editDoc} onClose={() => setEditDoc(null)} />}
    </div>
  )
}

const documentManagerText = {
  vi: {
    title: "Tài liệu của tôi",
    document: "tài liệu",
    documents: "tài liệu",
    uploadDocument: "Upload tài liệu",
    processing: "Đang xử lý",
    dropHere: "Kéo & thả tài liệu vào đây",
    supportedFiles: "Hỗ trợ: PDF, DOCX, PPTX",
    chooseFile: "Chọn file",
    searchPlaceholder: "Tìm kiếm tài liệu...",
    allSubjects: "Tất cả môn",
    allSubjectsFull: "Tất cả môn học",
    sort: "Sắp xếp",
    newest: "Mới nhất",
    oldest: "Cũ nhất",
    nameAsc: "Tên A-Z",
    nameDesc: "Tên Z-A",
    largest: "Lớn nhất",
    all: "Tất cả",
    dropMore: "Kéo file hoặc click để upload thêm",
    noResults: "Không tìm thấy tài liệu",
    clearFilters: "Xóa bộ lọc",
    loginToManage: "Đăng nhập để quản lý tài liệu của bạn",
  },
  en: {
    title: "My Documents",
    document: "document",
    documents: "documents",
    uploadDocument: "Upload document",
    processing: "Processing",
    dropHere: "Drag and drop documents here",
    supportedFiles: "Supported: PDF, DOCX, PPTX",
    chooseFile: "Choose file",
    searchPlaceholder: "Search documents...",
    allSubjects: "All subjects",
    allSubjectsFull: "All subjects",
    sort: "Sort",
    newest: "Newest",
    oldest: "Oldest",
    nameAsc: "Name A-Z",
    nameDesc: "Name Z-A",
    largest: "Largest",
    all: "All",
    dropMore: "Drag files here or click to upload more",
    noResults: "No documents found",
    clearFilters: "Clear filters",
    loginToManage: "Log in to manage your documents",
  },
} as const
