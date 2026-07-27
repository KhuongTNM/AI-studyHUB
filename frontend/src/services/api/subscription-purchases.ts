import { getAccessToken } from "@/lib/auth-storage"
import { mapApiUserToStoreUser, type ApiUser } from "@/services/api/auth"
import type { User } from "@/lib/store"
import { MOCK_API } from "@/services/mock/mock-config"
import { mockGetTransactionHistoryRequest, mockGetTransactionDetailRequest } from "@/services/mock/transaction-history.mock"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface SubscriptionPurchase {
  orderId: string
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED"
  planName: string
  displayName: string
  amount: number
  content: string
  bankCode: string | null
  bankAccount: string | null
  accountName: string | null
  qrImageUrl: string | null
  qrCode?: string | null
  qrLink?: string | null
  user?: User | null
}

interface ApiSubscriptionPurchase extends Omit<SubscriptionPurchase, "user"> {
  user?: ApiUser | null
}

interface ErrorBody {
  message?: string
}

function getPlanName(tierOrPlanName: string): string {
  if (tierOrPlanName === "2-4") return "plan_2_4"
  if (tierOrPlanName === "5+") return "plan_5_plus"
  if (tierOrPlanName === "free") return "free"
  return tierOrPlanName
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore parse errors
  }
  return "Khong the tao thanh toan PayOS. Vui long thu lai."
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function mapPurchase(apiPurchase: ApiSubscriptionPurchase): SubscriptionPurchase {
  return {
    ...apiPurchase,
    amount: Number(apiPurchase.amount),
    user: apiPurchase.user ? mapApiUserToStoreUser(apiPurchase.user) : null,
  }
}

export async function createSubscriptionPurchaseApi(tierOrPlanName: string): Promise<SubscriptionPurchase> {
  const response = await fetch(`${API_BASE_URL}/api/subscription-purchases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ planName: getPlanName(tierOrPlanName) }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapPurchase((await response.json()) as ApiSubscriptionPurchase)
}

export async function getSubscriptionPurchaseApi(orderId: string): Promise<SubscriptionPurchase | null> {
  const response = await fetch(`${API_BASE_URL}/api/subscription-purchases/${encodeURIComponent(orderId)}`, {
    headers: authHeaders(),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await parseError(response))
  return mapPurchase((await response.json()) as ApiSubscriptionPurchase)
}

// ─── Lịch sử Giao dịch — Phía User (TXN-101 → TXN-103) ──────────────────────
// Xem: TransactionHistory_API_Contract.docx (v1.1) + TransactionHistory_Business_Logic.docx (v1.1)

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  numberOfElements?: number
  empty?: boolean
}

export interface TransactionHistoryItem {
  orderId: string
  planName: string
  amount: number
  paidAt: string
}

export interface TransactionDetail {
  userDisplayName: string
  planName: string
  amount: number
  paidAt: string
  activationStatus: "ACTIVE" | "EXPIRED"
  orderCode: number
}

async function parseHistoryError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore parse errors
  }
  return "Không thể tải lịch sử giao dịch."
}

/**
 * TXN-101 + TXN-102 — GET /api/subscription-purchases/history
 * Danh sách giao dịch mua gói THÀNH CÔNG của chính User đang đăng nhập, có thể lọc theo month/year.
 */
export async function getTransactionHistoryApi(params: {
  page?: number
  size?: number
  month?: number
  year?: number
}): Promise<PageResponse<TransactionHistoryItem>> {
  const qs = new URLSearchParams()
  if (params.page != null) qs.set("page", String(params.page))
  if (params.size != null) qs.set("size", String(params.size))
  if (params.month != null) qs.set("month", String(params.month))
  if (params.year != null) qs.set("year", String(params.year))

  const response = MOCK_API
    ? await mockGetTransactionHistoryRequest(params)
    : await fetch(`${API_BASE_URL}/api/subscription-purchases/history?${qs.toString()}`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseHistoryError(response))
  return response.json()
}

/**
 * TXN-103 — GET /api/subscription-purchases/history/{orderId}
 * Popup chi tiết — CHỈ khi giao dịch thuộc về đúng userId đang đăng nhập.
 */
export async function getTransactionDetailApi(orderId: string): Promise<TransactionDetail> {
  const response = MOCK_API
    ? await mockGetTransactionDetailRequest(orderId)
    : await fetch(
        `${API_BASE_URL}/api/subscription-purchases/history/${encodeURIComponent(orderId)}`,
        { headers: authHeaders() },
      )
  if (!response.ok) throw new Error(await parseHistoryError(response))
  return response.json()
}
