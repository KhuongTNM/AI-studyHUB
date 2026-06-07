"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchCurrentUserApi,
  loginApi,
  logoutApi,
  registerApi,
} from "@/services/api/auth"
import type { Language, User } from "@/states/types"

interface AuthStateDeps {
  /** Called after successful login/register to sync language from user preference */
  setLanguageState: (lang: Language) => void
  /** Called to close the modal after a successful auth action */
  closeAuthModal: () => void
}

export function useAuthState({ setLanguageState, closeAuthModal }: AuthStateDeps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Restore session on mount
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
  }, [setLanguageState])

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const result = await loginApi(email, password)
        if (!result.success) return result
        setCurrentUser(result.user)
        setLanguageState(result.user.languagePreference ?? "vi")
        closeAuthModal()
        return { success: true }
      } catch {
        return {
          success: false,
          error: "Không kết nối được máy chủ. Hãy chạy backend trên cổng 8080.",
        }
      }
    },
    [setLanguageState, closeAuthModal],
  )

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      try {
        const result = await registerApi(email, password, displayName)
        if (!result.success) return result
        setCurrentUser(result.user)
        setLanguageState(result.user.languagePreference ?? "vi")
        closeAuthModal()
        return { success: true }
      } catch {
        return {
          success: false,
          error: "Không kết nối được máy chủ. Hãy chạy backend trên cổng 8080.",
        }
      }
    },
    [setLanguageState, closeAuthModal],
  )

  /**
   * Clears the current user and calls the logout API.
   * Side-effects like clearing activeChatId or resetting currentPage
   * are handled by the AppProvider to avoid cross-domain coupling.
   */
  const logoutUser = useCallback(() => {
    void logoutApi()
    setCurrentUser(null)
  }, [])

  return {
    currentUser,
    /** Exposed so sibling hooks and AppProvider can update the current user */
    setCurrentUser,
    login,
    register,
    logoutUser,
  }
}
