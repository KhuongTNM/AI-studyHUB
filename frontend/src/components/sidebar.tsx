"use client"

import { useEffect, useState } from "react"
import {
  MessageCircle, FolderOpen, Plus, Sparkles, Cloud,
  ChevronDown, ChevronRight, Home, Trash2,
  BookOpen,
  LayoutDashboard, LogIn, HardDrive, X, Clock, Users, ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, formatBytes } from "@/lib/store"

interface SidebarProps {
  onNewChat: () => void
}

type NavPage = "home" | "documents" | "chat" | "groups" | "cloud" | "profile" | "admin" | "trash" | "flashcards"
type AdminSection = "overview" | "accounts" | "sub-admins" | "packages"

const navItems: { page: NavPage; icon: React.ElementType; label: { vi: string; en: string }; adminOnly?: boolean }[] = [
  { page: "home", icon: Home, label: { vi: "Trang chủ", en: "Home" } },
  { page: "chat", icon: MessageCircle, label: { vi: "AI Chatbot", en: "AI Chatbot" } },
  { page: "groups", icon: Users, label: { vi: "Chat nhóm", en: "Group Chat" } },
  { page: "documents", icon: FolderOpen, label: { vi: "Tài liệu của tôi", en: "My Documents" } },
  { page: "flashcards", icon: BookOpen, label: { vi: "Flashcards", en: "Flashcards" } },
  { page: "cloud", icon: Cloud, label: { vi: "Cloud Storage", en: "Cloud Storage" } },
  { page: "trash", icon: Trash2, label: { vi: "Thùng rác", en: "Trash" } },
]

const adminNavItems: { section: AdminSection; icon: React.ElementType; label: { vi: string; en: string }; adminOnly?: boolean }[] = [
  { section: "overview", icon: LayoutDashboard, label: { vi: "Tổng quan", en: "Overview" } },
  { section: "accounts", icon: Users, label: { vi: "Tài khoản", en: "Accounts" } },
  { section: "sub-admins", icon: ShieldCheck, label: { vi: "Sub-admin", en: "Sub-admins" }, adminOnly: true },
  { section: "packages", icon: Sparkles, label: { vi: "Gói dịch vụ", en: "Packages" }, adminOnly: true },
]

const getInitialAdminSection = (): AdminSection => {
  if (typeof window === "undefined") return "overview"
  const stored = window.sessionStorage.getItem("admin-section")
  return ["overview", "accounts", "sub-admins", "packages"].includes(stored ?? "")
    ? stored as AdminSection
    : "overview"
}

