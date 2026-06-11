"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SubAdminForm({
  form,
  onFormChange,
  onSubmit,
  message,
  text,
}: {
  form: { displayName: string; email: string; password: string }
  onFormChange: (form: any) => void
  onSubmit: () => void
  message?: string
  text: any
}) {
  const hasMinLength = form.password.length >= 8
  const hasLetter = /[a-zA-Z]/.test(form.password)
  const hasDigit = /[0-9]/.test(form.password)
  const isPasswordValid = hasMinLength && hasLetter && hasDigit
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const canSubmit = Boolean(form.displayName.trim()) && isEmailValid && isPasswordValid

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-semibold text-foreground">{text.createSubAdmin}</h2>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <input
          value={form.displayName}
          onChange={e => onFormChange({ ...form, displayName: e.target.value })}
          placeholder={text.displayName}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.email}
          onChange={e => onFormChange({ ...form, email: e.target.value })}
          placeholder="subadmin@example.com"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={form.password}
          onChange={e => onFormChange({ ...form, password: e.target.value })}
          placeholder={text.password}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <Button
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          <Plus className="mr-2 h-4 w-4" />
          {text.createSubAdmin}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={hasMinLength ? "text-green-600" : "text-muted-foreground"}>{text.passwordMinLength}</span>
        <span className={hasLetter ? "text-green-600" : "text-muted-foreground"}>{text.passwordLetter}</span>
        <span className={hasDigit ? "text-green-600" : "text-muted-foreground"}>{text.passwordDigit}</span>
      </div>
      {!isEmailValid && form.email && (
        <p className="mt-2 text-xs text-destructive">{text.emailInvalid}</p>
      )}
      {message && (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p>
      )}
    </section>
  )
}
