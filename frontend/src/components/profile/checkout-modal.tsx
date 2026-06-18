import { useState } from "react"
import { CreditCard, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type PackageTier } from "@/lib/store"
import type { Language } from "@/states/types"
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
  language: Language
  onClose: () => void
  onSuccess: () => void
}

export function CheckoutModal({
  selectedTier,
  packagePrices,
  currentUser,
  updateUser,
  language,
  onClose,
  onSuccess
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<"qr" | "card" | "wallet">("qr")
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [purchaseOrder, setPurchaseOrder] = useState<SubscriptionPurchase | null>(null)
  const [purchaseError, setPurchaseError] = useState("")
  const [isCreatingPurchase, setIsCreatingPurchase] = useState(false)
  const [isCompletingPurchase, setIsCompletingPurchase] = useState(false)
  const text = checkoutText[language]
  const selectedPlanName = selectedTier === "2-4" ? text.plan2To4 : text.plan5Plus

  const createVietQrPurchase = async () => {
    setIsCreatingPurchase(true)
    setPurchaseError("")
    try {
      const order = await createSubscriptionPurchaseApi(selectedTier)
      setPurchaseOrder(order)
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : text.createPaymentFailed)
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
      setPurchaseError(error instanceof Error ? error.message : text.confirmPaymentFailed)
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
              {text.title}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {text.confirmPrefix}{" "}
              <span className="font-semibold text-foreground">
                {selectedPlanName}
              </span>{" "}
              {text.confirmSuffix}
            </p>

            {/* Price Display */}
            <div className="mb-6 rounded-xl bg-muted p-4 flex justify-between items-center">
              <span className="text-sm text-muted-foreground font-medium">{text.total}</span>
              <span className="text-xl font-extrabold text-primary">
                {(packagePrices.find(p => p.tier === selectedTier)?.price || 0).toLocaleString("vi-VN")}đ
              </span>
            </div>

            {/* Payment Methods */}
            <div className="space-y-3 mb-6">
              <p className="text-sm font-semibold text-foreground">{text.selectPayment}</p>
              {[
                { id: "qr", label: "VietQR", desc: text.vietQrDesc, disabled: false },
                { id: "card", label: text.cardLabel, desc: text.comingSoon, disabled: true },
                { id: "wallet", label: text.walletLabel, desc: text.comingSoon, disabled: true }
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
                    <p className="text-muted-foreground">{text.orderCode}</p>
                    <p className="font-semibold text-foreground">{purchaseOrder.orderId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{text.transferContent}</p>
                    <p className="font-semibold text-foreground">{purchaseOrder.content}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{text.bank}</p>
                    <p className="font-semibold text-foreground">{purchaseOrder.bankCode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{text.account}</p>
                    <p className="font-semibold text-foreground">{purchaseOrder.bankAccount}</p>
                  </div>
                </div>
                <img
                  src={purchaseOrder.qrImageUrl}
                  alt={`VietQR ${purchaseOrder.orderId}`}
                  className="mx-auto h-56 w-56 rounded-lg border border-border bg-white object-contain p-2"
                />
                <p className="text-center text-xs text-muted-foreground">
                  {text.devMode}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                {text.cancel}
              </Button>
              {!purchaseOrder ? (
                <Button className="flex-1 gap-2" disabled={isCreatingPurchase} onClick={createVietQrPurchase}>
                  {isCreatingPurchase ? text.creatingQr : text.createQr}
                </Button>
              ) : (
                <Button className="flex-1 gap-2" disabled={isCompletingPurchase} onClick={completeVietQrPurchaseForDev}>
                  {isCompletingPurchase ? text.confirming : text.devComplete}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{text.successTitle}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {text.successPrefix}{" "}
              <span className="font-bold text-foreground">
                {selectedPlanName}
              </span>
              {text.successSuffix}
            </p>
            <Button className="w-full" onClick={onSuccess}>
              {text.back}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

const checkoutText = {
  vi: {
    title: "Xác nhận mua gói dịch vụ",
    confirmPrefix: "Bạn đang đăng ký gói",
    confirmSuffix: "thời hạn 1 tháng.",
    plan2To4: "Gói Pro",
    plan5Plus: "Gói VIP",
    total: "Tổng tiền cần thanh toán:",
    selectPayment: "Chọn phương thức thanh toán:",
    vietQrDesc: "Mã QR chuyển khoản ngân hàng cho môi trường dev",
    cardLabel: "Thẻ ATM / Visa / Mastercard",
    walletLabel: "Ví điện tử",
    comingSoon: "Sẽ triển khai sau",
    orderCode: "Mã đơn",
    transferContent: "Nội dung CK",
    bank: "Ngân hàng",
    account: "Tài khoản",
    devMode: "Dev mode: quét QR hoặc dùng nút mô phỏng callback sau khi kiểm tra thông tin thanh toán.",
    cancel: "Hủy bỏ",
    creatingQr: "Đang tạo QR...",
    createQr: "Tạo mã VietQR",
    confirming: "Đang xác nhận...",
    devComplete: "Dev: giả lập đã thanh toán",
    successTitle: "Thanh toán thành công!",
    successPrefix: "Tài khoản của bạn đã được nâng cấp lên",
    successSuffix: ". Hạn sử dụng của gói là 1 tháng kể từ hôm nay.",
    back: "Tuyệt vời! Quay lại",
    createPaymentFailed: "Không thể tạo thanh toán VietQR.",
    confirmPaymentFailed: "Không thể xác nhận thanh toán.",
  },
  en: {
    title: "Confirm subscription purchase",
    confirmPrefix: "You are subscribing to the",
    confirmSuffix: "for 1 month.",
    plan2To4: "Pro plan",
    plan5Plus: "VIP plan",
    total: "Total payment:",
    selectPayment: "Select payment method:",
    vietQrDesc: "Bank transfer QR code for the dev environment",
    cardLabel: "ATM / Visa / Mastercard card",
    walletLabel: "E-wallet",
    comingSoon: "Coming later",
    orderCode: "Order ID",
    transferContent: "Transfer content",
    bank: "Bank",
    account: "Account",
    devMode: "Dev mode: scan the QR code or use the simulated callback button after checking payment details.",
    cancel: "Cancel",
    creatingQr: "Creating QR...",
    createQr: "Create VietQR code",
    confirming: "Confirming...",
    devComplete: "Dev: simulate paid",
    successTitle: "Payment successful",
    successPrefix: "Your account has been upgraded to the",
    successSuffix: ". The package is valid for 1 month from today.",
    back: "Back to packages",
    createPaymentFailed: "Could not create VietQR payment.",
    confirmPaymentFailed: "Could not confirm payment.",
  },
} as const
