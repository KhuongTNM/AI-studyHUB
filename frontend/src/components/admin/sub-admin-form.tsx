"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SubAdminForm({
  form,
  onFormChange,
  onSubmit,
  text,
}: {
  form: { displayName: string; email: string; password: string }
  onFormChange: (form: any) => void
  onSubmit: () => void
  text: any
}) {
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
          disabled={!form.displayName || !form.email || !form.password}
          onClick={onSubmit}
        >
          <Plus className="mr-2 h-4 w-4" />
          {text.createSubAdmin}
        </Button>
      </div>
    </section>
  )
}