export function Sidebar({ onNewChat }: SidebarProps) {
  const { currentUser, currentPage, setCurrentPage, chatSessions, activeChatId,
    setActiveChatId, openAuthModal, logout, documents, language } = useApp()

  const text = language === "vi" ? {
    newChat: "Cuộc hội thoại mới",
    menu: "Menu",
    chatHistory: "Lịch sử chat",
    startChat: "Bắt đầu cuộc trò chuyện",
    seeMore: "Xem thêm",
    seeLess: "Thu gọn",
    tools: "Công cụ AI",
    summarize: "Tóm tắt tài liệu",
    flashcards: "Tạo Flashcard",
    storage: "Dung lượng",
    logout: "Đăng xuất",
    loginFree: "Đăng nhập miễn phí",
    loginHint: "Lưu lịch sử chat và tài liệu trên cloud.",
    login: "Đăng nhập",
    register: "Đăng ký",
  } : {
    newChat: "New conversation",
    menu: "Menu",
    chatHistory: "Chat history",
    startChat: "Start a conversation",
    seeMore: "See more",
    seeLess: "See less",
    tools: "AI tools",
    summarize: "Summarize document",
    flashcards: "Create flashcards",
    storage: "Storage",
    logout: "Log out",
    loginFree: "Log in for free",
    loginHint: "Save chat history and documents in cloud storage.",
    login: "Log in",
    register: "Sign up",
  }

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    history: true,
    nav: true,
  })
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSection>(getInitialAdminSection)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const HISTORY_PAGE_SIZE = 10

  useEffect(() => {
    const syncAdminSection = () => setActiveAdminSection(getInitialAdminSection())
    window.addEventListener("admin-section-change", syncAdminSection)
    return () => window.removeEventListener("admin-section-change", syncAdminSection)
  }, [])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleNav = (page: NavPage) => {
    if (page === "chat") { onNewChat() }
    setCurrentPage(page)
  }

  const handleAdminNav = (section: AdminSection) => {
    window.sessionStorage.setItem("admin-section", section)
    setActiveAdminSection(section)
    setCurrentPage("admin")
    window.dispatchEvent(new Event("admin-section-change"))
  }

  const storagePercent = currentUser
    ? Math.round((currentUser.storageUsed / currentUser.storageLimit) * 100)
    : 0

  const isAdminAccount = currentUser?.role === "admin" || currentUser?.role === "sub-admin"

  return (
    <aside className="flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <svg
            viewBox="0 0 48 48"
            aria-hidden="true"
            className="h-7 w-7 text-primary-foreground"
          >
            <path
              fill="currentColor"
              d="M14.4 5.5h19.2L43.2 24l-9.6 18.5H14.4L4.8 24 14.4 5.5Zm3.5 6.1L11.8 24l6.1 12.4h12.8l-4.1-6.2h-5.1L18.2 24l3.3-6.2h10.8l5.4 10.6L40.1 24l-6.5-12.4H17.9Zm5 10.4-1.1 2 2 3.8h7.7l-3-5.8h-5.6Z"
            />
          </svg>
        </div>
        <span className="text-lg font-bold text-sidebar-foreground">StudyHub</span>
        <Button
          variant="outline"
          size="icon"
          className="ml-auto h-8 w-8"
          onClick={() => isAdminAccount ? handleAdminNav("overview") : setCurrentPage("home")}
        >
          <Home className="h-4 w-4" />
        </Button>
      </div>

      {!isAdminAccount && (
        <div className="px-3 pb-4">
          <Button
            id="new-chat-btn"
            onClick={() => handleNav("chat")}
            variant="outline"
            className="w-full justify-start gap-2 border-border bg-background text-foreground hover:bg-muted"
          >
            <Plus className="h-4 w-4 rounded-full bg-primary/10 p-0.5 text-primary" />
            {text.newChat}
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {/* Main Nav Items */}
        <div className="mb-3">
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            {text.menu}
          </p>
          {(isAdminAccount ? adminNavItems : navItems)
            .filter(item => !("adminOnly" in item) || !item.adminOnly || currentUser?.role === "admin")
            .map(item => "section" in item ? (
              <button
                key={item.section}
                id={`admin-nav-${item.section}`}
                onClick={() => handleAdminNav(item.section)}
                className={cn(
                  "relative flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                  currentPage === "admin" && activeAdminSection === item.section
                    ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label[language]}</span>
              </button>
            ) : (
              <button
                key={item.page}
                id={`nav-${item.page}`}
                onClick={() => handleNav(item.page)}
                className={cn(
                  "relative flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                  currentPage === item.page
                    ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label[language]}</span>

              </button>
            ))}
        </div>

        {/* Chat History Section */}
        {currentUser && !isAdminAccount && (
          <div className="mb-3">
            <button
              onClick={() => toggleSection("history")}
              className="flex w-full items-center gap-2 py-2 text-sm text-muted-foreground px-2"
            >
              <Clock className="h-4 w-4" />
              <span>{text.chatHistory}</span>
              {expandedSections.history ? (
                <ChevronDown className="ml-auto h-4 w-4" />
              ) : (
                <ChevronRight className="ml-auto h-4 w-4" />
              )}
            </button>
            {expandedSections.history && (
              <div className="ml-2 space-y-1">
                {chatSessions.length > 0 ? (
                  <>
                    {(showAllHistory ? chatSessions : chatSessions.slice(0, HISTORY_PAGE_SIZE)).map(session => (
                      <button
                        key={session.id}
                        onClick={() => {
                          setActiveChatId(session.id)
                          setCurrentPage("chat")
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 truncate rounded-md px-2 py-1.5 text-sm",
                          activeChatId === session.id
                            ? "bg-sidebar-accent text-sidebar-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        <MessageCircle className="h-3 w-3 shrink-0" />
                        <span className="truncate">{session.title}</span>
                      </button>
                    ))}
                    {chatSessions.length > HISTORY_PAGE_SIZE && (
                      <button
                        onClick={() => setShowAllHistory(prev => !prev)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-sidebar-accent"
                      >
                        {showAllHistory ? text.seeLess : `${text.seeMore} (${chatSessions.length - HISTORY_PAGE_SIZE})`}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleNav("chat")}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    {text.startChat}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        {currentUser ? (
          <div className="space-y-3">
            {/* User Info */}
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                currentUser.role === "admin" || currentUser.role === "sub-admin" ? "bg-orange-500 text-white" : "bg-primary text-primary-foreground"
              )}>
                {currentUser.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{currentUser.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
              </div>
            </div>
            {/* Storage Bar */}
            {!["admin", "sub-admin"].includes(currentUser.role) && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {text.storage}</span>
                  <span>{formatBytes(currentUser.storageUsed)} / {formatBytes(currentUser.storageLimit)}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={cn("h-1.5 rounded-full transition-all", storagePercent > 80 ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
              </div>
            )}
            <Button
              id="sidebar-logout"
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
              {text.logout}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg bg-background p-4">
            <p className="mb-1 text-sm font-medium text-foreground">{text.loginFree}</p>
            <p className="mb-3 text-xs text-muted-foreground">
              {text.loginHint}
            </p>
            <div className="flex gap-2">
              <Button
                id="sidebar-login"
                variant="outline"
                size="sm"
                className="flex-1 gap-1"
                onClick={() => openAuthModal("login")}
              >
                <LogIn className="h-3 w-3" />
                {text.login}
              </Button>
              <Button
                id="sidebar-register"
                size="sm"
                className="flex-1"
                onClick={() => openAuthModal("register")}
              >
                {text.register}
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
