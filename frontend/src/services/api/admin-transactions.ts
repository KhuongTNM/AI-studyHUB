import { getAccessToken } from "@/lib/auth-storage"
import type { PageResponse, TransactionHistoryItem, TransactionDetail } from "@/services/api/subscription-purchases"
import { MOCK_API } from "@/services/mock/mock-config"
import { mockGetAdminTransactionsRequest, mockGetAdminTransactionDetailRequest } from "@/services/mock/transaction-history.mock"

// ─── Lịch sử Giao dịch — Phía Admin & Sub-Admin (TXN-201 → TXN-203) ────────
// Xem: TransactionHistory_API_Contract.docx (v1.1) + TransactionHistory_Business_Logic.docx (v1.1)

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface AdminTransactionItem extends TransactionHistoryItem {
  userDisplayName: string
}

interface ErrorBody {
  message?: string
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore parse errors
  }
  return "Không thể tải lịch sử giao dịch."
}

/**
 * TXN-201 + TXN-202 — GET /api/admin/transactions
 * Danh sách giao dịch của TOÀN BỘ User, có thể lọc theo month/year và/hoặc keyword (Tên/Email).
 * GAP-5 (đã chốt): chỉ gửi keyword khi đủ >= 2 ký tự sau trim — component gọi hàm này nên
 * debounce 300-500ms trước khi gọi (xem useDebouncedTransactionKeyword bên dưới).
 */
export async function getAdminTransactionsApi(params: {
  page?: number
  size?: number
  month?: number
  year?: number
  keyword?: string
}): Promise<PageResponse<AdminTransactionItem>> {
  const qs = new URLSearchParams()
  if (params.page != null) qs.set("page", String(params.page))
  if (params.size != null) qs.set("size", String(params.size))
  if (params.month != null) qs.set("month", String(params.month))
  if (params.year != null) qs.set("year", String(params.year))
  const trimmedKeyword = params.keyword?.trim()
  if (trimmedKeyword && trimmedKeyword.length >= 2) qs.set("keyword", trimmedKeyword)

  const response = MOCK_API
    ? await mockGetAdminTransactionsRequest(params)
    : await fetch(`${API_BASE_URL}/api/admin/transactions?${qs.toString()}`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

/**
 * TXN-203 — GET /api/admin/transactions/{orderId}
 * Popup chi tiết — Admin/Sub-Admin xem được chi tiết của BẤT KỲ User nào.
 */
export async function getAdminTransactionDetailApi(orderId: string): Promise<TransactionDetail> {
  const response = MOCK_API
    ? await mockGetAdminTransactionDetailRequest(orderId)
    : await fetch(`${API_BASE_URL}/api/admin/transactions/${encodeURIComponent(orderId)}`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}
