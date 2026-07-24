import type { Language } from "@/states/types"

type LocalizedPlanInput = {
  name?: string | null
}

/**
 * Tên hiển thị của gói = field `name` do BE trả về (BR-201: "name" là nơi
 * DUY NHẤT mang tên gói, cả tra cứu lẫn hiển thị). BE từ chối tên rỗng khi
 * tạo/sửa gói nên `name` luôn có giá trị thật; fallback dưới đây chỉ để
 * phòng hờ type-safety (vd object truyền vào thiếu field), không phải
 * đường xử lý thật.
 */
export function getLocalizedPlanName(plan: LocalizedPlanInput, language: Language): string {
  return plan.name?.trim() || (language === "vi" ? "Gói dịch vụ" : "Subscription plan")
}

/**
 * Check trùng tên gói ở FE trước khi gọi API tạo/sửa, để báo lỗi ngay thay
 * vì đợi round-trip lên BE (BE vẫn là nguồn kiểm tra chính thức, trả 409
 * nếu FE bỏ sót trường hợp nào — xem AI-studyHUB_API_File_SubscriptionPlan.docx
 * mục 3, 4). So sánh case-insensitive, trim khoảng trắng, chỉ dựa trên
 * `name` thật của các gói đang có (list `existingPlans` lấy từ BE) — không
 * còn so với label hardcode nữa vì label hardcode đã bị bỏ ở trên.
 */
export function isPlanNameTaken(
  candidateName: string,
  existingPlans: { id?: string; name: string }[],
  options: { excludeId?: string } = {},
): boolean {
  const target = candidateName.trim().toLowerCase()
  if (!target) return false

  return existingPlans.some(
    p => p.id !== options.excludeId && p.name.trim().toLowerCase() === target,
  )
}
