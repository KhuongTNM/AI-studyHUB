"use client"

import { useState } from "react"
import {
  Eye, EyeOff, Loader2, GraduationCap,
  CheckCircle2, AlertCircle, ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { registerApi } from "@/services/api/auth"
import { cn } from "@/lib/utils"

// ─── Register Page ────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const [displayName, setDisplayName]         = useState("")
  const [email, setEmail]                     = useState("")
  const [password, setPassword]               = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPwd, setShowPwd]                 = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState("")
  const [success, setSuccess]                 = useState(false)
  const [successMsg, setSuccessMsg]           = useState("")

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): string => {
    if (!displayName.trim() || !email || !password || !confirmPassword)
      return "Vui lòng điền đầy đủ thông tin."
    if (password.length < 8)
      return "Mật khẩu phải có ít nhất 8 ký tự."
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
      return "Mật khẩu phải chứa ít nhất 1 chữ cái và 1 số."
    if (password !== confirmPassword)
      return "Mật khẩu xác nhận không khớp."
    return ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const result = await registerApi(email, password, confirmPassword, displayName.trim())
      if (!result.success) {
        // ❌ Thất bại — ở lại trang, hiện lỗi
        setError(result.error || "Đăng ký thất bại. Vui lòng thử lại.")
      } else {
        // ✅ Thành công — ở lại trang, hiện thông báo thành công
        setSuccessMsg("Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.")
        setSuccess(true)
        // Reset form
        setDisplayName("")
        setEmail("")
        setPassword("")
        setConfirmPassword("")
      }
    } catch {
      setError("Không kết nối được máy chủ. Hãy chạy backend trên cổng 8080.")
    } finally {
      setLoading(false)
    }
  }

  // ── Password strength ───────────────────────────────────────────────────────
  const strength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^a-zA-Z0-9]/.test(password)) s++
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
            <h1 className="text-xl font-semibold text-foreground">Tạo tài khoản</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tham gia AI Study Hub ngay hôm nay — miễn phí!
            </p>
          </div>

          {/* ── Thông báo thành công ───────────────────────────────────────── */}
          {success && (
            <div className="mb-5 flex flex-col items-center gap-3 rounded-xl bg-green-500/10 p-5 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">{successMsg}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Bạn có thể đăng nhập bằng email và mật khẩu vừa tạo.
                </p>
              </div>
              <a href="/login">
                <Button className="mt-1 gap-1.5">
                  Đến trang đăng nhập <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Đăng ký thêm tài khoản khác
              </button>
            </div>
          )}

          {/* ── Thông báo lỗi ─────────────────────────────────────────────── */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Form đăng ký (ẩn khi thành công) ─────────────────────────── */}
          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tên hiển thị */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  maxLength={50}
                  autoComplete="name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
                <p className="mt-0.5 text-right text-xs text-muted-foreground">
                  {displayName.length}/50
                </p>
              </div>

              {/* Email */}
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

              {/* Mật khẩu */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Mật khẩu</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự, có chữ và số"
                    autoComplete="new-password"
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

                {/* Strength bar */}
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            i <= strength ? strengthColors[strength] : "bg-muted"
                          )}
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

              {/* Xác nhận mật khẩu */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={cn(
                    "w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50",
                    confirmPassword && confirmPassword !== password
                      ? "border-destructive"
                      : "border-border"
                  )}
                  required
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="mt-0.5 text-xs text-destructive">Mật khẩu không khớp.</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Tạo tài khoản
              </Button>
            </form>
          )}

          {/* Link sang Login */}
          {!success && (
            <div className="mt-4 flex items-center justify-center gap-1 text-sm text-muted-foreground">
              Đã có tài khoản?
              <a
                href="/login"
                className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
              >
                Đăng nhập <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {/* Link về trang chủ */}
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
