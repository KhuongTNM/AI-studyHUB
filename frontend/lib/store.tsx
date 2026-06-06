"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { fetchAdminUsersApi, updateUserStorageLimitApi } from "@/lib/api/admin-users"
import { fetchCurrentUserApi, loginApi, logoutApi, registerApi, updateLanguagePreferenceApi } from "@/lib/api/auth"
import { fetchSubscriptionPlansApi, updatePackagePriceApi } from "@/lib/api/subscription-plans"

// ─── Types ──────────────────────────────────────────────────────────────────

export type UserRole = "guest" | "user" | "sub-admin" | "admin"
export type PackageTier = "free" | "2-4" | "5+"

export interface User {
  id: string
  email: string
  displayName: string
  password: string
  avatar?: string
  role: UserRole
  isLocked: boolean
  emailVerified: boolean
  createdAt: Date
  loginAttempts: number
  lastActive: Date
  storageUsed: number
  storageLimit: number
  subscriptionTier?: PackageTier
  subscriptionExpiresAt?: Date
  languagePreference?: Language
}

export interface PackagePrice {
  id: string
  name: string
  tier: PackageTier
  price: number
  maxUsers: number
}

export interface RoomMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: Date
}

export interface StudyRoom {
  id: string
  password?: string
  hostId: string
  hostName: string
  capacity: number
  members: {
    userId: string
    displayName: string
    joinedAt: Date
  }[]
  messages: RoomMessage[]
  createdAt: Date
}

export interface Category {
  id: string
  name: string
  color: string
}

export type DocStatus = "uploading" | "scanning" | "ready" | "failed" | "deleted"
export type ShareStatus = "none" | "pending" | "approved" | "rejected"

export interface Document {
  id: string
  name: string
  type: "pdf" | "docx" | "pptx"
  size: string
  sizeBytes: number
  uploadedAt: Date
  uploadedBy: string
  categoryId: string
  subject: string
  status: DocStatus
  uploadProgress?: number
  description?: string
  tags: string[]
  downloadCount: number
  isPublic: boolean
  shareStatus: ShareStatus
  shareNote?: string
  reviewedBy?: string
  reviewedAt?: Date
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  documentId?: string
  createdAt: Date
}

export interface ActivityLog {
  id: string
  userId: string
  action: string
  target: string
  timestamp: Date
}
export interface Flashcard {
  id: string
  documentId?: string
  question: string
  answer: string
  createdAt: Date
}
export type Language = "vi" | "en"

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Toán học", color: "#6366f1" },
  { id: "cat-2", name: "Vật lý", color: "#0ea5e9" },
  { id: "cat-3", name: "Hóa học", color: "#10b981" },
  { id: "cat-4", name: "Lập trình", color: "#f59e0b" },
  { id: "cat-5", name: "Kinh tế", color: "#ef4444" },
  { id: "cat-6", name: "Tiếng Anh", color: "#8b5cf6" },
]

const MOCK_ADMIN: User = {
  id: "user-admin",
  email: "admin@aistudyhub.com",
  displayName: "Admin System",
  password: "Admin123",
  role: "admin",
  isLocked: false,
  emailVerified: true,
  createdAt: new Date("2026-01-01"),
  loginAttempts: 0,
  lastActive: new Date(),
  storageUsed: 1024 * 1024 * 200,
  storageLimit: 1024 * 1024 * 1024 * 5,
  subscriptionTier: "5+",
  subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
}

const MOCK_SUB_ADMIN: User = {
  id: "user-sub-admin",
  email: "subadmin@aistudyhub.com",
  displayName: "Sub Admin",
  password: "SubAdmin123",
  role: "sub-admin",
  isLocked: false,
  emailVerified: true,
  createdAt: new Date("2026-02-01"),
  loginAttempts: 0,
  lastActive: new Date(),
  storageUsed: 1024 * 1024 * 10,
  storageLimit: 1024 * 1024 * 1024,
  subscriptionTier: "5+",
  subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
}

const MOCK_USERS: User[] = [
  MOCK_ADMIN,
  MOCK_SUB_ADMIN,
  {
    id: "user-1",
    email: "student@aistudyhub.com",
    displayName: "Demo Student",
    password: "Student123",
    role: "user",
    isLocked: false,
    emailVerified: true,
    createdAt: new Date("2026-03-10"),
    loginAttempts: 0,
    lastActive: new Date("2026-05-26"),
    storageUsed: 1024 * 1024 * 45,
    storageLimit: 1024 * 1024 * 512,
    subscriptionTier: "free",
  },
  {
    id: "user-2",
    email: "anhnv@fpt.edu.vn",
    displayName: "AnhNV",
    password: "User12345",
    role: "user",
    isLocked: false,
    emailVerified: true,
    createdAt: new Date("2026-03-15"),
    loginAttempts: 0,
    lastActive: new Date("2026-05-25"),
    storageUsed: 1024 * 1024 * 120,
    storageLimit: 1024 * 1024 * 512,
    subscriptionTier: "2-4",
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: "user-3",
    email: "locpd@fpt.edu.vn",
    displayName: "LocPD",
    password: "User12345",
    role: "user",
    isLocked: true,
    emailVerified: true,
    createdAt: new Date("2026-04-01"),
    loginAttempts: 5,
    lastActive: new Date("2026-05-20"),
    storageUsed: 1024 * 1024 * 80,
    storageLimit: 1024 * 1024 * 512,
    subscriptionTier: "free",
  },
]

