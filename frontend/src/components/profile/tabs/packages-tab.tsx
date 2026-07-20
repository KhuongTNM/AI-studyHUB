import { Clock, Sparkles, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Language, PackagePrice } from "@/states/types"
import { getLocalizedPlanName } from "@/configs/subscription-plan-labels"

interface PackagesTabProps {
  currentUser: any
  packagePrices: PackagePrice[]
  onBuy: (plan: PackagePrice) => void
  language: Language
}

export function PackagesTab({ currentUser, packagePrices, onBuy, language }: PackagesTabProps) {
  const text = packagesText[language]

  const currentPlan = packagePrices.find(pkg => Number(pkg.id) === currentUser.subscriptionPlanId)
  const hasExplicitPlan = currentUser.subscriptionPlanId !== null && currentUser.subscriptionPlanId !== undefined
  const currentPlanExpired = Boolean(
    currentUser.subscriptionExpiresAt && new Date(currentUser.subscriptionExpiresAt).getTime() < Date.now(),
  )
  const currentPlanLabel =
    currentPlanExpired
      ? text.expiredPlan
      : currentPlan ? getLocalizedPlanName(currentPlan, language) :
        (currentUser.subscriptionTier === "2-4"
          ? text.plan2To4
          : currentUser.subscriptionTier === "5+"
          ? text.plan5Plus
          : text.freePlan)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-violet-500/5 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Sparkles className="h-5 w-5 animate-pulse text-primary" />
          {text.currentSubscription}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{text.planName}</p>
            <p className="text-lg font-bold text-foreground">{currentPlanLabel}</p>
          </div>
          {((currentPlan && currentPlan.price > 0) || (!currentPlan && currentUser.subscriptionTier !== "free")) && currentUser.subscriptionExpiresAt && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{text.expiry}</p>
              <p className="flex items-center gap-1.5 text-lg font-bold text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                {new Date(currentUser.subscriptionExpiresAt).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}
                {new Date(currentUser.subscriptionExpiresAt).getTime() < Date.now() ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{text.expired}</span>
                ) : (
                  <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">{text.active}</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-6 text-center text-lg font-semibold text-foreground">{text.availablePlans}</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {packagePrices.map((pkg) => {
            // The persisted plan id is authoritative. The tier fallback is
            // only for legacy/mock users without a plan id. This prevents a
            // custom paid plan from also being marked as the Free plan.
            const matchesCurrentPlan = hasExplicitPlan
              ? Number(pkg.id) === Number(currentUser.subscriptionPlanId)
              : currentUser.subscriptionTier === pkg.tier
            const isActive = matchesCurrentPlan && !currentPlanExpired
            const planName = getLocalizedPlanName(pkg, language)
            const isFreePlan = (pkg.planName ?? pkg.tier) === "free"
            const createGroupLimit = pkg.createGroupLimit ?? 0
            const joinGroupLimit = pkg.joinGroupLimit ?? pkg.maxUsers
            const dailyAiChatLimit = pkg.dailyAiChatLimit ?? 5
            const maxFlashcards = pkg.maxFlashcards ?? 5
            return (
              <div
                key={pkg.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-2xl border bg-card p-6 transition-all hover:shadow-lg",
                  isActive ? "scale-[1.02] border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50",
                )}
              >
                {isActive && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
                    {text.current}
                  </span>
                )}
                <div>
                  <h4 className="mb-1 text-lg font-bold text-foreground">{planName}</h4>
                  <div className="mb-4 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-foreground">
                      {pkg.price === 0 ? text.freePrice : formatPrice(pkg.price, language)}
                    </span>
                    {pkg.price > 0 && <span className="text-xs text-muted-foreground">{text.perMonth}</span>}
                  </div>

                  <ul className="mb-6 space-y-3 border-t border-border pt-4 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <span>{formatLimitText(dailyAiChatLimit, text.aiChatLimit, text.aiChatUnlimited, text.aiChatDisabled)}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <span>
                        {createGroupLimit === 0
                          ? text.noGroupChat(joinGroupLimit)
                          : text.groupLimits(createGroupLimit, joinGroupLimit)}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <span>
                        {text.storage}: {pkg.storageLabel ?? "1 GB"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <span>{formatLimitText(maxFlashcards, text.flashcardLimit, text.flashcardsUnlimited, text.flashcardsDisabled)}</span>
                    </li>
                  </ul>
                </div>

                {isFreePlan ? (
                  <Button variant="outline" className="w-full" disabled>
                    {text.default}
                  </Button>
                ) : (
                  <Button
                    variant={isActive ? "outline" : "default"}
                    className="w-full"
                    onClick={() => onBuy(pkg)}
                  >
                    {isActive ? text.renew : text.upgrade}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const packagesText = {
  vi: {
    currentSubscription: "Gói dịch vụ hiện tại",
    planName: "Tên gói:",
    expiredPlan: "Gói đã hết hạn (Free)",
    plan2To4: "Gói Pro",
    plan5Plus: "Gói VIP",
    freePlan: "Gói Free (Mặc định)",
    freeCard: "Gói Miễn Phí",
    plan2To4Card: "Gói Pro",
    plan5PlusCard: "Gói VIP",
    expiry: "Hạn sử dụng:",
    expired: "Đã hết hạn",
    active: "Đang hoạt động",
    availablePlans: "Các gói dịch vụ học tập nhóm",
    current: "Đang sử dụng",
    freePrice: "Miễn phí",
    perMonth: "/tháng",
    aiChatLimit: (limit: number) => `AI Chat cá nhân: ${limit} lượt/ngày`,
    aiChatUnlimited: "AI Chat cá nhân: không giới hạn",
    aiChatDisabled: "Không có lượt AI Chat cá nhân",
    noGroupChat: (joinLimit: number) => `Không hỗ trợ tạo nhóm, tham gia ${formatCount(joinLimit, "nhóm", "nhóm", "không giới hạn")}`,
    groupLimits: (createLimit: number, joinLimit: number) => `Tạo ${formatCount(createLimit, "nhóm", "nhóm", "không giới hạn")}, tham gia ${formatCount(joinLimit, "nhóm", "nhóm", "không giới hạn")}`,
    storage: "Dung lượng lưu trữ",
    flashcardLimit: (limit: number) => `Tối đa ${limit} flashcards`,
    flashcardsUnlimited: "Flashcards: không giới hạn",
    flashcardsDisabled: "Không có flashcards",
    default: "Mặc định",
    renew: "Gia hạn gói",
    upgrade: "Nâng cấp ngay",
  },
  en: {
    currentSubscription: "Current subscription",
    planName: "Plan name:",
    expiredPlan: "Expired plan (Free)",
    plan2To4: "Pro plan",
    plan5Plus: "VIP plan",
    freePlan: "Free plan (Default)",
    freeCard: "Free plan",
    plan2To4Card: "Pro plan",
    plan5PlusCard: "VIP plan",
    expiry: "Expires:",
    expired: "Expired",
    active: "Active",
    availablePlans: "Study group packages",
    current: "Current",
    freePrice: "Free",
    perMonth: "/month",
    aiChatLimit: (limit: number) => `Personal AI chat: ${limit} uses/day`,
    aiChatUnlimited: "Personal AI chat: unlimited",
    aiChatDisabled: "No personal AI chat uses",
    noGroupChat: (joinLimit: number) => `Group creation is not available, join ${formatCount(joinLimit, "group", "groups", "unlimited")}`,
    groupLimits: (createLimit: number, joinLimit: number) => `Create ${formatCount(createLimit, "group", "groups", "unlimited")}, join ${formatCount(joinLimit, "group", "groups", "unlimited")}`,
    storage: "Storage",
    flashcardLimit: (limit: number) => `Up to ${limit} flashcards`,
    flashcardsUnlimited: "Flashcards: unlimited",
    flashcardsDisabled: "No flashcards",
    default: "Default",
    renew: "Renew plan",
    upgrade: "Upgrade now",
  },
} as const

function formatPrice(price: number, language: Language) {
  const amount = price.toLocaleString(language === "vi" ? "vi-VN" : "en-US")
  return language === "vi" ? `${amount}đ` : `${amount} VND`
}

function formatCount(value: number, singular: string, plural: string, unlimited: string) {
  if (value === -1) return unlimited
  return `${value} ${value === 1 ? singular : plural}`
}

function formatLimitText(
  value: number,
  limited: (value: number) => string,
  unlimited: string,
  disabled: string,
) {
  if (value === -1) return unlimited
  if (value === 0) return disabled
  return limited(value)
}
