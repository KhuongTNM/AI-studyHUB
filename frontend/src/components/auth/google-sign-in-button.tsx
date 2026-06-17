"use client"

import { useEffect, useRef } from "react"

/**
 * Đăng nhập bằng Google — dùng Google Identity Services (GIS).
 *
 * Luồng hoạt động:
 * 1. Script GIS (https://accounts.google.com/gsi/client) được load 1 lần và cache lại.
 * 2. GIS render sẵn nút "Sign in with Google" chính chủ của Google vào `containerRef`
 *    (không tự vẽ icon/logo để tránh lệch chuẩn thương hiệu của Google).
 * 3. Khi người dùng bấm nút và chọn tài khoản, GIS trả về một ID token (JWT) qua callback.
 * 4. Component gọi `onCredential(idToken)` để cha xử lý — KHÔNG tự verify token ở client.
 *    Việc verify token (audience, issuer, hạn dùng) phải làm ở backend.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            cancel_on_tap_outside?: boolean
            auto_select?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon"
              theme?: "outline" | "filled_blue" | "filled_black"
              size?: "large" | "medium" | "small"
              text?: "signin_with" | "signup_with" | "continue_with" | "signin"
              shape?: "rectangular" | "pill" | "circle" | "square"
              logo_alignment?: "left" | "center"
              width?: number
            },
          ) => void
        }
      }
    }
  }
}

const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client"

let gsiScriptPromise: Promise<void> | null = null

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
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
  /** Gọi khi người dùng đăng nhập Google thành công, trả về ID token (JWT) cần gửi lên backend */
  onCredential: (idToken: string) => void
  theme?: "outline" | "filled_blue" | "filled_black"
  text?: "signin_with" | "signup_with" | "continue_with"
  disabled?: boolean
  /** Thông báo lỗi khi không tải/khởi tạo được Google (vd. thiếu Client ID, mạng chặn script) */
  onError?: (message: string) => void
}

export function GoogleSignInButton({
  onCredential,
  theme = "outline",
  text = "continue_with",
  disabled,
  onError,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!clientId || disabled || !containerRef.current) return
    let cancelled = false

    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: response => onCredential(response.credential),
          cancel_on_tap_outside: true,
        })
        const width = Math.min(400, Math.max(200, containerRef.current.offsetWidth || 360))
        containerRef.current.innerHTML = ""
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme,
          size: "large",
          text,
          shape: "rectangular",
          logo_alignment: "left",
          width,
        })
      })
      .catch(() => {
        onError?.("Không thể tải Google Sign-In. Vui lòng kiểm tra kết nối mạng.")
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, theme, text, disabled])

  if (!clientId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-2.5 text-center text-xs text-muted-foreground">
        Thiếu NEXT_PUBLIC_GOOGLE_CLIENT_ID — chưa thể hiển thị nút đăng nhập Google.
      </div>
    )
  }

  return <div ref={containerRef} className="flex w-full justify-center" />
}
