"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, GraduationCap, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resetPasswordApi } from "@/services/api/auth"

// ─── Inner component (needs useSearchParams → must be inside <Suspense>) ──────

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") ?? ""

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState("Mật khẩu đã được đặt lại thành công!")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!token) {
      setError("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.")
      return
    }
    if (newPassword.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.")
      return
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Mật khẩu phải chứa ít nhất 1 chữ cái và 1 số.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.")
      return
    }

    setLoading(true)
    const result = await resetPasswordApi(token, newPassword)
    setLoading(false)

    if (!result.success) {
      setError(result.error || "Đặt lại mật khẩu thất bại. Vui lòng thử lại.")
    } else {
      setSuccessMessage(result.message || "Mật khẩu đã được đặt lại thành công!")
      setSuccess(true)
    }
  }

  // ── Password strength ──────────────────────────────────────────────────────
  const strength = (() => {
    if (!newPassword) return 0
    let s = 0
    if (newPassword.length >= 8) s++
    if (/[A-Z]/.test(newPassword)) s++
    if (/[0-9]/.test(newPassword)) s++
    if (/[^a-zA-Z0-9]/.test(newPassword)) s++
    return s
  })()
  const strengthLabels = ["", "Yếu", "Trung bình", "Mạnh", "Rất Mạnh"]
  const strengthColors = ["", "bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"]

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
            <h1 className="text-xl font-semibold text-foreground">Đặt lại mật khẩu</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Nhập mật khẩu mới cho tài khoản của bạn.
            </p>
          </div>

          {/* Success state */}
          {success ? (
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center gap-2 rounded-lg bg-green-500/10 p-4 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-8 w-8" />
                <p className="font-medium">{successMessage}</p>
                <p className="text-sm text-muted-foreground">Bạn có thể đăng nhập bằng mật khẩu mới.</p>
              </div>
              <Button className="w-full" onClick={() => router.push("/")}>
                Quay lại trang chủ
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Token missing warning */}
              {!token && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* New password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự, có chữ và số"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    disabled={!token}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${i <= strength ? strengthColors[strength] : "bg-muted"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Độ mạnh:{" "}
                      <span className="font-medium">{strengthLabels[strength]}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    confirmPassword && confirmPassword !== newPassword
                      ? "border-destructive"
                      : "border-border"
                  }`}
                  disabled={!token}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !token}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Đặt lại mật khẩu
              </Button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                ← Quay lại trang chủ
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page export (wraps form in Suspense for useSearchParams) ────────────────

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
