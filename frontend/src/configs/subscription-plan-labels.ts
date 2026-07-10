import type { Language } from "@/states/types"

type LocalizedPlanInput = {
  planName?: string | null
  tier?: string | null
  name?: string | null
}

const BUILT_IN_PLAN_LABELS = {
  free: {
    vi: "Gói Miễn Phí",
    en: "Free plan",
  },
  plan_2_4: {
    vi: "Gói Pro",
    en: "Pro plan",
  },
  plan_5_plus: {
    vi: "Gói VIP",
    en: "VIP plan",
  },
} as const

type BuiltInPlanName = keyof typeof BUILT_IN_PLAN_LABELS

export function normalizePlanName(planName?: string | null, tier?: string | null): string {
  const value = (planName || tier || "").trim()
  if (value === "2-4") return "plan_2_4"
  if (value === "5+") return "plan_5_plus"
  return value
}

export function isBuiltInPlanName(planName?: string | null, tier?: string | null): boolean {
  return normalizePlanName(planName, tier) in BUILT_IN_PLAN_LABELS
}

export function getLocalizedPlanName(plan: LocalizedPlanInput, language: Language): string {
  const normalized = normalizePlanName(plan.planName, plan.tier)
  if (normalized in BUILT_IN_PLAN_LABELS) {
    return BUILT_IN_PLAN_LABELS[normalized as BuiltInPlanName][language]
  }

  return plan.name?.trim() || normalized || (language === "vi" ? "Gói dịch vụ" : "Subscription plan")
}
