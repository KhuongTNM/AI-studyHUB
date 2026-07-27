"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, ChevronLeft, ChevronRight, Receipt, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getTransactionHistoryApi,
  getTransactionDetailApi,
  type TransactionHistoryItem,
  type TransactionDetail,
} from "@/services/api/subscription-purchases"
import { TransactionDetailModal } from "@/components/transactions/transaction-detail-modal"

type Language = "vi" | "en"

interface HistoryTabProps {
  language: Language
}

const PAGE_SIZE = 10
const MIN_YEAR = 2020

const text = {
  vi: {
    title: "Lịch sử giao dịch",
    subtitle: "Toàn bộ giao dịch mua gói dịch vụ đã thanh toán thành công của bạn.",
    colPlan: "Gói đăng ký",
    colPaidAt: "Thời gian thanh toán",
    colAmount: "Giá tiền",
    month: "Tháng",
    year: "Năm",
    allMonths: "Tất cả các tháng",
    search: "Tìm kiếm",
    clearFilters: "Xoá bộ lọc",
    refresh: "Làm mới",
    emptyNoData: "Bạn chưa có giao dịch nào.",
    emptyFiltered: "Không có giao dịch nào trong khoảng thời gian đã chọn. Hãy thử Tháng/Năm khác.",
    loading: "Đang tải lịch sử giao dịch...",
    errorLoad: "Không thể tải lịch sử giao dịch.",
    retry: "Thử lại",
    page: "Trang",
    of: "/",
    prev: "Trước",
    next: "Sau",
  },
  en: {
    title: "Transaction history",
    subtitle: "All of your successfully paid subscription purchases.",
    colPlan: "Plan",
    colPaidAt: "Paid at",
    colAmount: "Amount",
    month: "Month",
    year: "Year",
    allMonths: "All months",
    search: "Search",
    clearFilters: "Clear filters",
    refresh: "Refresh",
    emptyNoData: "You don't have any transactions yet.",
    emptyFiltered: "No transactions found for the selected period. Try a different month/year.",
    loading: "Loading transaction history...",
    errorLoad: "Could not load transaction history.",
    retry: "Retry",
    page: "Page",
    of: "of",
    prev: "Previous",
    next: "Next",
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

export function HistoryTab({ language }: HistoryTabProps) {
  const t = text[language]
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: currentYear + 1 - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i).reverse()

  const [items, setItems] = useState<TransactionHistoryItem[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [monthDraft, setMonthDraft] = useState<number | "">("")
  const [yearDraft, setYearDraft] = useState<number | "">("")
  const [appliedMonth, setAppliedMonth] = useState<number | undefined>(undefined)
  const [appliedYear, setAppliedYear] = useState<number | undefined>(undefined)
  const [hasFilter, setHasFilter] = useState(false)

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TransactionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")

  const load = useCallback(async (targetPage: number, month?: number, year?: number) => {
    setLoading(true)
    setError("")
    try {
      const result = await getTransactionHistoryApi({ page: targetPage, size: PAGE_SIZE, month, year })
      setItems(result.content)
      setTotalPages(result.totalPages)
      setPage(result.number)
    } catch (err) {
      setItems([])
      setError(err instanceof Error ? err.message : t.errorLoad)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load(0, undefined, undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilters = () => {
    const month = monthDraft === "" ? undefined : Number(monthDraft)
    // Nếu chỉ chọn Tháng mà không chọn Năm, FE cũng áp dụng Năm hiện tại (giống Business Logic TXN-102 Mục 4)
    const year = yearDraft === "" ? (month != null ? currentYear : undefined) : Number(yearDraft)
    setAppliedMonth(month)
    setAppliedYear(year)
    setHasFilter(month != null || year != null)
    void load(0, month, year)
  }

  const clearFilters = () => {
    setMonthDraft("")
    setYearDraft("")
    setAppliedMonth(undefined)
    setAppliedYear(undefined)
    setHasFilter(false)
    void load(0, undefined, undefined)
  }

  const goToPage = (nextPage: number) => {
    if (nextPage < 0 || nextPage >= totalPages) return
    void load(nextPage, appliedMonth, appliedYear)
  }

  const openDetail = async (orderId: string) => {
    setSelectedOrderId(orderId)
    setDetail(null)
    setDetailError("")
    setDetailLoading(true)
    try {
      const result = await getTransactionDetailApi(orderId)
      setDetail(result)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : t.errorLoad)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedOrderId(null)
    setDetail(null)
    setDetailError("")
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <Receipt className="h-4 w-4 text-primary" />
            {t.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={loading}
          onClick={() => void load(page, appliedMonth, appliedYear)}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t.refresh}
        </Button>
      </div>

      {/* Bộ lọc Tháng/Năm — TXN-102 */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t.month}</span>
          <select
            value={monthDraft}
            onChange={e => setMonthDraft(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{t.allMonths}</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t.year}</span>
          <select
            value={yearDraft}
            onChange={e => setYearDraft(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">—</option>
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <Button size="sm" onClick={applyFilters} disabled={loading}>{t.search}</Button>
        {hasFilter && (
          <Button size="sm" variant="ghost" className="gap-1" onClick={clearFilters} disabled={loading}>
            <X className="h-3.5 w-3.5" />
            {t.clearFilters}
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="outline" onClick={() => void load(page, appliedMonth, appliedYear)}>{t.retry}</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">{t.colPlan}</th>
              <th className="px-4 py-3 font-semibold">{t.colPaidAt}</th>
              <th className="px-4 py-3 font-semibold">{t.colAmount}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">{t.loading}</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  {hasFilter ? t.emptyFiltered : t.emptyNoData}
                </td>
              </tr>
            ) : (
              items.map(item => (
                <tr
                  key={item.orderId}
                  className="cursor-pointer bg-background/50 hover:bg-muted/60"
                  onClick={() => void openDetail(item.orderId)}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{item.planName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatPaidAt(item.paidAt, language)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatAmount(item.amount, language)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page <= 0 || loading} onClick={() => goToPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
            {t.prev}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t.page} {page + 1} {t.of} {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages - 1 || loading} onClick={() => goToPage(page + 1)}>
            {t.next}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {selectedOrderId && (
        <TransactionDetailModal
          loading={detailLoading}
          error={detailError}
          detail={detail}
          language={language}
          onClose={closeDetail}
        />
      )}
    </div>
  )
}
