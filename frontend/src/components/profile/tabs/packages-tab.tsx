import { Clock, Sparkles, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type PackageTier } from "@/lib/store"

interface PackagesTabProps {
  currentUser: any
  packagePrices: any[]
  onBuy: (tier: PackageTier) => void
}

export function PackagesTab({ currentUser, packagePrices, onBuy }: PackagesTabProps) {
  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-violet-500/5 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          Gói dịch vụ hiện tại
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Tên gói:</p>
            <p className="text-lg font-bold text-foreground">
              {currentUser.subscriptionExpiresAt && new Date(currentUser.subscriptionExpiresAt).getTime() < Date.now()
                ? "Gói đã hết hạn (Free)"
                : currentUser.subscriptionTier === "2-4"
                ? "Gói 2-4 người (Premium)"
                : currentUser.subscriptionTier === "5+"
                ? "Gói 5+ người (Enterprise)"
                : "Gói Free (Mặc định)"}
            </p>
          </div>
          {currentUser.subscriptionTier && currentUser.subscriptionTier !== "free" && currentUser.subscriptionExpiresAt && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Hạn sử dụng:</p>
              <p className="text-lg font-bold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                {new Date(currentUser.subscriptionExpiresAt).toLocaleDateString("vi-VN")}
                {new Date(currentUser.subscriptionExpiresAt).getTime() < Date.now() ? (
                  <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full font-medium">Đã hết hạn</span>
                ) : (
                  <span className="text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full font-medium">Đang hoạt động</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Package Options */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-6 text-center">Các gói dịch vụ học tập nhóm</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {packagePrices.map((pkg) => {
            const isActive = currentUser.subscriptionTier === pkg.tier &&
                             (!currentUser.subscriptionExpiresAt || new Date(currentUser.subscriptionExpiresAt).getTime() > Date.now());
            return (
              <div
                key={pkg.id}
                className={cn(
                  "relative rounded-2xl border bg-card p-6 flex flex-col justify-between transition-all hover:shadow-lg",
                  isActive
                    ? "border-primary ring-2 ring-primary/20 scale-[1.02]"
                    : "border-border hover:border-primary/50"
                )}
              >
                {isActive && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
                    Đang sử dụng
                  </span>
                )}
                <div>
                  <h4 className="text-lg font-bold text-foreground mb-1">{pkg.name}</h4>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-extrabold text-foreground">
                      {pkg.price === 0 ? "Miễn phí" : `${pkg.price.toLocaleString("vi-VN")}đ`}
                    </span>
                    {pkg.price > 0 && <span className="text-xs text-muted-foreground">/tháng</span>}
                  </div>

                  <ul className="space-y-3 mb-6 text-sm text-muted-foreground border-t border-border pt-4">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>AI Chat cá nhân hỏi đáp</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>
                        {pkg.tier === "free"
                          ? "Không hỗ trợ mở phòng học nhóm"
                          : pkg.tier === "2-4"
                          ? "Mở phòng học nhóm (tối đa 4 người)"
                          : "Mở phòng học nhóm (tối đa 99 người)"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>
                        Dung lượng lưu trữ:{" "}
                        {pkg.tier === "free" ? "512 MB" : pkg.tier === "2-4" ? "1 GB" : "5 GB"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>Tạo flashcards từ tài liệu</span>
                    </li>
                  </ul>
                </div>

                {pkg.tier === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    Mặc định
                  </Button>
                ) : (
                  <Button
                    variant={isActive ? "outline" : "default"}
                    className="w-full"
                    onClick={() => onBuy(pkg.tier)}
                  >
                    {isActive ? "Gia hạn gói" : "Nâng cấp ngay"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}
