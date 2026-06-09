import { useState } from "react"
import { CreditCard, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type PackageTier } from "@/lib/store"
import {
  completeSubscriptionPurchaseForDevApi,
  createSubscriptionPurchaseApi,
  type SubscriptionPurchase,
} from "@/services/api/subscription-purchases"

interface CheckoutModalProps {
  selectedTier: PackageTier
  packagePrices: any[]
  currentUser: any
  updateUser: (id: string, data: any) => void
  onClose: () => void
  onSuccess: () => void
}

export function CheckoutModal({
  selectedTier,
  packagePrices,
  currentUser,
  updateUser,
  onClose,
  onSuccess
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<"qr" | "card" | "wallet">("qr")
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [purchaseOrder, setPurchaseOrder] = useState<SubscriptionPurchase | null>(null)
  const [purchaseError, setPurchaseError] = useState("")
  const [isCreatingPurchase, setIsCreatingPurchase] = useState(false)
  const [isCompletingPurchase, setIsCompletingPurchase] = useState(false)

  const createVietQrPurchase = async () => {
    setIsCreatingPurchase(true)
    setPurchaseError("")
    try {
      const order = await createSubscriptionPurchaseApi(selectedTier)
      setPurchaseOrder(order)
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : "Không thể tạo thanh toán VietQR.")
    } finally {
      setIsCreatingPurchase(false)
    }
  }

  const completeVietQrPurchaseForDev = async () => {
    if (!purchaseOrder) return
    setIsCompletingPurchase(true)
    setPurchaseError("")
    try {
      const completed = await completeSubscriptionPurchaseForDevApi(purchaseOrder.orderId)
      setPurchaseOrder(completed)
      if (completed.user) {
        updateUser(currentUser.id, {
          subscriptionTier: completed.user.subscriptionTier,
          subscriptionExpiresAt: completed.user.subscriptionExpiresAt,
          storageLimit: completed.user.storageLimit,
        })
      }
      setPurchaseSuccess(true)
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : "Không thể xác nhận thanh toán.")
    } finally {
      setIsCompletingPurchase(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
        {!purchaseSuccess ? (
          <>
            <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Xác nhận mua gói dịch vụ
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Bạn đang đăng ký gói{" "}
              <span className="font-semibold text-foreground">
                {selectedTier === "2-4" ? "Gói 2-4 người" : "Gói 5+ người"}
              </span>{" "}
              thời hạn 1 tháng.
            </p>

            {/* Price Display */}
            <div className="mb-6 rounded-xl bg-muted p-4 flex justify-between items-center">
              <span className="text-sm text-muted-foreground font-medium">Tổng tiền cần thanh toán:</span>
              <span className="text-xl font-extrabold text-primary">
                {(packagePrices.find(p => p.tier === selectedTier)?.price || 0).toLocaleString("vi-VN")}đ
              </span>
            </div>

            {/* Payment Methods */}
            <div className="space-y-3 mb-6">
              <p className="text-sm font-semibold text-foreground">Chọn phương thức thanh toán:</p>
              {[
                { id: "qr", label: "VietQR", desc: "Mã QR chuyển khoản ngân hàng cho môi trường dev", disabled: false },
                { id: "card", label: "Thẻ ATM / Visa / Mastercard", desc: "Sẽ triển khai sau", disabled: true },
                { id: "wallet", label: "Ví điện tử", desc: "Sẽ triển khai sau", disabled: true }
              ].map((method) => (
                <label
                  key={method.id}
                  onClick={() => !method.disabled && setPaymentMethod(method.id as any)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                    paymentMethod === method.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                    method.disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === method.id}
                    disabled={method.disabled}
                    onChange={() => {}}
                    className="mt-1 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{method.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {purchaseError && (
              <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {purchaseError}
              </p>
            )}

            {purchaseOrder && (
              <div className="mb-6 space-y-4 rounded-xl border border-border bg-background p-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Mã đơn</p>
                    <p className="font-semibold text-foreground">{purchaseOrder.orderId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Nội dung CK</p>
                    <p className="font-semibold text-foreground">{purchaseOrder.content}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ngân hàng</p>
                    <p className="font-semibold text-foreground">{purchaseOrder.bankCode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tài khoản</p>
                    <p className="font-semibold text-foreground">{purchaseOrder.bankAccount}</p>
                  </div>
                </div>
                <img
                  src={purchaseOrder.qrImageUrl}
                  alt={`VietQR ${purchaseOrder.orderId}`}
                  className="mx-auto h-56 w-56 rounded-lg border border-border bg-white object-contain p-2"
                />
                <p className="text-center text-xs text-muted-foreground">
                  Dev mode: quét QR hoặc dùng nút mô phỏng callback sau khi kiểm tra thông tin thanh toán.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Hủy bỏ
              </Button>
              {!purchaseOrder ? (
                <Button className="flex-1 gap-2" disabled={isCreatingPurchase} onClick={createVietQrPurchase}>
                  {isCreatingPurchase ? "Đang tạo QR..." : "Tạo mã VietQR"}
                </Button>
              ) : (
                <Button className="flex-1 gap-2" disabled={isCompletingPurchase} onClick={completeVietQrPurchaseForDev}>
                  {isCompletingPurchase ? "Đang xác nhận..." : "Dev: giả lập đã thanh toán"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Thanh toán thành công!</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Tài khoản của bạn đã được nâng cấp lên{" "}
              <span className="font-bold text-foreground">
                {selectedTier === "2-4" ? "Gói 2-4 người" : "Gói 5+ người"}
              </span>
              . Hạn sử dụng của gói là 1 tháng kể từ hôm nay.
            </p>
            <Button className="w-full" onClick={onSuccess}>
              Tuyệt vời! Quay lại
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
