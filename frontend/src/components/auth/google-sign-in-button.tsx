"use client"

import { useEffect, useRef } from "react"

/**
 * Đăng nhập bằng Google — dùng OAuth 2.0 Token Client.
 *
 * Luồng hoạt động:
 * 1. Script GIS được load 1 lần và cache lại.
 * 2. Khởi tạo OAuth2 token client với scope openid + email + profile.
 * 3. Khi người dùng bấm nút, Google hiển thị màn hình chọn tài khoản + xin quyền.
 * 4. Google trả về access token → gửi lên backend để lấy thông tin user qua userinfo API.
 */

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => TokenClient
        }
      }
    }
  }
}

const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client"

let gsiScriptPromise: Promise<void> | null = null

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gsiScriptPromise) return gsiScriptPromise

  gsiScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("Không tải được Google script.")))
      return
    }
    const script = document.createElement("script")
    script.src = GOOGLE_GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Không tải được Google script."))
    document.head.appendChild(script)
  })
  return gsiScriptPromise
}

interface GoogleSignInButtonProps {
  /** Gọi khi đăng nhập thành công, trả về access token để gửi lên backend */
  onCredential: (accessToken: string) => void
  text?: "signin_with" | "signup_with" | "continue_with"
  disabled?: boolean
  onError?: (message: string) => void
}

export function GoogleSignInButton({
  onCredential,
  text = "continue_with",
  disabled,
  onError,
}: GoogleSignInButtonProps) {
  const tokenClientRef = useRef<TokenClient | null>(null)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  const buttonLabel =
    text === "signup_with"
      ? "Đăng ký với Google"
      : text === "signin_with"
        ? "Đăng nhập với Google"
        : "Tiếp tục với Google"

  useEffect(() => {
    if (!clientId || disabled) return
    let cancelled = false

    loadGsiScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.oauth2) return
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          callback: (response) => {
            if (response.access_token) {
              onCredential(response.access_token)
            } else {
              onError?.("Đăng nhập Google thất bại. Vui lòng thử lại.")
            }
          },
        })
      })
      .catch(() => {
        onError?.("Không thể tải Google Sign-In. Vui lòng kiểm tra kết nối mạng.")
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, disabled])

  const handleClick = () => {
    if (!tokenClientRef.current) {
      onError?.("Google Sign-In chưa sẵn sàng. Vui lòng thử lại.")
      return
    }
    //tokenClientRef.current.requestAccessToken({ prompt: "select_account" })  // chỉ hiện lần đầu
    tokenClientRef.current.requestAccessToken({ prompt: "consent" })           // hiện màn hình xin quyền mỗi lần
  }

  if (!clientId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-2.5 text-center text-xs text-muted-foreground">
        Thiếu NEXT_PUBLIC_GOOGLE_CLIENT_ID — chưa thể hiển thị nút đăng nhập Google.
      </div>
    )
  }

  return (
    <div className="flex w-full justify-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {/* Google logo SVG */}
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          />
        </svg>
        {buttonLabel}
      </button>
    </div>
  )
}
