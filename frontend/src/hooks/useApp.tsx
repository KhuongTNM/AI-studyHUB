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
 *  useActivityLogs   → activityLogs
 *  useUIState        → darkMode, language, page, auth modal
 *  useAuthState      → currentUser, login, register
 *  useDocumentState  → documents, categories
 *  useChatState      → chatSessions, activeChatId
 *  useFlashcardState → flashcards
 *  useAdminState     → users list, admin actions
 *  useSubscriptionState → packagePrices, subscription actions
 *  useStudyRoomState → rooms
 */

import React, { createContext, useCallback, useContext, type ReactNode } from "react"
import { updateLanguagePreferenceApi } from "@/services/api/auth"
import type { Language, PackagePrice, PackageTier, StudyRoom, User, Category, ChatSession, Document, Flashcard, ActivityLog } from "@/states/types"

import { useActivityLogs } from "./useActivityLogs"
import { useUIState } from "./useUIState"
import { useAuthState } from "./useAuthState"
import { useDocumentState } from "./useDocumentState"
import { useChatState } from "./useChatState"
import { useFlashcardState } from "./useFlashcardState"
import { useAdminState } from "./useAdminState"
import { useSubscriptionState } from "./useSubscriptionState"
import { useStudyRoomState } from "./useStudyRoomState"
import { RoomMessage } from "@/states/types"

// ─── Public contract ────────────────────────────────────────────────────────

export interface AppState {
  // ── Auth ──────────────────────────────────────────────────────────────────
  currentUser: User | null
  showAuthModal: boolean
  authModalTab: "login" | "register" | "forgot"
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  openAuthModal: (tab?: "login" | "register" | "forgot") => void
  closeAuthModal: () => void

  // ── UI ────────────────────────────────────────────────────────────────────
  isDarkMode: boolean
  language: Language
  currentPage: "home" | "documents" | "chat" | "cloud" | "profile" | "admin" | "trash" | "flashcards"
  toggleDarkMode: () => void
  setLanguage: (language: Language) => void
  setCurrentPage: (page: AppState["currentPage"]) => void

  // ── Documents ─────────────────────────────────────────────────────────────
  documents: Document[]
  categories: Category[]
  addDocument: (doc: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  deleteDocument: (id: string) => void
  restoreDocument: (id: string) => void
  addCategory: (name: string, color: string) => void
  deleteCategory: (id: string) => void

  // ── Chat ──────────────────────────────────────────────────────────────────
  chatSessions: ChatSession[]
  activeChatId: string | null
  addChatSession: (session: ChatSession) => void
  updateChatSession: (id: string, updates: Partial<ChatSession>) => void
  setActiveChatId: (id: string | null) => void

  // ── Flashcards ────────────────────────────────────────────────────────────
  flashcards: Flashcard[]
  flashcardSelectedDocumentId: string | "all"
  addFlashcards: (cards: Flashcard[]) => void
  deleteFlashcard: (id: string) => void
  updateFlashcardStatus: (id: string, status: Flashcard["status"]) => void
  generateFlashcardsFromDocument: (docId: string) => void
  setFlashcardSelectedDocumentId: (id: string | "all") => void

  // ── Admin ─────────────────────────────────────────────────────────────────
  users: User[]
  activityLogs: ActivityLog[]
  updateUser: (id: string, updates: Partial<User>) => void
  updateUserStorageLimit: (id: string, storageLimitGb: number) => Promise<{ success: boolean; error?: string }>
  toggleUserLock: (id: string) => Promise<{ success: boolean; error?: string }>
  resetUserPassword: (id: string, password: string) => Promise<{ success: boolean; error?: string }>
  deleteUserAccount: (id: string) => { success: boolean; error?: string }
  createSubAdminAccount: (email: string, password: string, displayName: string) => { success: boolean; error?: string }

  // ── Subscription ──────────────────────────────────────────────────────────
  packagePrices: PackagePrice[]
  updatePackagePrice: (tier: PackageTier, newPrice: number, adminPassword: string) => Promise<{ success: boolean; error?: string }>
  grantSubscription: (userId: string, tier: PackageTier, durationMonths: number) => { success: boolean; error?: string }
  buySubscription: (tier: PackageTier) => { success: boolean; error?: string }

  // ── Study Rooms ───────────────────────────────────────────────────────────
  rooms: StudyRoom[]
  currentRoomId: string | null
  createRoom: (roomId: string, password?: string) => { success: boolean; error?: string }
  joinRoom: (roomId: string, password?: string) => { success: boolean; error?: string }
  leaveRoom: () => void
  closeRoom: () => void
  sendRoomMessage: (content: string) => void
}

// ─── Context ────────────────────────────────────────────────────────────────

const AppContext = createContext<AppState | null>(null)

// ─── Provider ───────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  // ── 1. Leaf hooks with no deps ─────────────────────────────────────────
  const logs = useActivityLogs()
  const ui = useUIState()
  const docs = useDocumentState()
  const chat = useChatState()

