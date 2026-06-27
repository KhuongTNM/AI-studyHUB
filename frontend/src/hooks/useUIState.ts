"use client"

import { useCallback, useEffect, useState } from "react"
import type { Language } from "@/states/types"
import type { AppState } from "@/hooks/useApp"

export function useUIState() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  // ✅ Luôn khởi tạo "vi" trên cả server lẫn client để tránh hydration mismatch.
  // Sau khi mount xong, đọc localStorage và cập nhật nếu user đã chọn "en".
  const [language, setLanguageState] = useState<Language>("vi")

  const [currentPage, setCurrentPage] = useState<AppState["currentPage"]>("home")
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<"login" | "register" | "forgot">("login")

  // Đọc localStorage sau khi hydration hoàn tất (chỉ chạy ở client)
  useEffect(() => {
    const stored = window.localStorage.getItem("ai-study-hub-language")
    if (stored === "en") {
      setLanguageState("en")
    }
  }, [])

  // Sync language to DOM + localStorage whenever it changes
  useEffect(() => {
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

  const openAuthModal = useCallback((tab: "login" | "register" | "forgot" = "login") => {
    setAuthModalTab(tab)
    setShowAuthModal(true)
  }, [])

  const closeAuthModal = useCallback(() => setShowAuthModal(false), [])

  return {
    isDarkMode,
    language,
    setLanguageState,   // exposed so AppProvider can sync language on login / setLanguage API call
    currentPage,
    setCurrentPage,
    showAuthModal,
    authModalTab,
    toggleDarkMode,
    openAuthModal,
    closeAuthModal,
  }
}
