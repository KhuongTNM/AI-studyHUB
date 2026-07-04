import { useEffect, useState } from "react"
import { CheckCircle2, CreditCard, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Language, PackagePrice } from "@/states/types"
import { fetchCurrentUserApi } from "@/services/api/auth"
import {
  createSubscriptionPurchaseApi,
  getSubscriptionPurchaseApi,
  type SubscriptionPurchase,
} from "@/services/api/subscription-purchases"

interface CheckoutModalProps {
  selectedPlan: PackagePrice
  currentUser: any
  updateUser: (id: string, data: any) => void
  language: Language
  onClose: () => void
  onSuccess: () => void
}

export function CheckoutModal({
  selectedPlan,
  currentUser,
  updateUser,
  language,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<"payos" | "card" | "wallet">("payos")
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [purchaseOrder, setPurchaseOrder] = useState<SubscriptionPurchase | null>(null)
  const [purchaseError, setPurchaseError] = useState("")
  const [isCreatingPurchase, setIsCreatingPurchase] = useState(false)
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(false)
  const text = checkoutText[language]
  const selectedPlanName = selectedPlan.name

  const syncPaidUser = async (order: SubscriptionPurchase) => {
    const paidUser = order.user ?? (await fetchCurrentUserApi())
    if (paidUser) {
      updateUser(currentUser.id, {
        subscriptionTier: paidUser.subscriptionTier,
        subscriptionExpiresAt: paidUser.subscriptionExpiresAt,
        storageLimit: paidUser.storageLimit,
      })
    }
    setPurchaseSuccess(true)
  }

  const openPayOsCheckout = (order: SubscriptionPurchase) => {
    if (!order.qrLink) {
      setPurchaseError(text.missingCheckoutLink)
      return
    }
    window.open(order.qrLink, "_blank", "noopener,noreferrer")
  }

  const createPayOsPurchase = async () => {
    setIsCreatingPurchase(true)
    setPurchaseError("")
    try {
      const order = await createSubscriptionPurchaseApi(selectedPlan.planName ?? selectedPlan.tier)
      setPurchaseOrder(order)
      openPayOsCheckout(order)
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : text.createPaymentFailed)
    } finally {
      setIsCreatingPurchase(false)
    }
  }

  const checkPurchaseStatus = async (showPendingMessage = true) => {
    if (!purchaseOrder) return
    setIsCheckingPurchase(true)
    setPurchaseError("")
    try {
      const latestOrder = await getSubscriptionPurchaseApi(purchaseOrder.orderId)
      if (!latestOrder) {
        setPurchaseError(text.orderNotFound)
        return
      }
      setPurchaseOrder(latestOrder)
      if (latestOrder.status === "PAID") {
        await syncPaidUser(latestOrder)
        return
      }
      if (latestOrder.status === "CANCELLED" || latestOrder.status === "EXPIRED") {
        setPurchaseError(text.paymentExpired)
        return
      }
      if (showPendingMessage) setPurchaseError(text.paymentPending)
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : text.checkPaymentFailed)
    } finally {
      setIsCheckingPurchase(false)
    }
  }

  useEffect(() => {
    if (!purchaseOrder || purchaseOrder.status !== "PENDING" || purchaseSuccess) return

    let cancelled = false
    const poll = async () => {
      try {
        const latestOrder = await getSubscriptionPurchaseApi(purchaseOrder.orderId)
        if (cancelled || !latestOrder) return
        setPurchaseOrder(latestOrder)
        if (latestOrder.status === "PAID") await syncPaidUser(latestOrder)
        if (latestOrder.status === "CANCELLED" || latestOrder.status === "EXPIRED") {
          setPurchaseError(text.paymentExpired)
        }
      } catch {
        // Manual retry stays available if one poll fails.
      }
    }

    const intervalId = window.setInterval(poll, 5000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [purchaseOrder?.orderId, purchaseOrder?.status, purchaseSuccess])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex-1 overflow-y-auto p-6">
          {!purchaseSuccess ? (
            <>
              <h3 className="mb-2 flex items-center gap-2 text-xl font-bold text-foreground">
                <CreditCard className="h-5 w-5 text-primary" />
                {text.title}
              </h3>
              <p className="mb-6 text-sm text-muted-foreground">
                {text.confirmPrefix}{" "}
                <span className="font-semibold text-foreground">{selectedPlanName}</span>{" "}
                {text.confirmSuffix}
              </p>

              <div className="mb-6 flex items-center justify-between rounded-xl bg-muted p-4">
                <span className="text-sm font-medium text-muted-foreground">{text.total}</span>
                <span className="text-xl font-extrabold text-primary">
                  {selectedPlan.price.toLocaleString("vi-VN")}đ
                </span>
              </div>

              <div className="mb-6 space-y-3">
                <p className="text-sm font-semibold text-foreground">{text.selectPayment}</p>
                {[
                  { id: "payos", label: "PayOS", desc: text.payOsDesc, disabled: false },
                  { id: "card", label: text.cardLabel, desc: text.comingSoon, disabled: true },
                  { id: "wallet", label: text.walletLabel, desc: text.comingSoon, disabled: true },
                ].map(method => (
                  <label
                    key={method.id}
                    onClick={() => !method.disabled && setPaymentMethod(method.id as any)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      paymentMethod === method.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                      method.disabled && "cursor-not-allowed opacity-60",
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{text.status}</p>
                      <p className="text-sm font-semibold text-foreground">{text.statusLabels[purchaseOrder.status]}</p>
                    </div>
                    {purchaseOrder.status === "PENDING" && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {text.waitingWebhook}
                      </span>
                    )}
                  </div>

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
                      <p className="font-semibold text-foreground">{purchaseOrder.bankCode || "PayOS"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{text.account}</p>
                      <p className="font-semibold text-foreground">{purchaseOrder.bankAccount || "-"}</p>
                    </div>
                  </div>

                  {purchaseOrder.qrImageUrl && (
                    <img
                      src={purchaseOrder.qrImageUrl}
                      alt={`PayOS ${purchaseOrder.orderId}`}
                      className="mx-auto h-56 w-56 rounded-lg border border-border bg-white object-contain p-2"
                    />
                  )}
                  <p className="text-center text-xs text-muted-foreground">{text.realPaymentNote}</p>
                </div>
              )}
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 animate-bounce text-green-600" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-foreground">{text.successTitle}</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                {text.successPrefix}{" "}
                <span className="font-bold text-foreground">{selectedPlanName}</span>
                {text.successSuffix}
              </p>
              <Button className="w-full" onClick={onSuccess}>{text.back}</Button>
            </div>
          )}
        </div>

        {!purchaseSuccess && (
          <div className="shrink-0 border-t border-border p-4">
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>{text.cancel}</Button>
              {!purchaseOrder ? (
                <Button className="flex-1 gap-2" disabled={isCreatingPurchase} onClick={createPayOsPurchase}>
                  {isCreatingPurchase ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  {isCreatingPurchase ? text.creatingPayment : text.createPayment}
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => openPayOsCheckout(purchaseOrder)}>
                    <ExternalLink className="h-4 w-4" />
                    {text.openPayOs}
                  </Button>
                  <Button className="flex-1 gap-2" disabled={isCheckingPurchase} onClick={() => checkPurchaseStatus()}>
                    {isCheckingPurchase ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {text.checkStatus}
                  </Button>
                </>
              )}
            </div>
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
    payOsDesc: "Thanh toán thật qua cổng PayOS và webhook tự động",
    cardLabel: "Thẻ ATM / Visa / Mastercard",
    walletLabel: "Ví điện tử",
    comingSoon: "Sẽ triển khai sau",
    status: "Trạng thái",
    statusLabels: {
      PENDING: "Đang chờ thanh toán",
      PAID: "Đã thanh toán",
      CANCELLED: "Đã hủy",
      EXPIRED: "Đã hết hạn",
    },
    waitingWebhook: "Đang chờ PayOS",
    orderCode: "Mã đơn",
    transferContent: "Nội dung CK",
    bank: "Ngân hàng",
    account: "Tài khoản",
    realPaymentNote: "Sau khi thanh toán trên PayOS, hệ thống sẽ tự cập nhật khi webhook xác nhận thành công.",
    cancel: "Hủy bỏ",
    creatingPayment: "Đang tạo...",
    createPayment: "Thanh toán PayOS",
    openPayOs: "Mở PayOS",
    checkStatus: "Kiểm tra",
    successTitle: "Thanh toán thành công!",
    successPrefix: "Tài khoản của bạn đã được nâng cấp lên",
    successSuffix: ". Hạn sử dụng của gói là 1 tháng kể từ hôm nay.",
    back: "Tuyệt vời! Quay lại",
    createPaymentFailed: "Không thể tạo thanh toán PayOS.",
    checkPaymentFailed: "Không thể kiểm tra trạng thái thanh toán.",
    missingCheckoutLink: "Backend chưa trả về link thanh toán PayOS.",
    orderNotFound: "Không tìm thấy đơn thanh toán.",
    paymentPending: "PayOS chưa xác nhận thanh toán. Vui lòng hoàn tất thanh toán hoặc thử kiểm tra lại sau vài giây.",
    paymentExpired: "Đơn thanh toán đã hết hạn hoặc đã bị hủy. Vui lòng tạo đơn mới.",
  },
  en: {
    title: "Confirm subscription purchase",
    confirmPrefix: "You are subscribing to the",
    confirmSuffix: "for 1 month.",
    plan2To4: "Pro plan",
    plan5Plus: "VIP plan",
    total: "Total payment:",
    selectPayment: "Select payment method:",
    payOsDesc: "Real payment through PayOS with automatic webhook confirmation",
    cardLabel: "ATM / Visa / Mastercard card",
    walletLabel: "E-wallet",
    comingSoon: "Coming later",
    status: "Status",
    statusLabels: {
      PENDING: "Waiting for payment",
      PAID: "Paid",
      CANCELLED: "Cancelled",
      EXPIRED: "Expired",
    },
    waitingWebhook: "Waiting for PayOS",
    orderCode: "Order ID",
    transferContent: "Transfer content",
    bank: "Bank",
    account: "Account",
    realPaymentNote: "After you pay on PayOS, the app updates automatically when the webhook is confirmed.",
    cancel: "Cancel",
    creatingPayment: "Creating...",
    createPayment: "Pay with PayOS",
    openPayOs: "Open PayOS",
    checkStatus: "Check",
    successTitle: "Payment successful",
    successPrefix: "Your account has been upgraded to the",
    successSuffix: ". The package is valid for 1 month from today.",
    back: "Back to packages",
    createPaymentFailed: "Could not create PayOS payment.",
    checkPaymentFailed: "Could not check payment status.",
    missingCheckoutLink: "The backend did not return a PayOS checkout link.",
    orderNotFound: "Payment order was not found.",
    paymentPending: "PayOS has not confirmed the payment yet. Please complete payment or check again in a few seconds.",
    paymentExpired: "This payment has expired or was cancelled. Please create a new order.",
  },
} as const
