import { Clock, Sparkles, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type PackageTier } from "@/lib/store"
import type { Language } from "@/states/types"

interface PackagesTabProps {
  currentUser: any
  packagePrices: any[]
  onBuy: (tier: PackageTier) => void
  language: Language
}

export function PackagesTab({ currentUser, packagePrices, onBuy, language }: PackagesTabProps) {
  const text = packagesText[language]

  const currentPlanLabel =
    currentUser.subscriptionExpiresAt && new Date(currentUser.subscriptionExpiresAt).getTime() < Date.now()
      ? text.expiredPlan
      : currentUser.subscriptionTier === "2-4"
      ? text.plan2To4
      : currentUser.subscriptionTier === "5+"
      ? text.plan5Plus
      : text.freePlan

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
          {currentUser.subscriptionTier && currentUser.subscriptionTier !== "free" && currentUser.subscriptionExpiresAt && (
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
            const isActive = currentUser.subscriptionTier === pkg.tier &&
              (!currentUser.subscriptionExpiresAt || new Date(currentUser.subscriptionExpiresAt).getTime() > Date.now())
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
                  <h4 className="mb-1 text-lg font-bold text-foreground">{pkg.name}</h4>
                  <div className="mb-4 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-foreground">
                      {pkg.price === 0 ? text.freePrice : `${pkg.price.toLocaleString("vi-VN")}đ`}
                    </span>
                    {pkg.price > 0 && <span className="text-xs text-muted-foreground">{text.perMonth}</span>}
                  </div>

                  <ul className="mb-6 space-y-3 border-t border-border pt-4 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <span>{text.aiChat}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <span>
                        {pkg.tier === "free"
                          ? text.noStudyRoom
                          : pkg.tier === "2-4"
                          ? text.room4
                          : text.room99}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <span>
                        {text.storage}: {pkg.tier === "free" ? "512 MB" : pkg.tier === "2-4" ? "1 GB" : "5 GB"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <span>{text.flashcards}</span>
                    </li>
                  </ul>
                </div>

                {pkg.tier === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    {text.default}
                  </Button>
                ) : (
                  <Button
                    variant={isActive ? "outline" : "default"}
                    className="w-full"
                    onClick={() => onBuy(pkg.tier)}
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
    plan2To4: "Gói 2-4 người (Premium)",
    plan5Plus: "Gói 5+ người (Enterprise)",
    freePlan: "Gói Free (Mặc định)",
    expiry: "Hạn sử dụng:",
    expired: "Đã hết hạn",
    active: "Đang hoạt động",
    availablePlans: "Các gói dịch vụ học tập nhóm",
    current: "Đang sử dụng",
    freePrice: "Miễn phí",
    perMonth: "/tháng",
    aiChat: "AI Chat cá nhân hỏi đáp",
    noStudyRoom: "Không hỗ trợ mở phòng học nhóm",
    room4: "Mở phòng học nhóm (tối đa 4 người)",
    room99: "Mở phòng học nhóm (tối đa 99 người)",
    storage: "Dung lượng lưu trữ",
    flashcards: "Tạo flashcards từ tài liệu",
    default: "Mặc định",
    renew: "Gia hạn gói",
    upgrade: "Nâng cấp ngay",
  },
  en: {
    currentSubscription: "Current subscription",
    planName: "Plan name:",
    expiredPlan: "Expired plan (Free)",
    plan2To4: "2-4 people plan (Premium)",
    plan5Plus: "5+ people plan (Enterprise)",
    freePlan: "Free plan (Default)",
    expiry: "Expires:",
    expired: "Expired",
    active: "Active",
    availablePlans: "Study group packages",
    current: "Current",
    freePrice: "Free",
    perMonth: "/month",
    aiChat: "Personal AI chat Q&A",
    noStudyRoom: "Study rooms are not available",
    room4: "Create study rooms (up to 4 people)",
    room99: "Create study rooms (up to 99 people)",
    storage: "Storage",
    flashcards: "Create flashcards from documents",
    default: "Default",
    renew: "Renew plan",
    upgrade: "Upgrade now",
  },
} as const
