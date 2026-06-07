import { getAccessToken } from "@/lib/auth-storage"
import type { PackageTier } from "@/lib/store"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface ApiSubscriptionPlan {
  id: number
  name: string
  displayName: string
  price: number
  maxRoomMembers: number
  defaultStorageBytes: number
}

interface ErrorBody {
  message?: string
}

function getPlanName(tier: PackageTier): string {
  if (tier === "2-4") return "plan_2_4"
  if (tier === "5+") return "plan_5_plus"
  return "free"
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore parse errors
  }
  return "Không thể cập nhật giá gói. Vui lòng thử lại."
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchSubscriptionPlansApi(): Promise<ApiSubscriptionPlan[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/subscription-plans`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function updatePackagePriceApi(
  tier: PackageTier,
  price: number,
  adminPassword: string
): Promise<ApiSubscriptionPlan> {
  const response = await fetch(`${API_BASE_URL}/api/admin/subscription-plans/${getPlanName(tier)}/price`, {
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
