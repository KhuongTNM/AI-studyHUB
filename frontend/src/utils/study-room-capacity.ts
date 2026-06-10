import type { PackagePrice, PackageTier, User } from "@/states/types"

const FALLBACK_ROOM_CAPACITY: Record<Exclude<PackageTier, "free">, number> = {
  "2-4": 4,
  "5+": 99,
}

export function getActiveHostPackageTier(user: User | null): Exclude<PackageTier, "free"> | null {
  if (!user) return null

  if (user.role === "admin" || user.role === "sub-admin") {
    return "5+"
  }

  if (user.subscriptionTier !== "2-4" && user.subscriptionTier !== "5+") {
    return null
  }

  if (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt).getTime() <= Date.now()) {
    return null
  }

  return user.subscriptionTier
}

export function getRoomCapacityForHost(
  user: User | null,
  packagePrices: PackagePrice[],
): number | null {
  const hostPackageTier = getActiveHostPackageTier(user)
  if (!hostPackageTier) return null

  const planCapacity = packagePrices.find(plan => plan.tier === hostPackageTier)?.maxUsers
  return planCapacity && planCapacity > 0 ? planCapacity : FALLBACK_ROOM_CAPACITY[hostPackageTier]
}

