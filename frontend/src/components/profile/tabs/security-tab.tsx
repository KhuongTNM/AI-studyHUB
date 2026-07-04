import { useState } from "react"
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Language } from "@/states/types"

interface SecurityTabProps {
  onChangePassword: (oldPass: string, newPass: string, confirmPass: string) => Promise<boolean>
  error: string
  success: string
  loading: boolean
  language: Language
}

export function SecurityTab({ onChangePassword, error, success, loading, language }: SecurityTabProps) {
  const text = securityText[language]
  const [showPass, setShowPass] = useState(false)
  const [oldPass, setOldPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")

  const handleSubmit = async () => {
    const changed = await onChangePassword(oldPass, newPass, confirmPass)
    if (changed) {
      setOldPass("")
      setNewPass("")
      setConfirmPass("")
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <h3 className="font-semibold text-foreground">{text.title}</h3>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />{success}
        </div>
      )}
      {[
        { id: "old-pass", label: text.currentPassword, value: oldPass, setter: setOldPass },
        { id: "new-pass", label: text.newPassword, value: newPass, setter: setNewPass },
        { id: "confirm-pass", label: text.confirmPassword, value: confirmPass, setter: setConfirmPass },
      ].map(field => (
        <div key={field.id}>
          <label className="mb-1.5 block text-sm font-medium text-foreground">{field.label}</label>
          <div className="relative">
            <input
              id={field.id}
              type={showPass ? "text" : "password"}
              value={field.value}
              onChange={e => field.setter(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              disabled={loading}
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ))}
      <Button id="change-pass-btn" onClick={handleSubmit} disabled={loading}>
        {loading ? text.changing : text.changePassword}
      </Button>
      <p className="text-xs text-muted-foreground">
        {text.note}
      </p>
    </div>
  )
}

const securityText = {
  vi: {
    title: "Đổi mật khẩu",
    currentPassword: "Mật khẩu hiện tại",
    newPassword: "Mật khẩu mới",
    confirmPassword: "Xác nhận mật khẩu mới",
    changePassword: "Đổi mật khẩu",
    changing: "Đang đổi...",
    note: "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ và số.",
  },
  en: {
    title: "Change password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    changePassword: "Change password",
    changing: "Changing...",
    note: "New password must be at least 8 characters and include letters and numbers.",
  },
} as const
