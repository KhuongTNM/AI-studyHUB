"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { Language } from "@/states/types"
import type { AppState } from "@/hooks/useApp"

// ─── Đồng bộ currentPage <-> URL (?page=...) ───────────────────────────────
// Trước đây currentPage chỉ sống trong state React nên F5 (hoặc mở link mới,
// hoặc PayOS redirect về sau khi thanh toán) luôn rơi về "home" vì URL luôn
// là "/" và không mang thông tin trang hiện tại. Ta lưu trang hiện tại vào
// query string bằng History API (không cần Next router/Suspense) để F5 giữ
// nguyên trang, đồng thời đọc thêm cờ ?payment=... để xử lý kết quả thanh
// toán PayOS trả về (BR liên quan đến gói dịch vụ).

const VALID_PAGES: AppState["currentPage"][] = [
  "home", "documents", "chat", "groups", "cloud",
  "profile", "admin", "trash", "flashcards",
]

function isValidPage(value: string | null): value is AppState["currentPage"] {
  return !!value && (VALID_PAGES as string[]).includes(value)
}

function writePageToUrl(page: AppState["currentPage"]) {
  if (typeof window === "undefined") return
  const url = page === "home"
    ? window.location.pathname
    : `${window.location.pathname}?page=${page}`
  window.history.replaceState(null, "", url)
}

export function useUIState() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  // ✅ Luôn khởi tạo "vi" trên cả server lẫn client để tránh hydration mismatch.
  // Sau khi mount xong, đọc localStorage và cập nhật nếu user đã chọn "en".
  const [language, setLanguageState] = useState<Language>("vi")

  const [currentPage, setCurrentPageState] = useState<AppState["currentPage"]>("home")
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<"login" | "register" | "forgot">("login")
  const hasHydrated = useRef(false)

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

  // ── Khôi phục trang hiện tại từ URL khi tải lại trang, và xử lý kết quả
  // thanh toán PayOS trả về (?payment=success|cancelled) — chạy đúng 1 lần
  // lúc mount, tránh đè lên các lần điều hướng thủ công sau đó.
  useEffect(() => {
    if (hasHydrated.current) return
    hasHydrated.current = true

    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get("payment")
    const pageParam = params.get("page")

    let nextPage: AppState["currentPage"] = isValidPage(pageParam) ? pageParam : "home"

    if (paymentStatus === "success") {
      // Backend PayOS returnUrl trỏ về đây kèm ?payment=success — mở lại
      // trang Profile ở tab "packages" (cơ chế sessionStorage này đã có sẵn
      // trong profile-page.tsx, chỉ cần kích hoạt đúng lúc).
      nextPage = "profile"
      window.sessionStorage.setItem("profile-tab", "packages")
      toast.success(
        language === "vi"
          ? "Thanh toán thành công! Gói của bạn đã được nâng cấp."
          : "Payment successful! Your plan has been upgraded.",
      )
    } else if (paymentStatus === "cancelled") {
      nextPage = "profile"
      window.sessionStorage.setItem("profile-tab", "packages")
      toast.error(
        language === "vi"
          ? "Thanh toán đã bị huỷ hoặc chưa hoàn tất."
          : "Payment was cancelled or not completed.",
      )
    }

    setCurrentPageState(nextPage)
    // Dọn query string (page/payment) sau khi đã xử lý xong, giữ lại URL sạch.
    writePageToUrl(nextPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Đồng bộ khi user bấm nút back/forward trên trình duyệt
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      const pageParam = params.get("page")
      setCurrentPageState(isValidPage(pageParam) ? pageParam : "home")
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const setCurrentPage = useCallback((page: AppState["currentPage"]) => {
    setCurrentPageState(page)
    writePageToUrl(page)
  }, [])

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
