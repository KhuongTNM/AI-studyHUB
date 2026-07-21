import { getAccessToken } from "@/lib/auth-storage"
import type { PackageTier } from "@/lib/store"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface ApiSubscriptionPlan {
  id: number
  name: string
  /** Kept optional while older backend deployments still return this alias. */
  displayName?: string | null
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
  createGroupLimit?: number | null
  dailyAiChatLimit?: number | null
  maxFlashcards?: number | null
}

interface ErrorBody {
  message?: string
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
  const response = await fetch(`${API_BASE_URL}/api/subscription-plans`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function fetchSubscriptionPlanApi(planName: string): Promise<ApiSubscriptionPlan> {
  const response = await fetch(`${API_BASE_URL}/api/subscription-plans/${encodeURIComponent(planName)}`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function updatePackagePriceApi(
  plan: PackageTier | string,
  price: number,
  adminPassword: string
): Promise<ApiSubscriptionPlan> {
  const response = await fetch(`${API_BASE_URL}/api/admin/subscription-plans/${getPlanName(plan)}/price`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ price, adminPassword }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function createSubscriptionPlanApi(
  input: CreateSubscriptionPlanInput,
  adminPassword: string,
): Promise<ApiSubscriptionPlan> {
  const response = await fetch(`${API_BASE_URL}/api/admin/subscription-plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ ...input, adminPassword }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function updateSubscriptionPlanApi(
  planName: string,
  input: UpdateSubscriptionPlanInput,
  adminPassword: string,
): Promise<ApiSubscriptionPlan> {
  const response = await fetch(`${API_BASE_URL}/api/admin/subscription-plans/${encodeURIComponent(planName)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ ...input, adminPassword }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function deleteSubscriptionPlanApi(planName: string, adminPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/subscription-plans/${encodeURIComponent(planName)}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
      "X-Admin-Password": adminPassword,
    },
  })
  if (!response.ok) throw new Error(await parseError(response))
}
