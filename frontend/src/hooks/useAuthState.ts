"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchCurrentUserApi,
  loginApi,
  logoutApi,
  registerApi,
} from "@/services/api/auth"
import { clearAccessToken } from "@/lib/auth-storage"
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

  /**
   * BR-061: Force-logout detection.
   * When a user's account is locked by an admin, the backend rejects their
   * token on every request. Here we re-validate the session whenever the
   * browser tab regains focus so the user is logged out promptly without
   * requiring a full page reload.
   */
  useEffect(() => {
    if (!currentUser) return

    const checkSession = async () => {
      try {
        const user = await fetchCurrentUserApi()
        if (!user) {
          // Token was invalidated (e.g. account locked by admin)
          clearAccessToken()
          setCurrentUser(null)
        }
      } catch {
        // Network error — keep the session, will fail on next real request
      }
    }

    const onFocus = () => void checkSession()
    const onVisibilityChange = () => {
      if (!document.hidden) void checkSession()
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [currentUser?.id])

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