  // ── 2. Auth (needs ui setters so login/register can sync language & close modal) ──
  const auth = useAuthState({
    setLanguageState: ui.setLanguageState,
    closeAuthModal: ui.closeAuthModal,
  })

  // ── 3. Flashcards (needs documents for generation) ─────────────────────
  const flashcards = useFlashcardState({ documents: docs.documents })

  // ── 4. Admin (needs currentUser + cross-domain setters) ────────────────
  const admin = useAdminState({
    currentUser: auth.currentUser,
    setCurrentUser: auth.setCurrentUser,
    setDocuments: docs.setDocuments,
    addLog: logs.addLog,
  })

  // ── 5. Subscription (needs user list + cross-domain setters) ───────────
  const subscription = useSubscriptionState({
    currentUser: auth.currentUser,
    setCurrentUser: auth.setCurrentUser,
    users: admin.users,
    setUsers: admin.setUsers,
    addLog: logs.addLog,
  })

  // ── 6. Study rooms (needs currentUser for auth checks) ─────────────────
  const studyRoom = useStudyRoomState({
    currentUser: auth.currentUser,
    packagePrices: subscription.packagePrices,
    addLog: logs.addLog,
  })

  // ─── Cross-domain actions ───────────────────────────────────────────────

  /**
   * logout — clears auth state AND resets unrelated UI state (chat, page).
   * Kept here because it touches 3 domains; putting it in any single hook
   * would create an inappropriate dependency.
   */
  const logout = useCallback(() => {
    auth.logoutUser()
    chat.setActiveChatId(null)
    ui.setCurrentPage("home")
  }, [auth, chat, ui])

  /**
   * setLanguage — updates the language preference locally and syncs with
   * the backend. Spans UI, auth, and admin domains.
   */
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
        showAuthModal: ui.showAuthModal,
        authModalTab: ui.authModalTab,
        login: auth.login,
        register: auth.register,
        logout,
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
        addDocument: docs.addDocument,
        updateDocument: docs.updateDocument,
        deleteDocument: docs.deleteDocument,
        restoreDocument: docs.restoreDocument,
        addCategory: docs.addCategory,
        deleteCategory: docs.deleteCategory,

        // Chat
        chatSessions: chat.chatSessions,
        activeChatId: chat.activeChatId,
        addChatSession: chat.addChatSession,
        updateChatSession: chat.updateChatSession,
        setActiveChatId: chat.setActiveChatId,

        // Flashcards
        flashcards: flashcards.flashcards,
        flashcardSelectedDocumentId: flashcards.flashcardSelectedDocumentId,
        addFlashcards: flashcards.addFlashcards,
        deleteFlashcard: flashcards.deleteFlashcard,
        updateFlashcardStatus: flashcards.updateFlashcardStatus,
        generateFlashcardsFromDocument: flashcards.generateFlashcardsFromDocument,
        setFlashcardSelectedDocumentId: flashcards.setFlashcardSelectedDocumentId,

        // Admin
        users: admin.users,
        activityLogs: logs.activityLogs,
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

        // Study rooms
        rooms: studyRoom.rooms,
        currentRoomId: studyRoom.currentRoomId,
        createRoom: studyRoom.createRoom,
        joinRoom: studyRoom.joinRoom,
        leaveRoom: studyRoom.leaveRoom,
        closeRoom: studyRoom.closeRoom,
        sendRoomMessage: studyRoom.sendRoomMessage,
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
