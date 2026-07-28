import { getAccessToken } from "@/lib/auth-storage"
import type { PackageTier } from "@/lib/store"
import { MOCK_API } from "@/services/mock/mock-config"
import {
  mockFetchSubscriptionPlansRequest,
  mockFetchSubscriptionPlanRequest,
  mockCreateSubscriptionPlanRequest,
  mockUpdateSubscriptionPlanRequest,
  mockUpdatePackagePriceRequest,
  mockDeleteSubscriptionPlanRequest,
  mockFetchActiveUserCountRequest,
} from "@/services/mock/subscription-plans.mock"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

/**
 * SubscriptionPlan object — theo AI-studyHUB_API_File_SubscriptionPlan.docx, mục 7.
 *
 * KHÔNG còn field displayName (BR-201, Business Logic File — Rule 1): "name" là
 * field DUY NHẤT mang tên gói, vừa dùng để hiển thị vừa dùng làm khoá tra cứu.
 * Không đọc / không gửi displayName ở bất kỳ đâu trong toàn bộ FE nữa.
 */
export interface ApiSubscriptionPlan {
  id: number
  name: string
  price: number
  maxRoomMembers: number
  defaultStorageBytes: number
  createGroupLimit: number
  joinGroupLimit: number
  dailyAiChatLimit: number
  maxFlashcards: number
}

export interface CreateSubscriptionPlanInput {
  name: string
  price: number
  maxRoomMembers: number
  defaultStorageBytes: number
  createGroupLimit: number
  joinGroupLimit: number
  dailyAiChatLimit?: number
  maxFlashcards?: number
}

export interface UpdateSubscriptionPlanInput {
  name?: string | null
  price?: number | null
  defaultStorageBytes?: number | null
  createGroupLimit?: number | null
  joinGroupLimit?: number | null
  dailyAiChatLimit?: number | null
  maxFlashcards?: number | null
}

interface ErrorBody {
  message?: string
}

/**
 * ActiveUserCountResponse — theo
 * Subscription_SoftDelete_Grandfathering_API_Contract.docx, mục 5.2
 * (SUB-201a, GET .../active-user-count). Dùng chung cho cả 2 Pop-up xác nhận:
 * Xoá gói (SUB-201) và Sửa gói (SUB-302).
 */
export interface ActiveUserCountResponse {
  activeUserCount: number
}

function getPlanName(plan: PackageTier | string): string {
  if (plan === "2-4") return "plan_2_4"
  if (plan === "5+") return "plan_5_plus"
  if (plan === "free") return "free"
  return plan
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore parse errors
  }
  return "Không thể xử lý gói dịch vụ. Vui lòng thử lại."
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Public pricing endpoint. It intentionally does not send an admin-only request. */
export async function fetchSubscriptionPlansApi(): Promise<ApiSubscriptionPlan[]> {
  const response = MOCK_API
    ? await mockFetchSubscriptionPlansRequest()
    : await fetch(`${API_BASE_URL}/api/subscription-plans`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function fetchSubscriptionPlanApi(planName: string): Promise<ApiSubscriptionPlan> {
  const response = MOCK_API
    ? await mockFetchSubscriptionPlanRequest(planName)
    : await fetch(`${API_BASE_URL}/api/subscription-plans/${encodeURIComponent(planName)}`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

/**
 * PATCH .../price — BR-203: BE (và mock) từ chối gọi API này trên gói "free",
 * luôn trả 400 "Không thể thay đổi giá gói Miễn phí." bất kể giá trị gửi lên.
 */
export async function updatePackagePriceApi(
  plan: PackageTier | string,
  price: number,
): Promise<ApiSubscriptionPlan> {
  const planName = getPlanName(plan)
  const response = MOCK_API
    ? await mockUpdatePackagePriceRequest(planName, price)
    : await fetch(`${API_BASE_URL}/api/admin/subscription-plans/${planName}/price`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ price }),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function createSubscriptionPlanApi(
  input: CreateSubscriptionPlanInput,
): Promise<ApiSubscriptionPlan> {
  const response = MOCK_API
    ? await mockCreateSubscriptionPlanRequest(input)
    : await fetch(`${API_BASE_URL}/api/admin/subscription-plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(input),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

/**
 * PUT .../{planName} — BR-203: khi planName hiện tại là "free", BE (và mock) từ
 * chối riêng phần price (khác giá hiện tại) và riêng phần name (khác "free"),
 * các field còn lại (maxRoomMembers, defaultStorageBytes, createGroupLimit,
 * joinGroupLimit, dailyAiChatLimit, maxFlashcards) vẫn cập nhật bình thường.
 */
export async function updateSubscriptionPlanApi(
  planName: string,
  input: UpdateSubscriptionPlanInput,
): Promise<ApiSubscriptionPlan> {
  const response = MOCK_API
    ? await mockUpdateSubscriptionPlanRequest(planName, input)
    : await fetch(`${API_BASE_URL}/api/admin/subscription-plans/${encodeURIComponent(planName)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(input),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

/**
 * GET .../{planName}/active-user-count — SUB-201a. Trả số User đang có
 * Subscription ACTIVE gắn với gói này, tính tại đúng thời điểm gọi (Backend
 * KHÔNG cache) — vì vậy nơi gọi PHẢI fetch lại mỗi lần mở Pop-up, không tái
 * sử dụng giá trị đã fetch trước đó.
 *
 * Dùng chung cho 2 Pop-up: xác nhận Xoá gói (SUB-201) và xác nhận Sửa gói
 * (SUB-302). KHÔNG chặn theo isDeleted phía Backend — nhưng FE luôn gọi với
 * planName GỐC (trước khi bị đổi thành `<name>_DELETED_<uuid8>` lúc xoá), vì
 * gọi ngay tại thời điểm Admin bấm "Xoá"/"Sửa", trước khi DELETE/PUT diễn ra.
 */
export async function fetchActiveUserCountApi(planName: string): Promise<number> {
  const response = MOCK_API
    ? await mockFetchActiveUserCountRequest(planName)
    : await fetch(
        `${API_BASE_URL}/api/admin/subscription-plans/${encodeURIComponent(planName)}/active-user-count`,
        { headers: authHeaders() },
      )
  if (!response.ok) throw new Error(await parseError(response))
  const body = (await response.json()) as ActiveUserCountResponse
  return body.activeUserCount
}

/** DELETE .../{planName} — BR-202: gói "free" luôn bị từ chối xoá, không phụ thuộc subscription ACTIVE. */
export async function deleteSubscriptionPlanApi(planName: string): Promise<void> {
  const response = MOCK_API
    ? await mockDeleteSubscriptionPlanRequest(planName)
    : await fetch(`${API_BASE_URL}/api/admin/subscription-plans/${encodeURIComponent(planName)}`, {
        method: "DELETE",
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
}
