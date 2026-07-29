"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AuthModal } from "@/components/auth/auth-modal"
import { EnhancedChatInterface } from "@/components/chat-interface"
import { DocumentManager } from "@/components/documents/document-manager"
import { TrashPage } from "@/components/documents/trash-page"
import { ProfilePage } from "@/components/profile/profile-page"
import { CloudStorage } from "@/components/cloud/cloud-storage"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { FeaturesSection, Footer } from "@/components/features-section"
import { FlashcardPage } from "@/components/flashcards/flashcard-page"
import { GroupChatPage } from "@/components/groups/group-chat-page"
import { Button } from "@/components/ui/button"
import { useApp, type AppState } from "@/lib/store"
import { cn } from "@/lib/utils"
import {
  Sparkles, Menu, X, FileText, Bot, Cloud,
  Star, Users, Shield, Zap, BookOpen, GraduationCap,
} from "lucide-react"

// ─── Home Page ────────────────────────────────────────────────────────────────
function HomePage() {
  const { openAuthModal, currentUser, setCurrentPage, language } = useApp()

  const text = language === "vi" ? {
    chat: "Chat với AI",
    chatDesc: "Hỏi đáp thông minh về tài liệu",
    docs: "Quản lý tài liệu",
    docsDesc: "Upload, tìm kiếm, phân loại",
    search: "Tìm kiếm",
    searchDesc: "Tìm nhanh tài liệu theo tag",
    cloudDesc: "Lưu trữ an toàn, mã hóa",
    hero: "Trợ lý AI cho",
    student: "sinh viên",
    intro: "Quản lý tài liệu học tập tập trung, lưu trữ trên cloud và hỏi đáp AI thông minh — tất cả trong một nền tảng.",
    startFree: "Bắt đầu miễn phí",
    login: "Đăng nhập",
    startChat: "Bắt đầu chat AI",
    flashcardsDesc: "Ôn tập nhanh các khái niệm với thẻ học.",
    why: "Tại sao chọn StudyHub?",
    highlights: [
      "AI phân tích tài liệu theo thời gian thực",
      "Chia sẻ tài liệu với bạn học dễ dàng",
      "Bảo mật dữ liệu với mã hóa AES-256",
      "Tìm kiếm tức thì với full-text search",
    ],
  } : {
    chat: "Chat with AI",
    chatDesc: "Ask smart questions about your documents",
    docs: "Document manager",
    docsDesc: "Upload, search, and classify files",
    search: "Search",
    searchDesc: "Find documents quickly by tag",
    cloudDesc: "Secure encrypted storage",
    hero: "AI assistant for",
    student: "students",
    intro: "Manage study documents in one place, store them in the cloud, and ask an AI assistant questions about the content.",
    startFree: "Start for free",
    login: "Log in",
    startChat: "Start AI chat",
    flashcardsDesc: "Review key concepts quickly with study cards.",
    why: "Why choose StudyHub?",
    highlights: [
      "AI analyzes documents in real time",
      "Share study material with classmates",
      "Protect data with AES-256 encryption",
      "Search instantly with full-text matching",
    ],
  }

  const quickActions = [
    {
      icon: Bot,
      label: text.chat,
      desc: text.chatDesc,
      color: "from-violet-500 to-purple-600",
      page: "chat" as const,
    },
    {
      icon: FileText,
      label: text.docs,
      desc: text.docsDesc,
      color: "from-blue-500 to-cyan-600",
      page: "documents" as const,
    },
    {
      icon: BookOpen,
      label: "Flashcards",
      desc: text.flashcardsDesc,
      color: "from-emerald-500 to-teal-600",
      page: "flashcards" as const,
    },
    {
      icon: Cloud,
      label: "Cloud Storage",
      desc: text.cloudDesc,
      color: "from-orange-500 to-red-500",
      page: "cloud" as const,
    },
  ]

  const highlights = [
    { icon: Star, text: text.highlights[0] },
    { icon: Users, text: text.highlights[1] },
    { icon: Shield, text: text.highlights[2] },
    { icon: Zap, text: text.highlights[3] },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          StudyHub — SU26SWP391
        </div>
        <h1 className="mb-4 text-balance text-4xl font-bold text-foreground md:text-6xl">
          {text.hero}{" "}
          <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            {text.student}
          </span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
          {text.intro}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {!currentUser ? (
            <>
              <Button
                id="hero-register-btn"
                size="lg"
                className="gap-2 px-8"
                asChild
              >
                <a href="/register">
                  <GraduationCap className="h-5 w-5" />
                  {text.startFree}
                </a>
              </Button>
              <Button
                id="hero-login-btn"
                size="lg"
                variant="outline"
                asChild
              >
                <a href="/login">{text.login}</a>
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              className="gap-2 px-8"
              onClick={() => setCurrentPage("chat")}
            >
              <Bot className="h-5 w-5" />
              {text.startChat}
            </Button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {quickActions.map(action => (
          <button
            key={action.page}
            id={`quick-${action.page}`}
            onClick={() => setCurrentPage(action.page)}
            className="group rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className={cn(
              "mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white",
              action.color
            )}>
              <action.icon className="h-6 w-6" />
            </div>
            <p className="font-semibold text-foreground">{action.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{action.desc}</p>
          </button>
        ))}
      </div>

      {/* Highlights */}
      <div className="mb-12 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-violet-500/5 p-6">
        <h2 className="mb-4 text-center text-lg font-semibold text-foreground">{text.why}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {highlights.map(h => (
            <div key={h.text} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <h.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-foreground">{h.text}</p>
            </div>
          ))}
        </div>
      </div>

      <FeaturesSection language={language} />
      <Footer language={language} />
    </div>
  )
}

// Pages that require a logged-in session.
// Guests who land on any of these (e.g. by pasting /?page=documents) will be
// immediately redirected to Home and shown the login modal.
const PROTECTED_PAGES: AppState["currentPage"][] = [
  "chat", "groups", "documents", "cloud",
  "profile", "admin", "trash", "flashcards",
]

// ─── Root Component ───────────────────────────────────────────────────────────
export default function AIStudyHub() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
const appStore = useApp()
const { currentPage, setCurrentPage, currentUser, openAuthModal, language } = appStore
const authLoading = appStore.authLoading   // ← khai báo riêng, tránh bug Turbopack

  // ── Route guard ────────────────────────────────────────────────────────────
  // Wait until the initial session-restore call finishes (authLoading = false)
  // before deciding to redirect. This prevents bouncing a logged-in user whose
  // token hasn't been validated yet on first mount.
  useEffect(() => {
    if (authLoading) return
    if (!currentUser && PROTECTED_PAGES.includes(currentPage)) {
      // Clean the URL so the protected page name is not visible
      window.history.replaceState(null, "", window.location.pathname)
      setCurrentPage("home")
      openAuthModal("login")
    }
  }, [authLoading, currentUser, currentPage, setCurrentPage, openAuthModal])

  const handleNewChat = () => {
    setCurrentPage("chat")
  }

  const renderContent = () => {
    // Render guard: even before the useEffect above fires (same tick as the
    // state update), never display protected content to a guest.
    if (!authLoading && !currentUser && PROTECTED_PAGES.includes(currentPage)) {
      return <div className="flex-1 overflow-y-auto"><HomePage /></div>
    }

    switch (currentPage) {
      case "home":
        return <div className="flex-1 overflow-y-auto"><HomePage /></div>
      case "chat":
        return <div className="flex flex-1 flex-col overflow-hidden"><EnhancedChatInterface /></div>
      case "groups":
        return <div className="flex flex-1 flex-col overflow-hidden"><GroupChatPage /></div>
      case "documents":
        return <div className="flex flex-1 flex-col overflow-hidden"><DocumentManager /></div>
      case "cloud":
        return <div className="flex flex-1 flex-col overflow-hidden"><CloudStorage /></div>
      case "profile":
        return <div className="flex flex-1 flex-col overflow-hidden"><ProfilePage /></div>
      case "admin":
        return <div className="flex flex-1 flex-col overflow-hidden"><AdminDashboard /></div>
      case "trash":
        return <div className="flex flex-1 flex-col overflow-hidden"><TrashPage /></div>
      case "flashcards":
        return <div className="flex flex-1 flex-col overflow-hidden"><FlashcardPage /></div>
      default:
        return <div className="flex-1 overflow-y-auto"><HomePage /></div>
    }
  }

  // The sidebar and its mobile toggle are only rendered for authenticated users.
  const showSidebar = !!currentUser

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Sidebar Toggle — hidden for guests */}
      {showSidebar && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-4 top-3 z-50 lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      )}

      {/* Sidebar — hidden for guests */}
      {showSidebar && (
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:relative lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar onNewChat={handleNewChat} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex flex-1 flex-col overflow-hidden">
          {renderContent()}
        </main>
      </div>

      {/* Mobile overlay — only when sidebar is open for logged-in users */}
      {showSidebar && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Auth Modal (global) */}
      <AuthModal />
    </div>
  )
}
