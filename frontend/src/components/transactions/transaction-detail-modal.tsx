"use client"

import { X, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TransactionDetail } from "@/services/api/subscription-purchases"

type Language = "vi" | "en"

interface TransactionDetailModalProps {
  loading: boolean
  error: string
  detail: TransactionDetail | null
  language: Language
  onClose: () => void
}

const text = {
  vi: {
    title: "Chi tiết giao dịch",
    close: "Đóng",
    customerName: "Tên khách hàng",
    plan: "Gói mua",
    amount: "Giá tiền",
    paidAt: "Thời gian thanh toán",
    status: "Trạng thái",
    orderCode: "Mã đơn hàng",
    active: "Đã kích hoạt",
    expired: "Hết hạn",
    loading: "Đang tải chi tiết giao dịch...",
  },
  en: {
    title: "Transaction detail",
    close: "Close",
    customerName: "Customer name",
    plan: "Plan purchased",
    amount: "Amount",
    paidAt: "Paid at",
    status: "Status",
    orderCode: "Order code",
    active: "Active",
    expired: "Expired",
    loading: "Loading transaction detail...",
  },
} as const

function formatAmount(amount: number, language: Language) {
  const formatted = amount.toLocaleString(language === "vi" ? "vi-VN" : "en-US")
  return language === "vi" ? `${formatted}đ` : `${formatted} VND`
}

function formatPaidAt(paidAt: string, language: Language) {
  const date = new Date(paidAt)
  if (Number.isNaN(date.getTime())) return paidAt
  return date.toLocaleString(language === "vi" ? "vi-VN" : "en-US")
}

export function TransactionDetailModal({ loading, error, detail, language, onClose }: TransactionDetailModalProps) {
  const t = text[language]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{t.title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && detail && (
          <div className="space-y-3">
            <DetailRow label={t.customerName} value={detail.userDisplayName} />
            <DetailRow label={t.plan} value={detail.planName} />
            <DetailRow label={t.amount} value={formatAmount(detail.amount, language)} />
            <DetailRow label={t.paidAt} value={formatPaidAt(detail.paidAt, language)} />
            <DetailRow
              label={t.status}
              value={
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs font-medium " +
                    (detail.activationStatus === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {detail.activationStatus === "ACTIVE" ? t.active : t.expired}
                </span>
              }
            />
            <DetailRow label={t.orderCode} value={String(detail.orderCode)} />
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button variant="outline" onClick={onClose}>{t.close}</Button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