const MOCK_ROOMS: StudyRoom[] = [
  {
    id: "ROOM-101",
    password: "123",
    hostId: "user-2",
    hostName: "AnhNV",
    capacity: 4,
    members: [
      { userId: "user-2", displayName: "AnhNV", joinedAt: new Date() }
    ],
    messages: [
      { id: "msg-r1", senderId: "user-2", senderName: "AnhNV", content: "Chào mọi người! Ai học nhóm cùng mình giải tích 1 không?", timestamp: new Date(Date.now() - 10 * 60 * 1000) }
    ],
    createdAt: new Date()
  }
]

const MOCK_DOCUMENTS: Document[] = [
  {
    id: "doc-1",
    name: "Giải tích 1 - Chương 1.pdf",
    type: "pdf",
    size: "2.4 MB",
    sizeBytes: 2516582,
    uploadedAt: new Date("2026-05-20"),
    uploadedBy: "user-1",
    categoryId: "cat-1",
    subject: "Giải tích",
    status: "ready",
    tags: ["giải tích", "đạo hàm", "tích phân"],
    downloadCount: 15,
    isPublic: true,
    shareStatus: "approved",
    description: "Tài liệu chương 1 môn Giải Tích 1 - Giới hạn và đạo hàm",
  },
  {
    id: "doc-2",
    name: "OOP Java - Slides.pptx",
    type: "pptx",
    size: "5.1 MB",
    sizeBytes: 5348454,
    uploadedAt: new Date("2026-05-22"),
    uploadedBy: "user-1",
    categoryId: "cat-4",
    subject: "Lập trình",
    status: "ready",
    tags: ["java", "OOP"],
    downloadCount: 32,
    isPublic: true,
    shareStatus: "approved",
    description: "Slides bài giảng OOP với Java",
  },
  {
    id: "doc-3",
    name: "Vật lý đại cương - Cơ học.pdf",
    type: "pdf",
    size: "3.8 MB",
    sizeBytes: 3985162,
    uploadedAt: new Date("2026-05-18"),
    uploadedBy: "user-2",
    categoryId: "cat-2",
    subject: "Vật lý",
    status: "ready",
    tags: ["cơ học", "vật lý"],
    downloadCount: 8,
    isPublic: true,
    shareStatus: "approved",
  },
  {
    id: "doc-4",
    name: "English Grammar Advanced.docx",
    type: "docx",
    size: "1.2 MB",
    sizeBytes: 1258291,
    uploadedAt: new Date("2026-05-15"),
    uploadedBy: "user-2",
    categoryId: "cat-6",
    subject: "Tiếng Anh",
    status: "ready",
    tags: ["grammar", "english"],
    downloadCount: 24,
    isPublic: true,
    shareStatus: "approved",
  },
  {
    id: "doc-5",
    name: "Kinh tế vi mô - Chương 3.pdf",
    type: "pdf",
    size: "4.5 MB",
    sizeBytes: 4718592,
    uploadedAt: new Date("2026-05-10"),
    uploadedBy: "user-1",
    categoryId: "cat-5",
    subject: "Kinh tế",
    status: "ready",
    tags: ["kinh tế", "cung cầu"],
    downloadCount: 11,
    isPublic: false,
    shareStatus: "pending",
    shareNote: "Muốn chia sẻ cho cả lớp tham khảo",
  },
  {
    id: "doc-6",
    name: "Hóa hữu cơ - Tổng hợp.pdf",
    type: "pdf",
    size: "3.1 MB",
    sizeBytes: 3251200,
    uploadedAt: new Date("2026-05-25"),
    uploadedBy: "user-2",
    categoryId: "cat-3",
    subject: "Hóa học",
    status: "ready",
    tags: ["hóa hữu cơ", "tổng hợp"],
    downloadCount: 0,
    isPublic: false,
    shareStatus: "pending",
    shareNote: "Tài liệu ôn tập hóa hữu cơ",
  },
]

const MOCK_ACTIVITY: ActivityLog[] = [
  { id: "log-1", userId: "user-1", action: "Tải lên tài liệu", target: "Giải tích 1 - Chương 1.pdf", timestamp: new Date("2026-05-20T09:30:00") },
  { id: "log-2", userId: "user-1", action: "Tải xuống tài liệu", target: "OOP Java - Slides.pptx", timestamp: new Date("2026-05-21T14:00:00") },
  { id: "log-3", userId: "user-sub-admin", action: "Updated storage limit", target: "student@aistudyhub.com", timestamp: new Date("2026-05-22T10:15:00") },
]

// ─── Context ─────────────────────────────────────────────────────────────────

