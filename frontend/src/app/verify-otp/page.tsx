"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, GraduationCap, CheckCircle2, AlertCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { useApp } from "@/lib/store"

const OTP_LENGTH = 6
const DEFAULT_EXPIRES_IN = 600 // 10 phút — BR-095

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

// ─── Inner component (needs useSearchParams → must be inside <Suspense>) ──────

function VerifyOtpForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { verifyOtp, resendOtp } = useApp()

  const email = searchParams.get("email") ?? ""
  const initialExpiresIn = Number(searchParams.get("expiresIn")) || DEFAULT_EXPIRES_IN

  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState("")
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [success, setSuccess] = useState(false)
  const [shake, setShake] = useState(false)
  const [infoMessage, setInfoMessage] = useState("")

  const [expirySeconds, setExpirySeconds] = useState(initialExpiresIn)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  const otpExpired = expirySeconds <= 0

  // ── Đếm ngược hết hạn OTP (10:00 → 00:00) ──────────────────────────────────
  useEffect(() => {
    if (success || expirySeconds <= 0) return
    const timer = setInterval(() => {
      setExpirySeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [success, expirySeconds > 0])

  // ── Đếm ngược cooldown nút "Gửi lại mã" ─────────────────────────────────────
  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSeconds > 0])

  const shakeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerShake = useCallback(() => {
    setShake(true)
    if (shakeRef.current) clearTimeout(shakeRef.current)
    shakeRef.current = setTimeout(() => setShake(false), 400)
  }, [])

  const handleVerify = useCallback(
    async (code: string) => {
      if (!email) {
        setError("Thiếu thông tin email. Vui lòng quay lại trang đăng ký.")
        return
      }
      setError("")
      setInfoMessage("")
      setLoading(true)
      const result = await verifyOtp(email, code)
      setLoading(false)

      if (result.success) {
        setSuccess(true)
        return
      }

      if (result.code === "OTP_INVALID_CODE") {
        triggerShake()
        setOtp("")
        setAttemptsRemaining(result.attemptsRemaining ?? null)
        setError(
          result.attemptsRemaining !== undefined
            ? `Mã xác thực không đúng. Còn lại ${result.attemptsRemaining} lượt thử.`
            : "Mã xác thực không đúng."
        )
      } else {
        setAttemptsRemaining(null)
        setOtp("")
        setError(result.error)
        if (result.code === "OTP_EXPIRED") setExpirySeconds(0)
      }
    },
    [email, verifyOtp, triggerShake]
  )

  const handleOtpChange = (value: string) => {
    setOtp(value)
    if (value.length === OTP_LENGTH) {
      void handleVerify(value)
    }
  }

  const handleResend = async () => {
    if (!email || cooldownSeconds > 0 || resending) return
    setError("")
    setInfoMessage("")
    setResending(true)
    const result = await resendOtp(email)
    setResending(false)

    if (!result.success) {
      if (result.code === "OTP_RESEND_COOLDOWN") {
        setCooldownSeconds(result.retryAfterSeconds ?? 0)
      }
      setError(result.error)
      return
    }

    setInfoMessage(result.message)
    setCooldownSeconds(60)
    setExpirySeconds(DEFAULT_EXPIRES_IN)
    setOtp("")
    setAttemptsRemaining(null)
  }

  const maxAttemptsExceeded = attemptsRemaining === 0

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
          {success ? (
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center gap-2 rounded-lg bg-green-500/10 p-4 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-8 w-8" />
                <p className="font-medium">Xác thực email thành công!</p>
                <p className="text-sm text-muted-foreground">Bạn đã được đăng nhập tự động.</p>
              </div>
              <Button className="w-full" onClick={() => router.replace("/")}>
                Vào trang chủ
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">Nhập mã xác thực</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mã gồm 6 chữ số đã được gửi tới{" "}
                  {email ? <span className="font-medium text-foreground">{email}</span> : "email của bạn"}
                </p>
              </div>

              {!email && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Không tìm thấy email. Vui lòng quay lại{" "}
                    <a href="/register" className="underline">
                      trang đăng ký
                    </a>
                    .
                  </span>
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {infoMessage && !error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{infoMessage}</span>
                </div>
              )}

              <div className={`flex flex-col items-center gap-3 ${shake ? "animate-[shake_0.4s]" : ""}`}>
                <style>{`
                  @keyframes shake {
                    10%, 90% { transform: translateX(-1px); }
                    20%, 80% { transform: translateX(2px); }
                    30%, 50%, 70% { transform: translateX(-4px); }
                    40%, 60% { transform: translateX(4px); }
                  }
                `}</style>
                <InputOTP
                  maxLength={OTP_LENGTH}
                  value={otp}
                  onChange={handleOtpChange}
                  disabled={loading || !email || otpExpired || maxAttemptsExceeded}
                >
                  <InputOTPGroup>
                    {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>

                <div className="text-sm text-muted-foreground">
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang xác thực...
                    </span>
                  ) : otpExpired ? (
                    <span className="text-destructive">Mã đã hết hạn.</span>
                  ) : (
                    <span>
                      Mã hết hạn sau <span className="font-medium text-foreground">{formatCountdown(expirySeconds)}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 text-center">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={!email || resending || cooldownSeconds > 0}
                  onClick={handleResend}
                >
                  {resending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {cooldownSeconds > 0 ? `Gửi lại sau ${cooldownSeconds}s` : "Gửi lại mã"}
                </Button>
              </div>

              <div className="mt-4 text-center">
                <a href="/login" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                  ← Quay lại đăng nhập
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page export (wraps form in Suspense for useSearchParams) ────────────────

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyOtpForm />
    </Suspense>
  )
}
