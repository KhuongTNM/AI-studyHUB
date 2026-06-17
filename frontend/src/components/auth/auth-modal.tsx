"use client"

import { useState } from "react"
import { X, Eye, EyeOff, Loader2, GraduationCap, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { useApp } from "@/lib/store"
import { cn } from "@/lib/utils"

export function AuthModal() {
  const { showAuthModal, authModalTab, closeAuthModal, login, register, loginWithGoogle, language, isDarkMode } = useApp()
  const [tab, setTab] = useState<"login" | "register" | "forgot">(authModalTab)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Form states
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  if (!showAuthModal) return null

  const text = language === "vi" ? {
    login: "Đăng nhập",
    register: "Đăng ký",
    password: "Mật khẩu",
    forgot: "Quên mật khẩu?",
    submitLogin: "Đăng nhập",
    submitRegister: "Tạo tài khoản",
    demo: "Demo: admin@gmail.com / student@gmail.com / subAdmin@gmail.com. Mật Khẩu: Admin123",
    name: "Tên hiển thị",
    confirmPassword: "Xác nhận mật khẩu",
    haveAccount: "Đã có tài khoản?",
    forgotTitle: "Quên mật khẩu?",
    forgotHelp: "Nhập email để nhận link đặt lại mật khẩu.",
    sendReset: "Gửi link đặt lại",
    backLogin: "← Quay lại đăng nhập",
    required: "Vui lòng điền đầy đủ thông tin.",
    mismatch: "Mật khẩu xác nhận không khớp.",
    minPassword: "Mật khẩu phải có ít nhất 8 ký tự.",
    letterNumber: "Mật khẩu phải chứa ít nhất 1 chữ cái và 1 số.",
    failedLogin: "Đăng nhập thất bại.",
    failedRegister: "Đăng ký thất bại.",
    enterEmail: "Vui lòng nhập email.",
    resetSent: "Link đặt lại mật khẩu đã được gửi đến email của bạn!",
    strength: "Độ mạnh:",
    strengthLabel: ["", "Yếu", "Trung bình", "Tốt", "Mạnh"],
    namePlaceholder: "Nguyễn Văn A",
    passwordPlaceholder: "Tối thiểu 8 ký tự, có chữ và số",
    orContinueWith: "Hoặc tiếp tục với",
    googleFailed: "Đăng nhập Google thất bại.",
  } : {
    login: "Log in",
    register: "Sign up",
    password: "Password",
    forgot: "Forgot password?",
    submitLogin: "Log in",
    submitRegister: "Create account",
    demo: "Demo: admin@gmail.com / student@gmail.com / subadmin@gmail.com. Password: Admin123",
    name: "Display name",
    confirmPassword: "Confirm password",
    haveAccount: "Already have an account?",
    forgotTitle: "Forgot password?",
    forgotHelp: "Enter your email to receive a reset link.",
    sendReset: "Send reset link",
    backLogin: "← Back to login",
    required: "Please fill in all required fields.",
    mismatch: "The confirmation password does not match.",
    minPassword: "Password must be at least 8 characters.",
    letterNumber: "Password must include at least one letter and one number.",
    failedLogin: "Login failed.",
    failedRegister: "Registration failed.",
    enterEmail: "Please enter your email.",
    resetSent: "A password reset link has been sent to your email.",
    strength: "Strength:",
    strengthLabel: ["", "Weak", "Medium", "Good", "Strong"],
    namePlaceholder: "Alex Nguyen",
    passwordPlaceholder: "At least 8 characters with letters and numbers",
    orContinueWith: "Or continue with",
    googleFailed: "Google sign-in failed.",
  }

  const switchTab = (t: typeof tab) => {
    setTab(t)
    setError("")
    setSuccess("")
    setEmail("")
    setPassword("")
    setDisplayName("")
    setConfirmPassword("")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email || !password) { setError(text.required); return }
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (!result.success) setError(result.error || text.failedLogin)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email || !password || !displayName) { setError(text.required); return }
    if (password !== confirmPassword) { setError(text.mismatch); return }
    if (password.length < 8) { setError(text.minPassword); return }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError(text.letterNumber); return
    }
    setLoading(true)
    const result = await register(email, password, displayName)
    setLoading(false)
    if (!result.success) setError(result.error || text.failedRegister)
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email) { setError(text.enterEmail); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setLoading(false)
    setSuccess(text.resetSent)
  }

  const handleGoogleCredential = async (idToken: string) => {
    setError("")
    setSuccess("")
    setLoading(true)
    const result = await loginWithGoogle(idToken)
    setLoading(false)
    if (!result.success) setError(result.error || text.googleFailed)
  }

  // Password strength
  const strength = (() => {
    if (!password || tab !== "register") return 0
    let s = 0
    if (password.length >= 8) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^a-zA-Z0-9]/.test(password)) s++
    return s
  })()

  const strengthLabel = text.strengthLabel[strength]
  const strengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"][strength]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeAuthModal} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">AI Study Hub</span>
          </div>
          <Button variant="ghost" size="icon" onClick={closeAuthModal}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        {tab !== "forgot" && (
          <div className="flex border-b border-border">
            {(["login", "register"] as const).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-colors",
                  tab === t
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "login" ? text.login : text.register}
              </button>
            ))}
          </div>
        )}

        <div className="p-6">
          {/* Google Sign-In — chỉ hiện ở tab Đăng nhập */}
          {tab === "login" && (
            <>
              <GoogleSignInButton
                onCredential={handleGoogleCredential}
                theme={isDarkMode ? "filled_black" : "outline"}
                text="signin_with"
                disabled={loading}
                onError={msg => setError(msg)}
              />
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{text.orContinueWith}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          {/* Error/Success */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {success}
            </div>
          )}

          {/* LOGIN */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{text.password}</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button type="button" onClick={() => switchTab("forgot")} className="mt-1 text-xs text-primary hover:underline">
                  {text.forgot}
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {text.submitLogin}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                <strong>{text.demo}</strong>
              </p>
            </form>
          )}

          {/* REGISTER */}
          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{text.name}</label>
                <input
                  id="reg-name"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder={text.namePlaceholder}
                  maxLength={50}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
                <p className="mt-0.5 text-right text-xs text-muted-foreground">{displayName.length}/50</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{text.password}</label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={text.passwordPlaceholder}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={cn("h-1 flex-1 rounded-full", i <= strength ? strengthColor : "bg-muted")} />
                      ))}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{text.strength} <span className="font-medium">{strengthLabel}</span></p>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{text.confirmPassword}</label>
                <input
                  id="reg-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    "w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50",
                    confirmPassword && confirmPassword !== password ? "border-destructive" : "border-border"
                  )}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {text.submitRegister}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {text.haveAccount}{" "}
                <button type="button" onClick={() => switchTab("login")} className="text-primary hover:underline">{text.login}</button>
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {tab === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="mb-2 text-center">
                <h3 className="text-lg font-semibold text-foreground">{text.forgotTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text.forgotHelp}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                  disabled={!!success}
                />
              </div>
              {!success && (
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {text.sendReset}
                </Button>
              )}
              <button type="button" onClick={() => switchTab("login")} className="w-full text-center text-sm text-primary hover:underline">
                {text.backLogin}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
