"use client"

import { useState, useCallback } from "react"
import {
  Upload, Search, Filter, Grid3X3, List, ChevronDown, X,
  ArrowUpDown, FolderPlus, Home, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"
import type { Document, Folder } from "@/lib/store"
import { UploadProgress } from "./upload-progress"
import { DocumentPreviewModal } from "./document-preview-modal"
import { EditDocModal } from "./edit-doc-modal"
import { UploadModal } from "./upload-modal"
import { DocumentCard } from "./document-card"
import { FolderCard } from "./folder-card"
import { CreateFolderModal } from "./create-folder-modal"
import { CreateSubjectModal } from "./create-subject-modal"
import { MoveFileModal } from "./move-file-modal"
import { ContextMenuPortal } from "./context-menu-portal"
import type { ContextMenuState, ContextMenuTarget } from "./context-menu-portal"

// ─── Main Document Manager ────────────────────────────────────────────────────
export function DocumentManager() {
  const {
    documents, categories, deleteDocument,
    uploadDocument, downloadDocument, changeDocumentVisibility,
    currentUser, setCurrentPage, generateFlashcardsFromDocument, language,
    folders, createFolder, renameFolder, deleteFolder, moveDocumentToFolder,
  } = useApp()

  // ── Navigation state ────────────────────────────────────────────────────
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<Folder[]>([]) // breadcrumb trail

  // ── Filter / sort / view ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSubject, setSelectedSubject] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // ── Modals ──────────────────────────────────────────────────────────────
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [showCreateSubject, setShowCreateSubject] = useState(false)
  const [customSubjects, setCustomSubjects] = useState<string[]>([])
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null)
  const [moveTarget, setMoveTarget] = useState<Document | null>(null)

  // ── Drag state ──────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Context menu ────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const text = docManagerText[language]

  // ── Derived data ────────────────────────────────────────────────────────
  const activeDocs = documents.filter(d => d.status !== "deleted")

  // Documents visible in current folder
  const docsInFolder = activeDocs.filter(d =>
    (d.folderId ?? null) === currentFolderId
  )

  // Subfolders in current folder
  const foldersInView = folders.filter(f => f.parentId === currentFolderId)

  // Subjects from all documents to keep filters persistent across navigation
  const subjects = Array.from(
    new Set([
      ...customSubjects,
      ...activeDocs.map(d => d.subject?.trim()).filter((s): s is string => Boolean(s))
    ])
  ).sort((a, b) => a.localeCompare(b, language === "vi" ? "vi" : "en"))

  const currentFolderName = folderPath.length > 0 ? folderPath[folderPath.length - 1].name : text.title

  const filtered = docsInFolder
    .filter(d => {
      const matchSearch = !searchQuery ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchSubject = selectedSubject === "all" || d.subject?.trim() === selectedSubject
      return matchSearch && matchSubject
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === "date") cmp = a.uploadedAt.getTime() - b.uploadedAt.getTime()
      else if (sortBy === "name") cmp = a.name.localeCompare(b.name)
      else cmp = a.sizeBytes - b.sizeBytes
      return sortOrder === "desc" ? -cmp : cmp
    })

  const filteredFolders = foldersInView.filter(f => {
    const matchSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchSubject = selectedSubject === "all" || f.subject === selectedSubject
    return matchSearch && matchSubject
  })

  const uploadingDocs = documents.filter(d => d.status === "uploading" || d.status === "scanning")

  // ── Navigation ──────────────────────────────────────────────────────────
  const navigateToFolder = useCallback((folder: Folder) => {
    setCurrentFolderId(folder.id)
    setFolderPath(prev => [...prev, folder])
    setSearchQuery("")
    // Khi vào folder, chúng ta giữ nguyên bộ lọc môn học nếu folder đó thuộc môn học đó
    // Hoặc nếu folder không có môn học (tạo ở chế độ "Tất cả") thì vẫn để "Tất cả"
  }, [])

  const navigateToRoot = useCallback(() => {
    setCurrentFolderId(null)
    setFolderPath([])
    setSearchQuery("")
  }, [])

  const navigateToBreadcrumb = useCallback((index: number) => {
    if (index < 0) {
      navigateToRoot()
    } else {
      const folder = folderPath[index]
      setCurrentFolderId(folder.id)
      setFolderPath(prev => prev.slice(0, index + 1))
      setSearchQuery("")
    }
  }, [folderPath, navigateToRoot])

  // ── Upload ──────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (files: File[], subject: string) => {
    if (!currentUser) return
    setUploadError(null)
    for (const file of files) {
      const result = await uploadDocument(file, subject, "private", currentFolderId)
      if (!result.success && result.error) {
        setUploadError(result.error)
        break
      }
    }
  }, [currentUser, uploadDocument, currentFolderId])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setShowUploadModal(true)
  }, [])

  const handleDownload = useCallback((id: string) => {
    downloadDocument(id)
  }, [downloadDocument])

  const handleToggleVisibility = useCallback((id: string, isPublic: boolean) => {
    void changeDocumentVisibility(id, isPublic)
  }, [changeDocumentVisibility])

  // ── Context menu ────────────────────────────────────────────────────────
  const openContextMenu = useCallback((e: React.MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, target })
  }, [])

  // ── Folder actions ──────────────────────────────────────────────────────
  const handleCreateFolder = useCallback((name: string) => {
    createFolder(name, currentFolderId, selectedSubject !== "all" ? selectedSubject : undefined)
  }, [createFolder, currentFolderId, selectedSubject])

  const handleCreateSubject = useCallback((name: string) => {
    setCustomSubjects(prev => {
      if (prev.includes(name)) return prev
      return [...prev, name]
    })
    setSelectedSubject(name)
  }, [])

  const handleRenameFolder = useCallback((name: string) => {
    if (renameTarget) renameFolder(renameTarget.id, name)
    setRenameTarget(null)
  }, [renameFolder, renameTarget])

  const handleDeleteFolder = useCallback((folder: Folder) => {
    deleteFolder(folder.id)
    // If we're inside a deleted folder, go up
    if (folderPath.some(f => f.id === folder.id)) navigateToRoot()
  }, [deleteFolder, folderPath, navigateToRoot])

  // ── Drag-over folder highlight (drop to move) ───────────────────────────
  const isEmpty = activeDocs.length === 0 && folders.length === 0 && uploadingDocs.length === 0

  return (
    <div
      className="flex h-full flex-col"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{currentFolderName}</h1>
            <p className="text-sm text-muted-foreground">
              {foldersInView.length > 0 ? `${foldersInView.length} ${text.folders}, ` : ""}
              {docsInFolder.length} {docsInFolder.length === 1 ? text.document : text.documents}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowCreateSubject(true)}
              disabled={!currentUser}
            >
              <FolderPlus className="h-4 w-4" />
              {text.newSubject}
            </Button>
          </div>
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

      {/* ── Content area ───────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto p-6"
        onContextMenu={e => {
          // Only fire on the container background, not on cards
          const target = e.target as HTMLElement
          if (!target.closest("[data-item]")) {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "background" } })
          }
        }}
      >
        {/* Upload progress */}
        {uploadingDocs.length > 0 && (
          <div className="mb-4 space-y-2">
            <h3 className="text-sm font-medium text-foreground">{text.processing}</h3>
            {uploadingDocs.map(doc => <UploadProgress key={doc.id} doc={doc} />)}
          </div>
        )}

        {/* Breadcrumbs */}
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={navigateToRoot}
            className={cn(
              "flex items-center gap-1 hover:text-primary transition-colors",
              currentFolderId === null && "font-semibold text-foreground"
            )}
          >
            <Home className="h-4 w-4" />
            {text.myDocuments}
          </button>
          {folderPath.map((folder, i) => (
            <div key={folder.id} className="flex items-center gap-2">
              <ChevronRight className="h-3 w-3" />
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={cn(
                  "hover:text-primary transition-colors",
                  i === folderPath.length - 1 && "font-semibold text-foreground"
                )}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </div>

        {/* Filter & Search bar */}
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
                {selectedSubject === "all" ? text.allSubjects : selectedSubject}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedSubject("all")}>{text.allSubjectsFull}</DropdownMenuItem>
              <DropdownMenuSeparator />
              {subjects.map(subject => (
                <DropdownMenuItem key={subject} onClick={() => setSelectedSubject(subject)}>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary" />
                  {subject}
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

        {/* Category tabs */}
        {subjects.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedSubject("all")}
              className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all",
                selectedSubject === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {text.all} ({docsInFolder.length})
            </button>
            {subjects.map(subject => {
              const count = docsInFolder.filter(d => d.subject?.trim() === subject).length
              return (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all",
                    selectedSubject === subject ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {subject} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* Custom empty states when no items match filters */}
        {filtered.length === 0 && filteredFolders.length === 0 && currentFolderId === null && (
          selectedSubject === "all" ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/20 text-primary">
                <FolderPlus className="h-8 w-8 text-primary" />
              </div>
              <p className="mb-1 text-base font-semibold text-foreground">
                {language === "vi" ? "Chọn môn học để bắt đầu" : "Select a subject to get started"}
              </p>
              <p className="mb-4 text-sm text-muted-foreground max-w-sm">
                {language === "vi"
                  ? "Vui lòng chọn một môn học dưới thanh tìm kiếm hoặc tạo môn học mới để bắt đầu."
                  : "Please select a subject under the search bar or create a new subject to start."}
              </p>
              <Button className="gap-2" onClick={() => setShowCreateSubject(true)}>
                <FolderPlus className="h-4 w-4" /> {text.newSubject}
              </Button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all",
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              )}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/20">
                <FolderPlus className="h-8 w-8 text-amber-500" />
              </div>
              <p className="mb-1 text-base font-semibold text-foreground">
                {language === "vi" ? "Môn học này chưa có tài liệu" : "This subject is empty"}
              </p>
              <p className="mb-4 text-sm text-muted-foreground">
                {language === "vi"
                  ? "Nhấp chuột phải vào vùng trống để tạo thư mục hoặc upload tài liệu."
                  : "Right-click on the empty space to create a folder or upload a document."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {language === "vi" ? "Hoặc kéo thả file vào đây" : "Or drag and drop files here"}
              </p>
            </div>
          )
        )}

        {/* ── Folders section ─────────────────────────────────────── */}
        {filteredFolders.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              {text.foldersSection}
            </p>
            <div className={cn(
              viewMode === "grid"
                ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "space-y-2"
            )}>
              {filteredFolders.map(folder => {
                const count = activeDocs.filter(d => d.folderId === folder.id).length
                return (
                  <div key={folder.id} data-item="folder">
                    <FolderCard
                      folder={folder}
                      viewMode={viewMode}
                      docCount={count}
                      language={language}
                      onOpen={navigateToFolder}
                      onRename={f => setRenameTarget(f)}
                      onDelete={handleDeleteFolder}
                      onContextMenu={(e, f) => openContextMenu(e, { type: "folder", folder: f })}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Files section ───────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div>
            {filteredFolders.length > 0 && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                {text.filesSection}
              </p>
            )}

            <div className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "space-y-2"
            )}>
              {filtered.map(doc => (
                <div
                  key={doc.id}
                  data-item="file"
                  onContextMenu={e => openContextMenu(e, { type: "file", doc })}
                >
                  <DocumentCard
                    doc={doc}
                    viewMode={viewMode}
                    onPreview={setPreviewDoc}
                    onEdit={setEditDoc}
                    onDelete={deleteDocument}
                    onDownload={handleDownload}
                    onToggleVisibility={handleToggleVisibility}
                    onChat={() => setCurrentPage("chat")}
                    onGenerateFlashcards={document => {
                      generateFlashcardsFromDocument(document.id)
                      setCurrentPage("flashcards")
                    }}
                    categories={categories}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {!currentUser && (
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
            <p className="font-medium text-foreground">{text.loginToManage}</p>
          </div>
        )}
      </div>

      {/* ── Context menu ────────────────────────────────────────────────── */}
      {contextMenu && (
        <ContextMenuPortal
          menu={contextMenu}
          language={language}
          onClose={() => setContextMenu(null)}
          onNewFolder={() => setShowCreateFolder(true)}
          onUploadFile={() => setShowUploadModal(true)}
          onOpenFolder={navigateToFolder}
          onRenameFolder={f => setRenameTarget(f)}
          onDeleteFolder={handleDeleteFolder}
          onPreviewFile={setPreviewDoc}
          onEditFile={setEditDoc}
          onDownloadFile={doc => handleDownload(doc.id)}
          onDeleteFile={doc => deleteDocument(doc.id)}
          onChatFile={() => setCurrentPage("chat")}
          onFlashcardsFile={doc => {
            generateFlashcardsFromDocument(doc.id)
            setCurrentPage("flashcards")
          }}
          onToggleVisibility={doc => handleToggleVisibility(doc.id, !doc.isPublic)}
          onMoveFile={doc => setMoveTarget(doc)}
          isSubjectSelected={selectedSubject !== "all"}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showUploadModal && (
        <UploadModal
          initialSubject={selectedSubject !== "all" ? selectedSubject : ""}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
        />
      )}
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} onDownload={handleDownload} />
      )}
      {editDoc && <EditDocModal doc={editDoc} onClose={() => setEditDoc(null)} />}

      {showCreateSubject && (
        <CreateSubjectModal
          language={language}
          onConfirm={handleCreateSubject}
          onClose={() => setShowCreateSubject(false)}
        />
      )}

      {showCreateFolder && (
        <CreateFolderModal
          language={language}
          onConfirm={handleCreateFolder}
          onClose={() => setShowCreateFolder(false)}
        />
      )}
      {renameTarget && (
        <CreateFolderModal
          language={language}
          initialName={renameTarget.name}
          onConfirm={handleRenameFolder}
          onClose={() => setRenameTarget(null)}
        />
      )}
      {moveTarget && (
        <MoveFileModal
          doc={moveTarget}
          folders={folders}
          currentFolderId={currentFolderId}
          language={language}
          onMove={folderId => moveDocumentToFolder(moveTarget.id, folderId)}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </div>
  )
}

// ─── i18n strings ────────────────────────────────────────────────────────────
const docManagerText = {
  vi: {
    title: "Tài liệu của tôi",
    myDocuments: "Tài liệu của tôi",
    document: "tài liệu",
    documents: "tài liệu",
    folders: "thư mục",
    newFolder: "Thư mục mới",
    newSubject: "Môn học mới",
    uploadDocument: "Upload tài liệu",
    processing: "Đang xử lý",
    emptyTitle: "Thư mục đang trống",
    emptyHint: "Kéo thả file hoặc tạo thư mục để bắt đầu",
    emptyFolderTitle: "Thư mục này đang trống",
    emptyFolderHint: "Upload file hoặc tạo thư mục con",
    rightClickHint: "Nhấp chuột phải để tạo thư mục hoặc upload tài liệu",
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
    foldersSection: "Thư mục",
    filesSection: "Tài liệu",
  },
  en: {
    title: "My Documents",
    myDocuments: "My Documents",
    document: "document",
    documents: "documents",
    folders: "folders",
    newFolder: "New folder",
    newSubject: "New subject",
    uploadDocument: "Upload document",
    processing: "Processing",
    emptyTitle: "This folder is empty",
    emptyHint: "Drag & drop files or create a folder to get started",
    emptyFolderTitle: "This folder is empty",
    emptyFolderHint: "Upload files or create a subfolder",
    rightClickHint: "Right-click to create a folder or upload a document",
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
    foldersSection: "Folders",
    filesSection: "Files",
  },
} as const
