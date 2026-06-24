"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Eye, EyeOff, Loader2, GraduationCap,
  AlertCircle, ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useApp } from "@/lib/store"
import { getAccessToken } from "@/lib/auth-storage"

// ─── Google token client types ────────────────────────────────────────────────

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
      existing.addEventListener("error", () => reject())
      return
    }
    const script = document.createElement("script")
    script.src = GOOGLE_GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject()
    document.head.appendChild(script)
  })
  return gsiScriptPromise
}

// ─── Login Page ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()

  // ✅ Dùng store — login() sẽ cập nhật currentUser cho toàn app
  const { login, loginWithGoogle } = useApp()

  const [email, setEmail]     = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")

  const tokenClientRef = useRef<TokenClient | null>(null)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  // Nếu đã có token thì về trang chủ luôn
  useEffect(() => {
    if (getAccessToken()) router.replace("/")
  }, [router])

  // Khởi tạo Google OAuth token client
  useEffect(() => {
    if (!clientId) return
    loadGsiScript()
      .then(() => {
        if (!window.google?.accounts?.oauth2) return
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          callback: async (response) => {
            if (!response.access_token) {
              setError("Đăng nhập Google thất bại. Vui lòng thử lại.")
              return
            }
            setLoading(true)
            // ✅ Dùng loginWithGoogle từ store
            const result = await loginWithGoogle(response.access_token)
            setLoading(false)
            if (!result.success) {
              setError(result.error || "Đăng nhập Google thất bại.")
            } else {
              router.replace("/")
            }
          },
        })
      })
      .catch(() => { /* bỏ qua */ })
  }, [clientId, loginWithGoogle, router])

  const handleGoogleLogin = useCallback(() => {
    if (!tokenClientRef.current) {
      setError("Google Sign-In chưa sẵn sàng. Vui lòng thử lại.")
      return
    }
    tokenClientRef.current.requestAccessToken({ prompt: "consent" })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email || !password) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu.")
      return
    }
    setLoading(true)
    // ✅ Dùng login() từ store — tự cập nhật currentUser cho toàn app
    const result = await login(email, password)
    setLoading(false)
    if (!result.success) {
      setError(result.error || "Đăng nhập thất bại.")
    } else {
      router.replace("/")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border p-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">AI Study Hub</span>
        </div>

        <div className="p-6">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-semibold text-foreground">Đăng nhập</h1>
            <p className="mt-1 text-sm text-muted-foreground">Chào mừng bạn quay lại!</p>
          </div>

          {/* Google Sign-In */}
          {clientId && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                </svg>
                Đăng nhập với Google
              </button>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">Hoặc tiếp tục với</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-1 text-right">
                <a href="/reset-password" className="text-xs text-primary hover:underline">
                  Quên mật khẩu?
                </a>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Đăng nhập
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Demo: <strong>admin@gmail.com</strong> / <strong>student@gmail.com</strong> — Mật khẩu: <strong>Admin123</strong>
            </p>
          </form>

          <div className="mt-4 flex items-center justify-center gap-1 text-sm text-muted-foreground">
            Chưa có tài khoản?
            <a href="/register" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
              Đăng ký ngay <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-2 text-center">
            <a href="/" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              ← Quay lại trang chủ
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
