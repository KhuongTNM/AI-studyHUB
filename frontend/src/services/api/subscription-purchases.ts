import { getAccessToken } from "@/lib/auth-storage"
import { mapApiUserToStoreUser, type ApiUser } from "@/services/api/auth"
import type { PackageTier, User } from "@/lib/store"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://ai-studyhub.onrender.com"

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

export async function createSubscriptionPurchaseApi(tier: PackageTier): Promise<SubscriptionPurchase> {
  const response = await fetch(`${API_BASE_URL}/api/subscription-purchases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ planName: getPlanName(tier) }),
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