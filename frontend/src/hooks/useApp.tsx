"use client"

/**
 * useApp.tsx — thin orchestration layer
 *
 * This file owns only:
 *  - The AppContext definition + AppState type
 *  - AppProvider, which wires the domain hooks together
 *  - Cross-domain actions (logout, setLanguage) that span multiple hooks
 *  - The useApp() consumer hook
 *
 * Each domain's state/logic lives in its own hook:
 *  useActivityLogs      → activityLogs
 *  useUIState           → darkMode, language, page, auth modal
 *  useAuthState         → currentUser, login, register
 *  useDocumentState     → documents, categories  (needs currentUser)
 *  useChatState         → chatSessions, activeChatId
 *  useFlashcardState    → flashcards
 *  useAdminState        → users list, admin actions
 *  useSubscriptionState → packagePrices, subscription actions
 *  useGroupChatState    → group chats
 */

import React, { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { updateLanguagePreferenceApi } from "@/services/api/auth"
import type {
  Language, PackagePrice, PackageTier, User,
  Category, ChatSession, ChatMessage, Document, Folder, Flashcard, ActivityLog, GroupChat, GroupInvitation, GroupInvitationCandidate,
} from "@/states/types"

import { useActivityLogs } from "./useActivityLogs"
import { useUIState } from "./useUIState"
import { useAuthState } from "./useAuthState"
import { useDocumentState } from "./useDocumentState"
import { useChatState } from "./useChatState"
import { useFlashcardState } from "./useFlashcardState"
import { useAdminState } from "./useAdminState"
import { useSubscriptionState } from "./useSubscriptionState"
import { useGroupChatState } from "./useGroupChatState"

// ─── Public contract ────────────────────────────────────────────────────────

export interface AppState {
  // ── Auth ──────────────────────────────────────────────────────────────────
  currentUser: User | null
  /** true while the initial session-restore call is in flight — use this to
   *  avoid flashing a redirect before we know whether the user is logged in */
  authLoading: boolean
  showAuthModal: boolean
  authModalTab: "login" | "register" | "forgot"
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string, confirmPassword: string, displayName: string) => Promise<{ success: boolean; error?: string }>
  /** Đăng nhập/đăng ký bằng Google — idToken là JWT từ Google Identity Services */
  loginWithGoogle: (idToken: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateOwnProfile: (displayName: string) => Promise<{ success: boolean; error?: string }>
  changeOwnPassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>
  openAuthModal: (tab?: "login" | "register" | "forgot") => void
  closeAuthModal: () => void

  // ── UI ────────────────────────────────────────────────────────────────────
  isDarkMode: boolean
  language: Language
  currentPage: "home" | "documents" | "chat" | "groups" | "cloud" | "profile" | "admin" | "trash" | "flashcards"
  toggleDarkMode: () => void
  setLanguage: (language: Language) => void
  setCurrentPage: (page: AppState["currentPage"]) => void

  // ── Documents ──────────────────────────────────────────────────────────────
  documents: Document[]
  categories: Category[]
  folders: Folder[]
  addDocument: (doc: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  /** Upload file thật lên backend — thay thế simulateUpload (BR-013 đến BR-018) */
  uploadDocument: (
    file: File,
    subject: string,
    visibility?: "private" | "public",
    folderId?: string | null,
    tags?: string,
  ) => Promise<{ success: boolean; error?: string }>
  /** Soft-delete tài liệu và gọi DELETE /api/documents/{id} (BR-022) */
  deleteDocument: (id: string) => void
  /** Khôi phục từ Trash và gọi POST /api/documents/{id}/restore (BR-023) */
  restoreDocument: (id: string) => void
  /** FR-24: Xóa vĩnh viễn 1 file đang ở thùng rác — DELETE /api/documents/{id}/permanent */
  permanentDeleteDocument: (id: string) => Promise<{ success: boolean; error?: string }>
  /** FR-24: Dọn sạch toàn bộ thùng rác — DELETE /api/documents/trash/empty */
  emptyTrash: () => Promise<{ success: boolean; error?: string }>
  /** Đổi visibility và gọi PUT /api/documents/{id}/visibility (BR-018) */
  changeDocumentVisibility: (id: string, isPublic: boolean) => Promise<{ success: boolean; error?: string }>
  /** Tải xuống file và tăng downloadCount qua POST /api/documents/{id}/download (BR-021) */
  downloadDocument: (id: string) => void
  addCategory: (name: string, color: string) => void
  deleteCategory: (id: string) => void

  // FR-23: Folder actions — async, gọi API thật
  /** POST /api/folders — tạo thư mục (BR-080, BR-082, BR-083, BR-086) */
  createFolder: (
    name: string,
    parentId?: string | null,
    subject?: string,
  ) => Promise<{ success: boolean; folder?: Folder; error?: string }>
  /** PUT /api/folders/{id} — đổi tên + cập nhật môn học (BR-086) */
  renameFolder: (
    id: string,
    name: string,
    subject?: string,
  ) => Promise<{ success: boolean; error?: string }>
  /** DELETE /api/folders/{id} — cascade con (BR-084) + docs về root (BR-085) */
  deleteFolder: (id: string) => Promise<{ success: boolean; error?: string }>
  /** PUT /api/folders/{id}/move — di chuyển thư mục (BR-087) */
  moveFolder: (
    folderId: string,
    targetParentId: string | null,
  ) => Promise<{ success: boolean; error?: string }>
  /** PATCH /api/documents/{id} — di chuyển tài liệu vào thư mục (BR-085) */
  moveDocumentToFolder: (
    docId: string,
    folderId: string | null,
  ) => Promise<{ success: boolean; error?: string }>

  // ── Chat ──────────────────────────────────────────────────────────────────
  chatSessions: ChatSession[]
  activeChatId: string | null
  addChatSession: (session: ChatSession) => void
  updateChatSession: (id: string, updates: Partial<ChatSession>) => void
  setActiveChatId: (id: string | null) => void
  /** POST /api/v1/chat/sessions — tạo session mới trên backend, gắn kèm documentId */
  createChatSession: (documentId?: string | null) => Promise<ChatSession>
  /** POST /api/v1/chat/sessions/{sessionId}/messages — lưu 1 tin nhắn vào backend */
  persistChatMessage: (sessionId: string, role: "user" | "assistant", content: string) => Promise<ChatMessage>
  /** DELETE /api/v1/chat/sessions/{sessionId} */
  deleteChatSession: (id: string) => Promise<void>
  /**
   * Tài liệu đang chờ được chọn sẵn khi mở trang Chat (đến từ nút "Chat AI" trên 1 tài liệu cụ thể).
   * Trang Chat đọc giá trị này khi mount rồi tự clear để không ảnh hưởng các lần vào chat sau.
   */
  pendingChatDocumentId: string | null
  setPendingChatDocumentId: (id: string | null) => void
  /** Mở trang Chat với 1 tài liệu cụ thể đã được chọn sẵn (nút "Chat AI" trên từng file) */
  openChatWithDocument: (documentId: string) => void

  // ── Group chats ───────────────────────────────────────────────────────────
  groups: GroupChat[]
  activeGroupId: string | null
  groupsLoading: boolean
  groupLoadError: string | null
  pendingGroupInvitations: GroupInvitation[]
  groupInvitationsLoading: boolean
  groupInvitationsError: string | null
  groupCreateLimit: number
  groupJoinLimit: number
  setActiveGroupId: (id: string | null) => void
  loadGroups: () => Promise<{ success: boolean; error?: string }>
  loadPendingGroupInvitations: () => Promise<{ success: boolean; error?: string }>
  respondGroupInvitation: (groupId: string, accept: boolean) => Promise<{ success: boolean; error?: string }>
  createGroup: (name: string, description: string | undefined, password: string, groupCode?: string) => Promise<{ success: boolean; error?: string }>
  joinGroup: (groupCode: string, password: string) => Promise<{ success: boolean; error?: string }>
  searchGroupInvitationUser: (groupId: string, email: string) => Promise<{ success: boolean; user?: GroupInvitationCandidate; error?: string }>
  inviteGroupMemberByEmail: (groupId: string, email: string) => Promise<{ success: boolean; error?: string }>
  leaveGroup: (groupId: string) => Promise<{ success: boolean; error?: string }>
  kickGroupMember: (groupId: string, targetUserId: string, groupPassword: string) => Promise<{ success: boolean; error?: string }>
  deleteGroup: (groupId: string, password: string) => Promise<{ success: boolean; error?: string }>
  getGroupPassword: (groupId: string) => Promise<{ success: boolean; password?: string; error?: string }>
  updateGroupMuted: (groupId: string, muted: boolean) => Promise<{ success: boolean; error?: string }>
  updateGroupPinned: (groupId: string, pinned: boolean) => Promise<{ success: boolean; error?: string }>
  sendGroupMessage: (groupId: string, content: string) => Promise<{ success: boolean; error?: string }>
  shareGroupDocument: (groupId: string, document: Document) => Promise<{ success: boolean; error?: string }>
  shareGroupImage: (groupId: string, file: File) => Promise<{ success: boolean; error?: string }>
  downloadGroupDocument: (groupId: string, documentId: string) => Promise<{ success: boolean; error?: string }>
  exportGroupChat: (groupId: string) => Promise<{ success: boolean; error?: string }>
  reportGroup: (groupId: string, reason: string) => Promise<{ success: boolean; error?: string }>
  generateGroupCode: () => string

  // ── Flashcards ────────────────────────────────────────────────────────────
  flashcards: Flashcard[]
  flashcardSelectedDocumentId: string | "all"
  /** Tạo flashcard thủ công qua POST /api/flashcards (BR-037) */
  addFlashcards: (
    cards: { question: string; answer: string; documentId?: string }[],
  ) => Promise<{ success: boolean; message?: string }>
  /** Xoá flashcard qua DELETE /api/flashcards/{id} (BR-040) */
  deleteFlashcard: (id: string) => Promise<{ success: boolean; message?: string }>
  /** Sửa câu hỏi/đáp án qua PATCH /api/flashcards/{id} */
  updateFlashcard: (
    id: string,
    updates: { question: string; answer: string },
  ) => Promise<{ success: boolean; message?: string }>
  /** Cập nhật status qua PATCH /api/flashcards/{id}/status (BR-038) */
  updateFlashcardStatus: (id: string, status: Flashcard["status"]) => void
  /** AI tạo flashcard qua POST /api/flashcards/generate (BR-036), không fallback mock khi lỗi */
  generateFlashcardsFromDocument: (
    docId: string,
    count?: number,
  ) => Promise<{ success: boolean; count: number; message?: string }>
  /** Load flashcard từ API theo document (BR-039) */
  loadFlashcardsForDocument: (docId: string) => Promise<{ success: boolean; message?: string }>
  /** Load TOÀN BỘ flashcard của user (mọi document), dùng khi mount app và khi bấm "Làm mới" ở chế độ "Tất cả tài liệu" */
  loadAllFlashcards: () => Promise<{ success: boolean; message?: string }>
  /** Xoá TOÀN BỘ flashcard của một tài liệu cụ thể (nút "Làm mới") */
  deleteAllFlashcardsForDocument: (docId: string) => Promise<{ success: boolean; message?: string }>
  setFlashcardSelectedDocumentId: (id: string | "all") => void

  // ── Admin ─────────────────────────────────────────────────────────────────
  users: User[]
  activityLogs: ActivityLog[]
  activityLogsLoading: boolean
  activityLogsError: string | null
  loadActivityLogs: () => Promise<{ success: boolean; error?: string }>
  updateUser: (id: string, updates: Partial<User>) => void
  updateUserStorageLimit: (id: string, storageLimitGb: number, adminPassword: string) => Promise<{ success: boolean; error?: string }>
  toggleUserLock: (id: string, adminPassword: string) => Promise<{ success: boolean; error?: string }>
  resetUserPassword: (id: string, password: string, adminPassword: string) => Promise<{ success: boolean; error?: string }>
  deleteUserAccount: (id: string, adminPassword: string) => Promise<{ success: boolean; error?: string }>
  createSubAdminAccount: (email: string, password: string, displayName: string, adminPassword: string) => Promise<{ success: boolean; error?: string }>

  // ── Subscription ──────────────────────────────────────────────────────────
  packagePrices: PackagePrice[]
  updatePackagePrice: (tier: PackageTier | string, newPrice: number, adminPassword: string) => Promise<{ success: boolean; error?: string }>
  /** Cấp gói qua POST /api/admin/users/{userId}/subscription (BR-063) */
  grantSubscription: (userId: string, tier: PackageTier, durationMonths: number, adminPassword: string) => Promise<{ success: boolean; error?: string }>
  buySubscription: (tier: PackageTier) => { success: boolean; error?: string }
}

// ─── Context ────────────────────────────────────────────────────────────────

const AppContext = createContext<AppState | null>(null)

// ─── Provider ───────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  // ── 1. Leaf hooks với không có deps ────────────────────────────────────
  const ui = useUIState()
  const [pendingChatDocumentId, setPendingChatDocumentId] = useState<string | null>(null)

  const routeAfterAuthentication = useCallback((user: User) => {
    if (user.role === "admin" || user.role === "sub-admin") {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("admin-section", "overview")
      }
      ui.setCurrentPage("admin")
    }
  }, [ui.setCurrentPage])

  // ── 2. Auth (cần ui setters để đồng bộ language & đóng modal) ──────────
  const auth = useAuthState({
    setLanguageState: ui.setLanguageState,
    closeAuthModal: ui.closeAuthModal,
    onAuthenticated: routeAfterAuthentication,
  })
  const logs = useActivityLogs(auth.currentUser)

  // ── 3. Documents (cần currentUser để load và upload) ────────────────────
  const docs = useDocumentState({
    currentUser: auth.currentUser,
    setCurrentUser: auth.setCurrentUser,
  })

  // ── 3b. Chat (cần currentUser để load lịch sử chat từ backend) ─────────
  const chat = useChatState({ currentUser: auth.currentUser })

  const openChatWithDocument = useCallback(
    (documentId: string) => {
      setPendingChatDocumentId(documentId)
      chat.setActiveChatId(null)
      ui.setCurrentPage("chat")
    },
    [chat, ui]
  )

  // ── 4. Flashcards ────────────────────────────────────────────────────────
  const flashcards = useFlashcardState()

  // ── 5. Admin (cần currentUser + cross-domain setters) ──────────────────
  const admin = useAdminState({
    currentUser: auth.currentUser,
    setCurrentUser: auth.setCurrentUser,
    setDocuments: docs.setDocuments,
    addLog: logs.addLog,
  })

  // ── 6. Subscription (cần user list + cross-domain setters) ─────────────
  const subscription = useSubscriptionState({
    currentUser: auth.currentUser,
    setCurrentUser: auth.setCurrentUser,
    users: admin.users,
    setUsers: admin.setUsers,
    addLog: logs.addLog,
  })

  const groupChat = useGroupChatState({ currentUser: auth.currentUser })

  // ─── Cross-domain actions ───────────────────────────────────────────────

  const logout = useCallback(() => {
    auth.logoutUser()
    chat.setActiveChatId(null)
    ui.setCurrentPage("home")
  }, [auth, chat, ui])

  const setLanguage = useCallback(
    (nextLanguage: Language) => {
      ui.setLanguageState(nextLanguage)
      auth.setCurrentUser(prev =>
        prev ? { ...prev, languagePreference: nextLanguage } : prev,
      )

      if (auth.currentUser) {
        void updateLanguagePreferenceApi(nextLanguage)
          .then(updatedUser => {
            auth.setCurrentUser(updatedUser)
            admin.setUsers(prev =>
              prev.map(u => (u.id === updatedUser.id ? updatedUser : u)),
            )
          })
          .catch(() => {
            // keep the local preference so the UI switch remains responsive
          })
      }
    },
    [ui, auth, admin],
  )

  // ─── Compose context value ──────────────────────────────────────────────

  return (
    <AppContext.Provider
      value={{
        // Auth
        currentUser: auth.currentUser,
        authLoading: auth.authLoading,
        showAuthModal: ui.showAuthModal,
        authModalTab: ui.authModalTab,
        login: auth.login,
        register: auth.register,
        loginWithGoogle: auth.loginWithGoogle,
        logout,
        updateOwnProfile: auth.updateOwnProfile,
        changeOwnPassword: auth.changeOwnPassword,
        openAuthModal: ui.openAuthModal,
        closeAuthModal: ui.closeAuthModal,

        // UI
        isDarkMode: ui.isDarkMode,
        language: ui.language,
        currentPage: ui.currentPage,
        toggleDarkMode: ui.toggleDarkMode,
        setLanguage,
        setCurrentPage: ui.setCurrentPage,

        // Documents
        documents: docs.documents,
        categories: docs.categories,
        folders: docs.folders,
        addDocument: docs.addDocument,
        updateDocument: docs.updateDocument,
        uploadDocument: docs.uploadDocument,
        deleteDocument: docs.deleteDocument,
        restoreDocument: docs.restoreDocument,
        permanentDeleteDocument: docs.permanentDeleteDocument,
        emptyTrash: docs.emptyTrash,
        changeDocumentVisibility: docs.changeDocumentVisibility,
        downloadDocument: docs.downloadDocument,
        addCategory: docs.addCategory,
        deleteCategory: docs.deleteCategory,
        // FR-23: folder actions (async, API-backed)
        createFolder: docs.createFolder,
        renameFolder: docs.renameFolder,
        deleteFolder: docs.deleteFolder,
        moveFolder: docs.moveFolder,
        moveDocumentToFolder: docs.moveDocumentToFolder,

        // Chat
        chatSessions: chat.chatSessions,
        activeChatId: chat.activeChatId,
        addChatSession: chat.addChatSession,
        updateChatSession: chat.updateChatSession,
        setActiveChatId: chat.setActiveChatId,
        createChatSession: chat.createChatSession,
        persistChatMessage: chat.persistChatMessage,
        deleteChatSession: chat.deleteChatSession,
        pendingChatDocumentId,
        setPendingChatDocumentId,
        openChatWithDocument,

        // Group chats
        groups: groupChat.groups,
        activeGroupId: groupChat.activeGroupId,
        groupsLoading: groupChat.groupsLoading,
        groupLoadError: groupChat.groupLoadError,
        pendingGroupInvitations: groupChat.pendingGroupInvitations,
        groupInvitationsLoading: groupChat.groupInvitationsLoading,
        groupInvitationsError: groupChat.groupInvitationsError,
        groupCreateLimit: groupChat.groupCreateLimit,
        groupJoinLimit: groupChat.groupJoinLimit,
        setActiveGroupId: groupChat.setActiveGroupId,
        loadGroups: groupChat.loadGroups,
        loadPendingGroupInvitations: groupChat.loadPendingGroupInvitations,
        respondGroupInvitation: groupChat.respondGroupInvitation,
        createGroup: groupChat.createGroup,
        joinGroup: groupChat.joinGroup,
        searchGroupInvitationUser: groupChat.searchGroupInvitationUser,
        inviteGroupMemberByEmail: groupChat.inviteGroupMemberByEmail,
        leaveGroup: groupChat.leaveGroup,
        kickGroupMember: groupChat.kickGroupMember,
        deleteGroup: groupChat.deleteGroup,
        getGroupPassword: groupChat.getGroupPassword,
        updateGroupMuted: groupChat.updateGroupMuted,
        updateGroupPinned: groupChat.updateGroupPinned,
        sendGroupMessage: groupChat.sendGroupMessage,
        shareGroupDocument: groupChat.shareGroupDocument,
        shareGroupImage: groupChat.shareGroupImage,
        downloadGroupDocument: groupChat.downloadGroupDocument,
        exportGroupChat: groupChat.exportGroupChat,
        reportGroup: groupChat.reportGroup,
        generateGroupCode: groupChat.generateGroupCode,

        // Flashcards
        flashcards: flashcards.flashcards,
        flashcardSelectedDocumentId: flashcards.flashcardSelectedDocumentId,
        addFlashcards: flashcards.addFlashcards,
        deleteFlashcard: flashcards.deleteFlashcard,
        updateFlashcard: flashcards.updateFlashcard,
        updateFlashcardStatus: flashcards.updateFlashcardStatus,
        generateFlashcardsFromDocument: flashcards.generateFlashcardsFromDocument,
        loadFlashcardsForDocument: flashcards.loadFlashcardsForDocument,
        loadAllFlashcards: flashcards.loadAllFlashcards,
        deleteAllFlashcardsForDocument: flashcards.deleteAllFlashcardsForDocument,
        setFlashcardSelectedDocumentId: flashcards.setFlashcardSelectedDocumentId,

        // Admin
        users: admin.users,
        activityLogs: logs.activityLogs,
        activityLogsLoading: logs.activityLogsLoading,
        activityLogsError: logs.activityLogsError,
        loadActivityLogs: logs.loadActivityLogs,
        updateUser: admin.updateUser,
        updateUserStorageLimit: admin.updateUserStorageLimit,
        toggleUserLock: admin.toggleUserLock,
        resetUserPassword: admin.resetUserPassword,
        deleteUserAccount: admin.deleteUserAccount,
        createSubAdminAccount: admin.createSubAdminAccount,

        // Subscription
        packagePrices: subscription.packagePrices,
        updatePackagePrice: subscription.updatePackagePrice,
        grantSubscription: subscription.grantSubscription,
        buySubscription: subscription.buySubscription,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// ─── Consumer hook ───────────────────────────────────────────────────────────

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
