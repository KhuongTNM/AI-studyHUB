"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchCurrentUserApi,
  changePasswordApi,
  loginApi,
  loginWithGoogleApi,
  logoutApi,
  registerApi,
  updateProfileApi,
} from "@/services/api/auth"
import { clearAccessToken } from "@/lib/auth-storage"
import type { Language, User } from "@/states/types"

interface AuthStateDeps {
  /** Called after successful login/register to sync language from user preference */
  setLanguageState: (lang: Language) => void
  /** Called to close the modal after a successful auth action */
  closeAuthModal: () => void
  /** Called after a session is resolved so role-specific landing pages can be applied */
  onAuthenticated?: (user: User) => void
}

export function useAuthState({ setLanguageState, closeAuthModal, onAuthenticated }: AuthStateDeps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Restore session on mount
  useEffect(() => {
    let cancelled = false
    fetchCurrentUserApi()
      .then(user => {
        if (!cancelled && user) {
          setCurrentUser(user)
          setLanguageState(user.languagePreference ?? "vi")
          onAuthenticated?.(user)
        }
      })
      .catch(() => {
        // ignore restore errors on initial load
      })
    return () => {
      cancelled = true
    }
  }, [setLanguageState, onAuthenticated])

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
        onAuthenticated?.(result.user)
        closeAuthModal()
        return { success: true }
      } catch {
        return {
          success: false,
          error: "Không kết nối được máy chủ. Hãy chạy backend trên cổng 8080.",
        }
      }
    },
    [setLanguageState, closeAuthModal, onAuthenticated],
  )

  const register = useCallback(
    async (email: string, password: string, confirmPassword: string, displayName: string) => {
      try {
        const result = await registerApi(email, password, confirmPassword, displayName)
        if (!result.success) return result
        closeAuthModal()
        return { success: true, message: "Đăng ký thành công. Vui lòng đăng nhập." }
      } catch {
        return {
          success: false,
          error: "Không kết nối được máy chủ. Hãy chạy backend trên cổng 8080.",
        }
      }
    },
    [setLanguageState, closeAuthModal, onAuthenticated],
  )

  /**
   * Đăng nhập/đăng ký bằng Google.
   * idToken là JWT trả về từ Google Identity Services (xem GoogleSignInButton).
   * Backend tự quyết định tạo user mới hay đăng nhập vào user đã tồn tại theo email
   * trong token, rồi trả về cùng format AuthResponse như login thường.
   */
  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      try {
        const result = await loginWithGoogleApi(idToken)
        if (!result.success) return result
        setCurrentUser(result.user)
        setLanguageState(result.user.languagePreference ?? "vi")
        onAuthenticated?.(result.user)
        closeAuthModal()
        return { success: true }
      } catch {
        return {
          success: false,
          error: "Không kết nối được máy chủ. Hãy chạy backend trên cổng 8080.",
        }
      }
    },
    [setLanguageState, closeAuthModal, onAuthenticated],
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

  const updateOwnProfile = useCallback(async (displayName: string) => {
    try {
      const user = await updateProfileApi(displayName)
      setCurrentUser(user)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Không thể cập nhật hồ sơ.",
      }
    }
  }, [])

  const changeOwnPassword = useCallback(
    async (currentPassword: string, newPassword: string, confirmPassword: string) => {
      try {
        const result = await changePasswordApi(currentPassword, newPassword)
        if (!result.success) return result
        return { success: true, message: result.message }
      } catch {
        return {
          success: false,
          error: "Không kết nối được máy chủ. Hãy chạy backend trên cổng 8080.",
        }
      }
    },
    [],
  )

  return {
    currentUser,
    /** Exposed so sibling hooks and AppProvider can update the current user */
    setCurrentUser,
    login,
    register,
    loginWithGoogle,
    logoutUser,
    updateOwnProfile,
    changeOwnPassword,
  }
}



