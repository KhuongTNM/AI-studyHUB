"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  FolderPlus, Upload, FolderOpen, Pencil, Trash2, Download,
  MessageCircle, BookOpen, Eye, EyeOff, Move,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Document, Folder } from "@/lib/store"

export type ContextMenuTarget =
  | { type: "background" }
  | { type: "folder"; folder: Folder }
  | { type: "file"; doc: Document }
  | { type: "subject"; subject: string }

export interface ContextMenuState {
  x: number
  y: number
  target: ContextMenuTarget
}

interface Props {
  menu: ContextMenuState
  language: "vi" | "en"
  onClose: () => void
  // Background actions
  onNewFolder: () => void
  onUploadFile: () => void
  // Folder actions
  onOpenFolder: (folder: Folder) => void
  onRenameFolder: (folder: Folder) => void
  onMoveFolder: (folder: Folder) => void   // FR-23 / BR-087
  onDeleteFolder: (folder: Folder) => void
  // File actions
  onPreviewFile: (doc: Document) => void
  onEditFile: (doc: Document) => void
  onDownloadFile: (doc: Document) => void
  onDeleteFile: (doc: Document) => void
  onChatFile: (doc: Document) => void
  onFlashcardsFile: (doc: Document) => void
  onToggleVisibility: (doc: Document) => void
  onMoveFile: (doc: Document) => void
  isSubjectSelected?: boolean
  // Subject actions
  onRenameSubject?: (subject: string) => void
  onDeleteSubject?: (subject: string) => void
}

const t = {
  vi: {
    newFolder: "Tạo thư mục",
    uploadFile: "Upload tài liệu",
    open: "Mở",
    rename: "Đổi tên",
    move: "Di chuyển",
    delete: "Xóa",
    download: "Tải xuống",
    edit: "Chỉnh sửa",
    chatAI: "Chat AI",
    flashcards: "Tạo Flashcard",
    makePublic: "Đặt Public",
    makePrivate: "Đặt Private",
    details: "Xem chi tiết",
  },
  en: {
    newFolder: "New folder",
    uploadFile: "Upload file",
    open: "Open",
    rename: "Rename",
    move: "Move to",
    delete: "Delete",
    download: "Download",
    edit: "Edit",
    chatAI: "Chat AI",
    flashcards: "Create Flashcards",
    makePublic: "Make Public",
    makePrivate: "Make Private",
    details: "View details",
  },
} as const

interface MenuItemProps {
  icon: React.ElementType
  label: string
  onClick: () => void
  danger?: boolean
  className?: string
}

function MenuItem({ icon: Icon, label, onClick, danger, className }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors text-left",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-accent",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {label}
    </button>
  )
}

function Divider() {
  return <div className="my-1 h-px bg-border" />
}

export function ContextMenuPortal({
  menu,
  language,
  onClose,
  onNewFolder,
  onUploadFile,
  onOpenFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onPreviewFile,
  onEditFile,
  onDownloadFile,
  onDeleteFile,
  onChatFile,
  onFlashcardsFile,
  onToggleVisibility,
  onMoveFile,
  isSubjectSelected,
  onRenameSubject,
  onDeleteSubject,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const text = t[language]

  useEffect(() => {
    const handle = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === "Escape") { onClose(); return }
      if (e instanceof MouseEvent && ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handle)
    document.addEventListener("keydown", handle)
    return () => {
      document.removeEventListener("mousedown", handle)
      document.removeEventListener("keydown", handle)
    }
  }, [onClose])

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  const menuW = 192
  const menuH = 260
  const left = Math.min(menu.x, vw - menuW - 8)
  const top = Math.min(menu.y, vh - menuH - 8)

  const wrap = (fn: () => void) => () => { fn(); onClose() }

  const renderContent = () => {
    if (menu.target.type === "background") {
      if (!isSubjectSelected) {
        return (
          <div className="py-2.5 px-3 text-xs text-muted-foreground text-center font-medium bg-muted/40 max-w-[170px] mx-auto select-none">
            {language === "vi" ? "Vui lòng chọn môn học trước" : "Please select a subject first"}
          </div>
        )
      }
      return (
        <div className="py-1">
          <MenuItem icon={FolderPlus} label={text.newFolder} onClick={wrap(onNewFolder)} />
          <MenuItem icon={Upload} label={text.uploadFile} onClick={wrap(onUploadFile)} />
        </div>
      )
    }

    if (menu.target.type === "folder") {
      const { folder } = menu.target
      return (
        <div className="py-1">
          <MenuItem icon={FolderOpen} label={text.open} onClick={wrap(() => onOpenFolder(folder))} />
          <MenuItem icon={Pencil} label={text.rename} onClick={wrap(() => onRenameFolder(folder))} />
          <MenuItem icon={Move} label={text.move} onClick={wrap(() => onMoveFolder(folder))} />
          <Divider />
          <MenuItem icon={Trash2} label={text.delete} danger onClick={wrap(() => onDeleteFolder(folder))} />
        </div>
      )
    }

    if (menu.target.type === "subject") {
      const { subject } = menu.target
      return (
        <div className="py-1">
          <MenuItem icon={Pencil} label={text.rename} onClick={wrap(() => onRenameSubject?.(subject))} />
          <Divider />
          <MenuItem icon={Trash2} label={text.delete} danger onClick={wrap(() => onDeleteSubject?.(subject))} />
        </div>
      )
    }

    // type === "file"
    const { doc } = menu.target
    return (
      <div className="py-1">
        <MenuItem icon={Eye} label={text.details} onClick={wrap(() => onPreviewFile(doc))} />
        <MenuItem icon={Pencil} label={text.edit} onClick={wrap(() => onEditFile(doc))} />
        <Divider />
        <MenuItem icon={MessageCircle} label={text.chatAI} onClick={wrap(() => onChatFile(doc))} />
        <MenuItem icon={BookOpen} label={text.flashcards} onClick={wrap(() => onFlashcardsFile(doc))} />
        <Divider />
        <MenuItem icon={Move} label={text.move} onClick={wrap(() => onMoveFile(doc))} />
        <MenuItem icon={Download} label={text.download} onClick={wrap(() => onDownloadFile(doc))} />
        <MenuItem
          icon={doc.isPublic ? EyeOff : Eye}
          label={doc.isPublic ? text.makePrivate : text.makePublic}
          onClick={wrap(() => onToggleVisibility(doc))}
        />
        <Divider />
        <MenuItem icon={Trash2} label={text.delete} danger onClick={wrap(() => onDeleteFile(doc))} />
      </div>
    )
  }

  const content = renderContent()

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top, left, zIndex: 9999 }}
      className="w-48 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
    >
      {content}
    </div>,
    document.body,
  )
}
