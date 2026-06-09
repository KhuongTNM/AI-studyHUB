import { useState } from "react"
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SecurityTabProps {
  onChangePassword: (oldPass: string, newPass: string, confirmPass: string) => void
  error: string
  success: string
}

export function SecurityTab({ onChangePassword, error, success }: SecurityTabProps) {
  const [showPass, setShowPass] = useState(false)
  const [oldPass, setOldPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")

  const handleSubmit = () => {
    onChangePassword(oldPass, newPass, confirmPass)
    if (!error) {
      setOldPass("")
      setNewPass("")
      setConfirmPass("")
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <h3 className="font-semibold text-foreground">Đổi mật khẩu</h3>
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
        { id: "old-pass", label: "Mật khẩu hiện tại", value: oldPass, setter: setOldPass },
        { id: "new-pass", label: "Mật khẩu mới", value: newPass, setter: setNewPass },
        { id: "confirm-pass", label: "Xác nhận mật khẩu mới", value: confirmPass, setter: setConfirmPass },
      ].map(field => (
        <div key={field.id}>
          <label className="mb-1.5 block text-sm font-medium text-foreground">{field.label}</label>
          <div className="relative">
            <input
              id={field.id}
              type={showPass ? "text" : "password"}
              value={field.value}
              onChange={e => field.setter(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ))}
      <Button id="change-pass-btn" onClick={handleSubmit}>Đổi mật khẩu</Button>
      <p className="text-xs text-muted-foreground">
        Lưu ý: Bạn sẽ bị đăng xuất sau khi đổi mật khẩu
      </p>
    </div>
  )
}
