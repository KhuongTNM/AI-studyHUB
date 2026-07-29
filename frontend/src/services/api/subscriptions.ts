import { getAccessToken } from "@/lib/auth-storage"
import { MOCK_API } from "@/services/mock/mock-config"
import { mockFetchMySubscriptionRequest } from "@/services/mock/subscriptions.mock"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

/**
 * SubscriptionSnapshotResponse — theo
 * Subscription_SoftDelete_Grandfathering_API_Contract.docx, mục 5.1
 * (SUB-202, GET /api/subscriptions/me).
 *
 * QUAN TRỌNG: planName VÀ toàn bộ hạn mức dưới đây đều là SNAPSHOT được chốt
 * tại đúng thời điểm gói được kích hoạt cho User (mua mới/gia hạn/được cấp
 * thủ công — SUB-301), KHÔNG phải cấu hình LIVE mới nhất của gói. Nhờ vậy dù
 * gói đã bị Admin xoá mềm (và đổi tên thành `<name>_DELETED_<uuid8>`) SAU
 * thời điểm User kích hoạt, planName trả về ở đây vẫn đúng là tên gốc User
 * nhìn thấy lúc đăng ký — đây chính là cơ chế giải quyết SUB-202 (Bảo lưu
 * quyền lợi / Grandfathering) trên giao diện.
 */
export interface MySubscription {
  planId: number
  planName: string
  status: string
  /** ISO 8601 */
  startDate: string
  /** ISO 8601 */
  endDate: string
  pricePaid: number
  /** SNAPSHOT hạn mức Chat AI/ngày. -1 = không giới hạn. */
  dailyAiChatLimit: number
  /** SNAPSHOT hạn mức tổng số Flashcard. -1 = không giới hạn. */
  maxFlashcards: number
  /** SNAPSHOT hạn mức số nhóm được tạo. */
  createGroupLimit: number
  /** SNAPSHOT hạn mức số nhóm được tham gia. */
  joinGroupLimit: number
  /** SNAPSHOT số thành viên tối đa mỗi nhóm. */
  maxRoomMembers: number
  /** SNAPSHOT dung lượng lưu trữ mặc định của gói tại thời điểm kích hoạt. */
  storageBytes: number
}

interface ErrorBody {
  message?: string
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore parse errors
  }
  return "Không thể tải thông tin gói dịch vụ hiện tại. Vui lòng thử lại."
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * GET /api/subscriptions/me — SUB-202. Yêu cầu đã đăng nhập (mọi role), không
 * giới hạn theo role cụ thể — giống GET /api/v1/chat/quota. Không có nhánh
 * 404 — luôn có phản hồi hợp lệ nhờ cơ chế fallback Free ảo có sẵn phía
 * Backend (getActiveSubscriptionOrDefault()).
 *
 * FE dùng endpoint này cho màn "Gói của tôi" (packages-tab.tsx) THAY VÌ tự
 * đối chiếu subscriptionPlanId của User với GET /api/subscription-plans —
 * danh sách đó chỉ chứa gói CHƯA xoá nên sẽ luôn thiếu đúng trường hợp User
 * đang được bảo lưu quyền lợi trên gói đã bị Admin xoá mềm.
 */
export async function fetchMySubscriptionApi(): Promise<MySubscription> {
  const response = MOCK_API
    ? await mockFetchMySubscriptionRequest()
    : await fetch(`${API_BASE_URL}/api/subscriptions/me`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}