interface AppState {
  currentUser: User | null
  users: User[]
  documents: Document[]
  categories: Category[]
  chatSessions: ChatSession[]
  activeChatId: string | null
  activityLogs: ActivityLog[]
  isDarkMode: boolean
  language: Language
  showAuthModal: boolean
  authModalTab: "login" | "register" | "forgot"
  currentPage: "home" | "documents" | "chat" | "cloud" | "profile" | "admin" | "trash" | "flashcards"
  packagePrices: PackagePrice[]
  rooms: StudyRoom[]
  currentRoomId: string | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  openAuthModal: (tab?: "login" | "register" | "forgot") => void
  closeAuthModal: () => void
  setCurrentPage: (page: AppState["currentPage"]) => void
  addDocument: (doc: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  deleteDocument: (id: string) => void
  restoreDocument: (id: string) => void
  addChatSession: (session: ChatSession) => void
  updateChatSession: (id: string, updates: Partial<ChatSession>) => void
  setActiveChatId: (id: string | null) => void
  updateUser: (id: string, updates: Partial<User>) => void
  updateUserStorageLimit: (id: string, storageLimitGb: number) => Promise<{ success: boolean; error?: string }>
  toggleUserLock: (id: string) => { success: boolean; error?: string }
  resetUserPassword: (id: string, password: string) => { success: boolean; error?: string }
  deleteUserAccount: (id: string) => { success: boolean; error?: string }
  createSubAdminAccount: (email: string, password: string, displayName: string) => { success: boolean; error?: string }
  addCategory: (name: string, color: string) => void
  deleteCategory: (id: string) => void
  addFlashcards: (cards: Flashcard[]) => void
  deleteFlashcard: (id: string) => void
  updateFlashcardStatus: (id: string, status: Flashcard["status"]) => void
  generateFlashcardsFromDocument: (docId: string) => void
  setFlashcardSelectedDocumentId: (id: string | "all") => void
  toggleDarkMode: () => void
  setLanguage: (language: Language) => void
  updatePackagePrice: (tier: PackageTier, newPrice: number, adminPassword: string) => Promise<{ success: boolean; error?: string }>
  grantSubscription: (userId: string, tier: PackageTier, durationMonths: number) => { success: boolean; error?: string }
  buySubscription: (tier: PackageTier) => { success: boolean; error?: string }
  createRoom: (roomId: string, password?: string) => { success: boolean; error?: string }
  joinRoom: (roomId: string, password?: string) => { success: boolean; error?: string }
  leaveRoom: () => void
  closeRoom: () => void
  sendRoomMessage: (content: string) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>(MOCK_USERS)
  const [packagePrices, setPackagePrices] = useState<PackagePrice[]>([
    { id: "pkg-free", name: "Gói Free", tier: "free", price: 0, maxUsers: 1 },
    { id: "pkg-medium", name: "Gói 2-4 người", tier: "2-4", price: 99000, maxUsers: 4 },
    { id: "pkg-large", name: "Gói 5+ người", tier: "5+", price: 199000, maxUsers: 99 }
  ])
  const [rooms, setRooms] = useState<StudyRoom[]>(MOCK_ROOMS)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS)
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(MOCK_ACTIVITY)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([
    {
      id: "flashcard-1",
      documentId: "doc-1",
      question: "Nội dung chính của tài liệu Giải tích 1 - Chương 1 là gì?",
      answer: "Giới hạn, đạo hàm và ứng dụng cơ bản trong bài toán tối ưu.",
      createdAt: new Date("2026-05-26T08:00:00"),
      status: "new",
    },
    {
      id: "flashcard-2",
      documentId: "doc-2",
      question: "Khái niệm OOP quan trọng nhất trong Java là gì?",
      answer: "Lập trình hướng đối tượng tập trung vào lớp, đối tượng, kế thừa và đa hình.",
      createdAt: new Date("2026-05-26T08:05:00"),
      status: "learning",
    },
    {
      id: "flashcard-3",
      question: "Tại sao cần tạo flashcard khi học tài liệu?",
      answer: "Flashcard giúp ôn tập nhanh, ghi nhớ điểm chính và củng cố kiến thức qua lặp lại.",
      createdAt: new Date("2026-05-26T08:10:00"),
      status: "mastered",
    },
  ])
  const [flashcardSelectedDocumentId, setFlashcardSelectedDocId] = useState<string | "all">("all")
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "vi"
    const storedLanguage = window.localStorage.getItem("ai-study-hub-language")
    return storedLanguage === "en" ? "en" : "vi"
  })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<"login" | "register" | "forgot">("login")
  const [currentPage, setCurrentPage] = useState<AppState["currentPage"]>("home")

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await loginApi(email, password)
      if (!result.success) return result
      setCurrentUser(result.user)
      setLanguageState(result.user.languagePreference ?? "vi")
      setShowAuthModal(false)
      return { success: true }
    } catch {
      return { success: false, error: "Không kết nối được máy chủ. Hãy chạy backend trên cổng 8080." }
    }
  }, [])

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      const result = await registerApi(email, password, displayName)
      if (!result.success) return result
      setCurrentUser(result.user)
      setLanguageState(result.user.languagePreference ?? "vi")
      setShowAuthModal(false)
      return { success: true }
    } catch {
      return { success: false, error: "Không kết nối được máy chủ. Hãy chạy backend trên cổng 8080." }
    }
  }, [])

  const logout = useCallback(() => {
    void logoutApi()
    setCurrentUser(null)
    setActiveChatId(null)
    setCurrentPage("home")
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchCurrentUserApi()
      .then(user => {
        if (!cancelled && user) {
          setCurrentUser(user)
          setLanguageState(user.languagePreference ?? "vi")
        }
      })
      .catch(() => {
        // ignore restore errors on initial load
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchSubscriptionPlansApi()
      .then(plans => {
        if (cancelled) return
        setPackagePrices(prev => prev.map(pkg => {
          const planName = pkg.tier === "2-4" ? "plan_2_4" : pkg.tier === "5+" ? "plan_5_plus" : "free"
          const plan = plans.find(item => item.name === planName)
          if (!plan) return pkg
          return {
            ...pkg,
            id: String(plan.id),
            name: plan.displayName,
            price: Number(plan.price),
            maxUsers: plan.maxRoomMembers || pkg.maxUsers,
          }
        }))
      })
      .catch(() => {
        // keep mock prices when backend is not available
      })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser || !["admin", "sub-admin"].includes(currentUser.role)) return
    let cancelled = false
    fetchAdminUsersApi()
      .then(fetchedUsers => {
        if (cancelled) return
        setUsers(fetchedUsers)
        const refreshedCurrentUser = fetchedUsers.find(user => user.id === currentUser.id)
        if (refreshedCurrentUser) setCurrentUser(refreshedCurrentUser)
      })
      .catch(() => {
        // keep mock users when backend admin user API is not available
      })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, currentUser?.role])

  const openAuthModal = useCallback((tab: "login" | "register" | "forgot" = "login") => {
    setAuthModalTab(tab)
    setShowAuthModal(true)
  }, [])

  const closeAuthModal = useCallback(() => setShowAuthModal(false), [])

  const addDocument = useCallback((doc: Document) => {
    setDocuments(prev => [doc, ...prev])
  }, [])

  const updateDocument = useCallback((id: string, updates: Partial<Document>) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
  }, [])

  const deleteDocument = useCallback((id: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: "deleted" } : d))
  }, [])

  const restoreDocument = useCallback((id: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: "ready" } : d))
  }, [])

  const addChatSession = useCallback((session: ChatSession) => {
    setChatSessions(prev => [session, ...prev])
  }, [])

  const addFlashcards = useCallback((cards: Flashcard[]) => {
    setFlashcards(prev => [...cards, ...prev])
  }, [])

  const deleteFlashcard = useCallback((id: string) => {
    setFlashcards(prev => prev.filter(card => card.id !== id))
  }, [])

  const updateFlashcardStatus = useCallback((id: string, status: Flashcard["status"]) => {
    setFlashcards(prev => prev.map(card => card.id === id ? { ...card, status } : card))
  }, [])

  const setFlashcardSelectedDocumentId = useCallback((id: string | "all") => {
    setFlashcardSelectedDocId(id)
  }, [])

  const generateFlashcardsFromDocument = useCallback((docId: string) => {
    const doc = documents.find(d => d.id === docId)
    if (!doc) return

    const now = Date.now()
    const topic = doc.subject || doc.name || "chủ đề"
    const tags = doc.tags.length > 0 ? doc.tags.join(", ") : null
    const generated: Flashcard[] = [
      {
        id: `flashcard-${now}-1`,
        documentId: doc.id,
        question: `Nội dung chính của tài liệu "${doc.name}" là gì?`,
        answer: doc.description
          ? `${doc.description}`
          : `Tài liệu này tập trung vào ${topic}.`,
        createdAt: new Date(),
      },
      {
        id: `flashcard-${now}-2`,
        documentId: doc.id,
        question: `Những khái niệm quan trọng cần nhớ trong tài liệu này là gì?`,
        answer: tags
          ? `Các khái niệm chính bao gồm: ${tags}.`
          : `Các khái niệm chính xoay quanh ${topic}.`,
        createdAt: new Date(),
      },
      {
        id: `flashcard-${now}-3`,
        documentId: doc.id,
        question: `Làm thế nào để áp dụng kiến thức này trong bài tập hoặc ôn tập?`,
        answer: `Sử dụng ý chính từ tài liệu để trả lời ví dụ, tóm tắt nội dung và lặp lại thường xuyên.`,
        createdAt: new Date(),
      },
    ]

    setFlashcards(prev => [...generated, ...prev])
    setFlashcardSelectedDocId(doc.id)
  }, [documents])

  const updateChatSession = useCallback((id: string, updates: Partial<ChatSession>) => {
    setChatSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [])

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u))
    setCurrentUser(prev => prev?.id === id ? { ...prev, ...updates } : prev)
  }, [])

  const updateUserStorageLimit = useCallback(async (id: string, storageLimitGb: number) => {
    if (!currentUser || !["admin", "sub-admin"].includes(currentUser.role)) {
      return { success: false, error: "Không có quyền cập nhật dung lượng." }
    }

    const target = users.find(user => user.id === id)
    if (!target) return { success: false, error: "Không tìm thấy người dùng." }
    if (target.role !== "user") return { success: false, error: "Chỉ được chỉnh dung lượng của tài khoản user." }

    try {
      const updatedUser = await updateUserStorageLimitApi(id, storageLimitGb)
      setUsers(prev => prev.map(user => user.id === id ? updatedUser : user))
      setCurrentUser(prev => prev?.id === id ? updatedUser : prev)
      setActivityLogs(prev => [{
        id: `log-${Date.now()}`,
        userId: currentUser.id,
        action: "Cập nhật giới hạn dung lượng",
        target: `${updatedUser.email}: ${formatBytes(updatedUser.storageLimit)}`,
        timestamp: new Date(),
      }, ...prev])
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Không thể cập nhật dung lượng." }
    }
  }, [currentUser, users])

  const toggleUserLock = useCallback((id: string) => {
    const target = users.find(u => u.id === id)
    if (!currentUser || !target) return { success: false, error: "Không tìm thấy tài khoản." }
    if (!["admin", "sub-admin"].includes(currentUser.role)) return { success: false, error: "Không có quyền." }
    if (currentUser.role === "sub-admin" && target.role === "admin") {
      return { success: false, error: "Sub-admin không được khóa tài khoản Admin." }
    }
    if (target.id === currentUser.id) return { success: false, error: "Không thể tự khóa tài khoản hiện tại." }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, isLocked: !u.isLocked, loginAttempts: 0 } : u))
    setActivityLogs(prev => [{
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      action: target.isLocked ? "Unlocked account" : "Locked account",
      target: target.email,
      timestamp: new Date(),
    }, ...prev])
    return { success: true }
  }, [currentUser, users])

  const resetUserPassword = useCallback((id: string, password: string) => {
    const target = users.find(u => u.id === id)
    if (!currentUser || !target) return { success: false, error: "Không tìm thấy tài khoản." }
    if (!["admin", "sub-admin"].includes(currentUser.role)) return { success: false, error: "Không có quyền." }
    if (currentUser.role === "sub-admin" && target.role === "admin") {
      return { success: false, error: "Sub-admin không được reset mật khẩu Admin." }
    }
    if (password.length < 8) return { success: false, error: "Mật khẩu phải có ít nhất 8 ký tự." }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, password, loginAttempts: 0 } : u))
    return { success: true }
  }, [currentUser, users])

  const deleteUserAccount = useCallback((id: string) => {
    const target = users.find(u => u.id === id)
    if (!currentUser || !target) return { success: false, error: "Không tìm thấy tài khoản." }
    if (!["admin", "sub-admin"].includes(currentUser.role)) return { success: false, error: "Không có quyền." }
    if (currentUser.role === "sub-admin" && target.role === "admin") {
      return { success: false, error: "Sub-admin không được xóa tài khoản Admin." }
    }
    if (target.id === currentUser.id) return { success: false, error: "Không thể tự xóa tài khoản hiện tại." }
    setUsers(prev => prev.filter(u => u.id !== id))
    setDocuments(prev => prev.map(d => d.uploadedBy === id ? { ...d, status: "deleted" } : d))
    return { success: true }
  }, [currentUser, users])

  const createSubAdminAccount = useCallback((email: string, password: string, displayName: string) => {
    if (currentUser?.role !== "admin") return { success: false, error: "Chỉ Admin mới có thể tạo tài khoản sub-admin." }
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: "Email này đã được đăng ký." }
    }
    if (password.length < 8) return { success: false, error: "Mật khẩu phải có ít nhất 8 ký tự." }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { success: false, error: "Mật khẩu phải chứa ít nhất 1 chữ cái và 1 số." }
    }
    const subAdmin: User = {
      id: `sub-admin-${Date.now()}`,
      email, displayName, password,
      role: "sub-admin", isLocked: false, emailVerified: true,
      createdAt: new Date(), loginAttempts: 0, lastActive: new Date(),
      storageUsed: 0, storageLimit: 1024 * 1024 * 1024,
    }
    setUsers(prev => [...prev, subAdmin])
    setActivityLogs(prev => [{
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      action: "Admin tạo tài khoản sub-admin",
      target: email,
      timestamp: new Date(),
    }, ...prev])
    return { success: true }
  }, [currentUser, users])

  const addCategory = useCallback((name: string, color: string) => {
    const cat: Category = { id: `cat-${Date.now()}`, name, color }
    setCategories(prev => [...prev, cat])
  }, [])

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id))
  }, [])

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ai-study-hub-language", nextLanguage)
      document.documentElement.lang = nextLanguage
    }
    setCurrentUser(prev => prev ? { ...prev, languagePreference: nextLanguage } : prev)

    if (currentUser) {
      void updateLanguagePreferenceApi(nextLanguage)
        .then(updatedUser => {
          setCurrentUser(updatedUser)
          setUsers(prev => prev.map(user => user.id === updatedUser.id ? updatedUser : user))
        })
        .catch(() => {
          // keep the local preference so the UI switch remains responsive
        })
    }
  }, [currentUser])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("ai-study-hub-language", language)
    document.documentElement.lang = language
  }, [language])

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev
      document.documentElement.classList.toggle("dark", next)
      return next
    })
  }, [])

  const updatePackagePrice = useCallback(async (tier: PackageTier, newPrice: number, adminPassword: string) => {
    if (currentUser?.role !== "admin") {
      return { success: false, error: "Chỉ Admin mới được chỉnh sửa giá gói." }
    }

    try {
      const updatedPlan = await updatePackagePriceApi(tier, newPrice, adminPassword)
      const updatedPrice = Number(updatedPlan.price)
      setPackagePrices(prev => prev.map(p => p.tier === tier ? { ...p, price: updatedPrice } : p))
      const tierName = tier === "2-4" ? "Gói 2-4 người" : "Gói 5+ người"
      setActivityLogs(prev => [{
        id: `log-${Date.now()}`,
        userId: currentUser.id,
        action: `Cập nhật giá ${tierName}`,
        target: `${updatedPrice.toLocaleString("vi-VN")}đ/tháng`,
        timestamp: new Date(),
      }, ...prev])
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Không thể cập nhật giá gói." }
    }
  }, [currentUser])

  const grantSubscription = useCallback((userId: string, tier: PackageTier, durationMonths: number) => {
    if (!currentUser || !["admin", "sub-admin"].includes(currentUser.role)) {
      return { success: false, error: "Không có quyền thực hiện." }
    }

    const targetUser = users.find(u => u.id === userId)
    if (!targetUser) return { success: false, error: "Không tìm thấy người dùng." }

    if (currentUser.role === "sub-admin" && targetUser.role === "admin") {
      return { success: false, error: "Sub-admin không thể cấp gói cho Admin." }
    }

    const expiresAt = tier === "free"
      ? undefined
      : new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000)

    setUsers(prev => prev.map(u => u.id === userId ? {
      ...u,
      subscriptionTier: tier,
      subscriptionExpiresAt: expiresAt
    } : u))

    if (currentUser.id === userId) {
      setCurrentUser(prev => prev ? {
        ...prev,
        subscriptionTier: tier,
        subscriptionExpiresAt: expiresAt
      } : prev)
    }

    const tierName = tier === "free" ? "Free" : tier === "2-4" ? "2-4 người" : "5+ người"
    setActivityLogs(prev => [{
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      action: `Cấp gói ${tierName} (${durationMonths} tháng)`,
      target: targetUser.email,
      timestamp: new Date(),
    }, ...prev])

    return { success: true }
  }, [currentUser, users])

  const buySubscription = useCallback((tier: PackageTier) => {
    if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }

    const expiresAt = tier === "free"
      ? undefined
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    setUsers(prev => prev.map(u => u.id === currentUser.id ? {
      ...u,
      subscriptionTier: tier,
      subscriptionExpiresAt: expiresAt
    } : u))

    setCurrentUser(prev => prev ? {
      ...prev,
      subscriptionTier: tier,
      subscriptionExpiresAt: expiresAt
    } : prev)

    const tierName = tier === "free" ? "Free" : tier === "2-4" ? "2-4 người" : "5+ người"
    setActivityLogs(prev => [{
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      action: `Đăng ký mua gói ${tierName}`,
      target: currentUser.email,
      timestamp: new Date(),
    }, ...prev])

    return { success: true }
  }, [currentUser])

  const createRoom = useCallback((roomId: string, password?: string) => {
    if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }

    const isPaid = currentUser.role === "admin" ||
                   currentUser.role === "sub-admin" ||
                   (currentUser.subscriptionTier &&
                    currentUser.subscriptionTier !== "free" &&
                    currentUser.subscriptionExpiresAt &&
                    new Date(currentUser.subscriptionExpiresAt).getTime() > Date.now())

    if (!isPaid) {
      return { success: false, error: "Vui lòng nâng cấp gói để có quyền tạo phòng học." }
    }

    if (!roomId.trim()) {
      return { success: false, error: "Mã phòng không được để trống." }
    }

    const trimmedId = roomId.trim().toUpperCase()

    if (rooms.some(r => r.id === trimmedId)) {
      return { success: false, error: "Mã phòng này đã tồn tại." }
    }

    const cap = currentUser.subscriptionTier === "2-4" ? 4 : 99

    const newRoom: StudyRoom = {
      id: trimmedId,
      password: password || undefined,
      hostId: currentUser.id,
      hostName: currentUser.displayName,
      capacity: cap,
      members: [
        { userId: currentUser.id, displayName: currentUser.displayName, joinedAt: new Date() }
      ],
      messages: [
        {
          id: `msg-sys-${Date.now()}`,
          senderId: "system",
          senderName: "Hệ thống",
          content: `Phòng học ${trimmedId} đã được tạo bởi ${currentUser.displayName}.`,
          timestamp: new Date()
        }
      ],
      createdAt: new Date()
    }

    setRooms(prev => [...prev, newRoom])
    setCurrentRoomId(trimmedId)

    setActivityLogs(prev => [{
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      action: "Tạo phòng học nhóm",
      target: trimmedId,
      timestamp: new Date(),
    }, ...prev])

    // Simulated mock member joining after 4 seconds
    setTimeout(() => {
      setRooms(prev => prev.map(r => {
        if (r.id === trimmedId) {
          const isUser2Host = r.hostId === "user-2"
          const simUser = isUser2Host
            ? { userId: "user-1", displayName: "Demo Student" }
            : { userId: "user-2", displayName: "AnhNV" }

          const joinMsg: RoomMessage = {
            id: `msg-sys-sim-${Date.now()}`,
            senderId: "system",
            senderName: "Hệ thống",
            content: `${simUser.displayName} đã tham gia phòng.`,
            timestamp: new Date()
          }

          const chatMsg: RoomMessage = {
            id: `msg-sim-${Date.now()}`,
            senderId: simUser.userId,
            senderName: simUser.displayName,
            content: `Chào chủ phòng! Mình xin phép join cùng học nhé. Cậu định thảo luận môn gì thế?`,
            timestamp: new Date()
          }

          return {
            ...r,
            members: [...r.members, { userId: simUser.userId, displayName: simUser.displayName, joinedAt: new Date() }],
            messages: [...r.messages, joinMsg, chatMsg]
          }
        }
        return r
      }))
    }, 4000)

    return { success: true }
  }, [currentUser, rooms])

  const joinRoom = useCallback((roomId: string, password?: string) => {
    if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }
    if (!roomId.trim()) return { success: false, error: "Mã phòng không được để trống." }

    const targetRoomId = roomId.trim().toUpperCase()
    const targetRoom = rooms.find(r => r.id === targetRoomId)

    if (!targetRoom) {
      return { success: false, error: "Phòng học không tồn tại." }
    }

    if (targetRoom.password && targetRoom.password !== password) {
      return { success: false, error: "Mật khẩu phòng không đúng." }
    }

    const isMember = targetRoom.members.some(m => m.userId === currentUser.id)
    if (!isMember) {
      if (targetRoom.members.length >= targetRoom.capacity) {
        return { success: false, error: "Phòng học đã đầy." }
      }

      const updatedMembers = [
        ...targetRoom.members,
        { userId: currentUser.id, displayName: currentUser.displayName, joinedAt: new Date() }
      ]

      const joinMsg: RoomMessage = {
        id: `msg-sys-${Date.now()}`,
        senderId: "system",
        senderName: "Hệ thống",
        content: `${currentUser.displayName} đã tham gia phòng.`,
        timestamp: new Date()
      }

      setRooms(prev => prev.map(r => r.id === targetRoomId ? {
        ...r,
        members: updatedMembers,
        messages: [...r.messages, joinMsg]
      } : r))
    }

    setCurrentRoomId(targetRoomId)

    setActivityLogs(prev => [{
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      action: "Tham gia phòng học nhóm",
      target: targetRoomId,
      timestamp: new Date(),
    }, ...prev])

    setTimeout(() => {
      setRooms(prev => prev.map(r => {
        if (r.id === targetRoomId) {
          const hostIsSelf = r.hostId === currentUser.id
          if (!hostIsSelf) {
            const simulatedMsg: RoomMessage = {
              id: `msg-sim-${Date.now()}`,
              senderId: r.hostId,
              senderName: r.hostName,
              content: `Chào ${currentUser.displayName}! Chào mừng bạn vào phòng cùng thảo luận nhé. Bạn cần hỗ trợ gì không?`,
              timestamp: new Date()
            }
            return {
              ...r,
              messages: [...r.messages, simulatedMsg]
            }
          }
        }
        return r
      }))
    }, 2000)

    return { success: true }
  }, [currentUser, rooms])

  const leaveRoom = useCallback(() => {
    if (!currentUser || !currentRoomId) return

    const targetRoomId = currentRoomId
    const targetRoom = rooms.find(r => r.id === targetRoomId)
    if (!targetRoom) return

    const isHost = targetRoom.hostId === currentUser.id

    if (isHost) {
      closeRoom()
      return
    }

    const updatedMembers = targetRoom.members.filter(m => m.userId !== currentUser.id)
    const leaveMsg: RoomMessage = {
      id: `msg-sys-${Date.now()}`,
      senderId: "system",
      senderName: "Hệ thống",
      content: `${currentUser.displayName} đã rời phòng.`,
      timestamp: new Date()
    }

    setRooms(prev => prev.map(r => r.id === targetRoomId ? {
      ...r,
      members: updatedMembers,
      messages: [...r.messages, leaveMsg]
    } : r))

    setCurrentRoomId(null)

    setActivityLogs(prev => [{
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      action: "Rời phòng học nhóm",
      target: targetRoomId,
      timestamp: new Date(),
    }, ...prev])
  }, [currentUser, currentRoomId, rooms])

  const closeRoom = useCallback(() => {
    if (!currentUser || !currentRoomId) return

    const targetRoomId = currentRoomId
    const targetRoom = rooms.find(r => r.id === targetRoomId)
    if (!targetRoom || targetRoom.hostId !== currentUser.id) return

    setRooms(prev => prev.filter(r => r.id !== targetRoomId))
    setCurrentRoomId(null)

    setActivityLogs(prev => [{
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      action: "Đóng phòng học nhóm (Host)",
      target: targetRoomId,
      timestamp: new Date(),
    }, ...prev])
  }, [currentUser, currentRoomId, rooms])

  const sendRoomMessage = useCallback((content: string) => {
    if (!currentUser || !currentRoomId || !content.trim()) return

    const newMsg: RoomMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      content: content.trim(),
      timestamp: new Date()
    }

    setRooms(prev => prev.map(r => r.id === currentRoomId ? {
      ...r,
      messages: [...r.messages, newMsg]
    } : r))

    const lowerContent = content.toLowerCase()
    if (lowerContent.includes("chào") || lowerContent.includes("hello") || lowerContent.includes("hi")) {
      setTimeout(() => {
        setRooms(prev => prev.map(r => {
          if (r.id === currentRoomId) {
            const hostIsSelf = r.hostId === currentUser.id
            const responderId = hostIsSelf ? (r.members.find(m => m.userId !== currentUser.id)?.userId || "user-2") : r.hostId
            const responderName = hostIsSelf ? (r.members.find(m => m.userId !== currentUser.id)?.displayName || "AnhNV") : r.hostName

            const replyMsg: RoomMessage = {
              id: `msg-sim-${Date.now()}`,
              senderId: responderId,
              senderName: responderName,
              content: `Chào ${currentUser.displayName}! Hôm nay bạn định ôn tập nội dung gì thế?`,
              timestamp: new Date()
            }
            return { ...r, messages: [...r.messages, replyMsg] }
          }
          return r
        }))
      }, 2500)
    } else if (lowerContent.includes("bài tập") || lowerContent.includes("ôn") || lowerContent.includes("tài liệu")) {
      setTimeout(() => {
        setRooms(prev => prev.map(r => {
          if (r.id === currentRoomId) {
            const hostIsSelf = r.hostId === currentUser.id
            const responderId = hostIsSelf ? (r.members.find(m => m.userId !== currentUser.id)?.userId || "user-2") : r.hostId
            const responderName = hostIsSelf ? (r.members.find(m => m.userId !== currentUser.id)?.displayName || "AnhNV") : r.hostName

            const replyMsg: RoomMessage = {
              id: `msg-sim-${Date.now()}`,
              senderId: responderId,
              senderName: responderName,
              content: `Mình có tài liệu giải tích khá hay ở phần Tài liệu của tôi đó, bạn đã xem thử chưa?`,
              timestamp: new Date()
            }
            return { ...r, messages: [...r.messages, replyMsg] }
          }
          return r
        }))
      }, 3000)
    }
  }, [currentUser, currentRoomId])

  return (
    <AppContext.Provider value={{
      currentUser, users, documents, categories, chatSessions, activeChatId,
      activityLogs, flashcards, flashcardSelectedDocumentId, isDarkMode, language, showAuthModal, authModalTab, currentPage,
      packagePrices, rooms, currentRoomId,
      login, register, logout, openAuthModal, closeAuthModal, setCurrentPage,
      addDocument, updateDocument, deleteDocument, restoreDocument,
      addChatSession, updateChatSession, setActiveChatId,
      updateUser, updateUserStorageLimit, toggleUserLock, resetUserPassword, deleteUserAccount, createSubAdminAccount, addCategory, deleteCategory,
      addFlashcards, generateFlashcardsFromDocument, setFlashcardSelectedDocumentId,
      toggleDarkMode, setLanguage,
      updatePackagePrice, grantSubscription, buySubscription, createRoom, joinRoom, leaveRoom, closeRoom, sendRoomMessage,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB"
}

export function getAIMockResponse(question: string, docName?: string): string {
  const q = question.toLowerCase()
  if (q.includes("tóm tắt") || q.includes("summary")) {
    return `📝 **Tóm tắt ${docName ? `"${docName}"` : "tài liệu"}:**\n\nTài liệu này bao gồm các nội dung chính:\n\n1. **Phần mở đầu** — Giới thiệu tổng quan về chủ đề.\n2. **Nội dung chính** — Phân tích chi tiết với ví dụ minh họa.\n3. **Ứng dụng** — Cách áp dụng kiến thức vào thực tiễn.\n4. **Kết luận** — Tổng hợp điểm mấu chốt.\n\nBạn muốn tôi giải thích sâu hơn phần nào?`
  }
  return `🤖 **Phân tích câu hỏi của bạn:**\n\n"${question.slice(0, 60)}${question.length > 60 ? "..." : ""}"\n\nDựa trên ${docName ? `tài liệu **"${docName}"**` : "hệ thống kiến thức"}:\n\n1. **Phân tích vấn đề**: Cần xem xét các yếu tố ảnh hưởng\n2. **Hướng tiếp cận**: Áp dụng phương pháp từ đơn giản đến phức tạp\n3. **Kết quả mong đợi**: Hiểu rõ vấn đề và áp dụng thực tế\n\n💡 *Tip: Upload tài liệu cụ thể để tôi trả lời chính xác hơn!*`
}
