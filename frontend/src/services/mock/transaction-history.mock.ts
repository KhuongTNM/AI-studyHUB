/**
 * Mock cho 4 API Lịch sử Giao dịch (TXN-101 → TXN-203) — dùng khi
 * MOCK_API = true (mock-config.ts, dùng CHUNG với các mock khác trong dự án).
 *
 * Cùng nguyên tắc như documents.mock.ts: trả về đúng Response (status, body
 * JSON) như backend thật sẽ trả theo TransactionHistory_API_Contract.docx
 * (v1.1) — Page<T> của Spring Data, lỗi phẳng { "message": "..." } — để code
 * xử lý ở subscription-purchases.ts / admin-transactions.ts chạy y hệt lúc
 * dùng backend thật.
 *
 * LƯU Ý: đây là mock để FE tự test UI/flow (danh sách, filter Tháng-Năm,
 * tìm theo Tên/Email, phân trang, popup chi tiết, activationStatus động).
 * Không mô phỏng lại việc kiểm tra ownership theo Token thật — phía "User"
 * (mockGetTransactionHistoryRequest/mockGetTransactionDetailRequest) luôn
 * trả về lịch sử của 1 user mẫu cố định (MOCK_CURRENT_USER_ID) bất kể ai
 * đang đăng nhập trên FE, chỉ đủ để xem đúng luồng/giao diện.
 */

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// ─── Kho dữ liệu giả lập ─────────────────────────────────────────────────────

interface MockTransaction {
  orderId: string
  orderCode: number
  userId: string
  userDisplayName: string
  userEmail: string
  planName: string
  amount: number
  paidAt: string // ISO 8601
  startDate: string // ISO 8601 — kích hoạt ngay lập tức (Option 1, = paidAt)
  endDate: string // ISO 8601
}

const MOCK_CURRENT_USER_ID = "mock-user-current"

function isoAt(monthsAgo: number, dayOfMonth = 15, hour = 9, minute = 32): string {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, dayOfMonth, hour, minute, 10)
  return date.toISOString().slice(0, 19) // giữ dạng "yyyy-MM-ddTHH:mm:ss" giống LocalDateTime BE
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(iso)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 19)
}

function planDurationDays(planName: string): number {
  // Xấp xỉ 1 tháng ~ 30 ngày cho mọi gói mẫu — chỉ để test activationStatus động.
  if (planName === "Pro (Năm)") return 365
  return 30
}

function buildTxn(input: {
  orderSuffix: string
  orderCode: number
  userId: string
  userDisplayName: string
  userEmail: string
  planName: string
  amount: number
  monthsAgo: number
  dayOfMonth?: number
}): MockTransaction {
  const paidAt = isoAt(input.monthsAgo, input.dayOfMonth ?? 15)
  const startDate = paidAt
  const endDate = addDaysIso(paidAt, planDurationDays(input.planName))
  return {
    orderId: `ASH${input.orderSuffix}`,
    orderCode: input.orderCode,
    userId: input.userId,
    userDisplayName: input.userDisplayName,
    userEmail: input.userEmail,
    planName: input.planName,
    amount: input.amount,
    paidAt,
    startDate,
    endDate,
  }
}

// User "hiện tại" (dùng cho mock phía User) — 4 giao dịch, đủ để test phân trang
// (size mặc định 10 nên không tràn trang) + filter Tháng/Năm + trạng thái động
// ACTIVE (giao dịch tháng này) / EXPIRED (giao dịch cũ hơn).
const currentUserTxns: MockTransaction[] = [
  buildTxn({ orderSuffix: "f3k29dq1x", orderCode: 1732581001, userId: MOCK_CURRENT_USER_ID, userDisplayName: "Nguyễn Văn A", userEmail: "student@gmail.com", planName: "Pro", amount: 299000, monthsAgo: 0, dayOfMonth: 3 }),
  buildTxn({ orderSuffix: "f3k29dq2y", orderCode: 1732581002, userId: MOCK_CURRENT_USER_ID, userDisplayName: "Nguyễn Văn A", userEmail: "student@gmail.com", planName: "Pro", amount: 299000, monthsAgo: 1 }),
  buildTxn({ orderSuffix: "f3k29dq3z", orderCode: 1732581003, userId: MOCK_CURRENT_USER_ID, userDisplayName: "Nguyễn Văn A", userEmail: "student@gmail.com", planName: "Cơ bản", amount: 99000, monthsAgo: 3 }),
  buildTxn({ orderSuffix: "f3k29dq4w", orderCode: 1732581004, userId: MOCK_CURRENT_USER_ID, userDisplayName: "Nguyễn Văn A", userEmail: "student@gmail.com", planName: "Pro", amount: 299000, monthsAgo: 8 }),
]

// Giao dịch của các User khác (chỉ dùng cho mock phía Admin — TXN-201/202/203)
// — trộn nhiều tên/email/tháng khác nhau để test tìm kiếm + filter kết hợp (AND).
const otherUsersTxns: MockTransaction[] = [
  buildTxn({ orderSuffix: "b7h11ab1a", orderCode: 1732581101, userId: "u-tran-thi-b", userDisplayName: "Trần Thị B", userEmail: "tranthib@gmail.com", planName: "Pro", amount: 299000, monthsAgo: 0, dayOfMonth: 5 }),
  buildTxn({ orderSuffix: "b7h11ab2b", orderCode: 1732581102, userId: "u-tran-thi-b", userDisplayName: "Trần Thị B", userEmail: "tranthib@gmail.com", planName: "Cơ bản", amount: 99000, monthsAgo: 2 }),
  buildTxn({ orderSuffix: "c9k22cd3c", orderCode: 1732581103, userId: "u-le-van-c", userDisplayName: "Lê Văn C", userEmail: "levanc@outlook.com", planName: "Pro (Năm)", amount: 2990000, monthsAgo: 0, dayOfMonth: 12 }),
  buildTxn({ orderSuffix: "c9k22cd4d", orderCode: 1732581104, userId: "u-le-van-c", userDisplayName: "Lê Văn C", userEmail: "levanc@outlook.com", planName: "Cơ bản", amount: 99000, monthsAgo: 5 }),
  buildTxn({ orderSuffix: "d4m33ef5e", orderCode: 1732581105, userId: "u-pham-thi-d", userDisplayName: "Phạm Thị D", userEmail: "phamthid@gmail.com", planName: "Pro", amount: 299000, monthsAgo: 1 }),
  buildTxn({ orderSuffix: "d4m33ef6f", orderCode: 1732581106, userId: "u-pham-thi-d", userDisplayName: "Phạm Thị D", userEmail: "phamthid@gmail.com", planName: "Pro", amount: 299000, monthsAgo: 4 }),
  buildTxn({ orderSuffix: "e5n44gh7g", orderCode: 1732581107, userId: "u-hoang-van-e", userDisplayName: "Hoàng Văn E", userEmail: "hoangvane@gmail.com", planName: "Cơ bản", amount: 99000, monthsAgo: 6 }),
  buildTxn({ orderSuffix: "e5n44gh8h", orderCode: 1732581108, userId: "u-hoang-van-e", userDisplayName: "Hoàng Văn E", userEmail: "hoangvane@gmail.com", planName: "Pro", amount: 299000, monthsAgo: 9 }),
  buildTxn({ orderSuffix: "f6p55ij9i", orderCode: 1732581109, userId: "u-do-thi-f", userDisplayName: "Đỗ Thị F", userEmail: "dothif@gmail.com", planName: "Pro", amount: 299000, monthsAgo: 13 }),
  buildTxn({ orderSuffix: "f6p55ij0j", orderCode: 1732581110, userId: "u-do-thi-f", userDisplayName: "Đỗ Thị F", userEmail: "dothif@gmail.com", planName: "Cơ bản", amount: 99000, monthsAgo: 20 }),
]

const allTxns: MockTransaction[] = [...currentUserTxns, ...otherUsersTxns]

// ─── Validate + clamp giống hệt quy ước đã chốt trong contract (Mục 6) ─────

interface RangeError {
  status: 400
  message: string
}

function validateAndClamp(params: { page?: number; size?: number; month?: number; year?: number }):
  | { ok: true; page: number; size: number; month?: number; year?: number }
  | { ok: false; error: RangeError } {
  const page = params.page ?? 0
  if (page < 0) {
    return { ok: false, error: { status: 400, message: "Tham số phân trang không hợp lệ." } }
  }

  // GAP-4: size ngoài [1,100] → BE tự clamp, KHÔNG lỗi 400.
  let size = params.size ?? 10
  if (!Number.isFinite(size) || size <= 0) size = 10
  if (size > 100) size = 100

  const currentYear = new Date().getFullYear()
  if (params.month != null && (params.month < 1 || params.month > 12)) {
    return { ok: false, error: { status: 400, message: "Tháng hoặc năm không hợp lệ." } }
  }
  if (params.year != null && (params.year < 2020 || params.year > currentYear + 1)) {
    return { ok: false, error: { status: 400, message: "Tháng hoặc năm không hợp lệ." } }
  }

  return { ok: true, page, size, month: params.month, year: params.year }
}

function matchesMonthYear(paidAt: string, month?: number, year?: number): boolean {
  if (month == null && year == null) return true
  const date = new Date(paidAt)
  if (month != null && date.getMonth() + 1 !== month) return false
  if (year != null && date.getFullYear() !== year) return false
  return true
}

function activationStatusOf(txn: MockTransaction): "ACTIVE" | "EXPIRED" {
  const now = Date.now()
  const end = new Date(txn.endDate).getTime()
  return now <= end ? "ACTIVE" : "EXPIRED"
}

function paginate<T>(items: T[], page: number, size: number) {
  const totalElements = items.length
  const totalPages = Math.max(1, Math.ceil(totalElements / size))
  const start = page * size
  const content = items.slice(start, start + size)
  return {
    content,
    totalElements,
    totalPages,
    number: page,
    size,
    first: page === 0,
    last: page >= totalPages - 1,
    numberOfElements: content.length,
    empty: content.length === 0,
  }
}

// ─── 1. Lịch sử Giao dịch — Phía User (TXN-101 + TXN-102) ───────────────────

export async function mockGetTransactionHistoryRequest(params: {
  page?: number
  size?: number
  month?: number
  year?: number
}): Promise<Response> {
  await delay(200)
  const validated = validateAndClamp(params)
  if (!validated.ok) return jsonResponse(validated.error.status, { message: validated.error.message })

  const filtered = currentUserTxns
    .filter(txn => matchesMonthYear(txn.paidAt, validated.month, validated.year))
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .map(txn => ({ orderId: txn.orderId, planName: txn.planName, amount: txn.amount, paidAt: txn.paidAt }))

  return jsonResponse(200, paginate(filtered, validated.page, validated.size))
}

// ─── 2. Chi tiết giao dịch — Phía User (TXN-103) ────────────────────────────

export async function mockGetTransactionDetailRequest(orderId: string): Promise<Response> {
  await delay(150)
  const txn = currentUserTxns.find(item => item.orderId === orderId)
  if (!txn) return jsonResponse(404, { message: "Không tìm thấy giao dịch." })

  return jsonResponse(200, {
    userDisplayName: txn.userDisplayName,
    planName: txn.planName,
    amount: txn.amount,
    paidAt: txn.paidAt,
    activationStatus: activationStatusOf(txn),
    orderCode: txn.orderCode,
  })
}

// ─── 3. Lịch sử Giao dịch — Phía Admin & Sub-Admin (TXN-201 + TXN-202) ──────

export async function mockGetAdminTransactionsRequest(params: {
  page?: number
  size?: number
  month?: number
  year?: number
  keyword?: string
}): Promise<Response> {
  await delay(200)
  const validated = validateAndClamp(params)
  if (!validated.ok) return jsonResponse(validated.error.status, { message: validated.error.message })

  // GAP-5: BE chỉ lọc keyword khi trim().length >= 2 — mock lặp lại đúng ngưỡng này
  // để test luôn ăn khớp dù FE quên chặn ở client.
  const trimmedKeyword = params.keyword?.trim().toLowerCase()
  const applyKeyword = Boolean(trimmedKeyword && trimmedKeyword.length >= 2)

  const filtered = allTxns
    .filter(txn => matchesMonthYear(txn.paidAt, validated.month, validated.year))
    .filter(txn =>
      !applyKeyword ||
      txn.userDisplayName.toLowerCase().includes(trimmedKeyword!) ||
      txn.userEmail.toLowerCase().includes(trimmedKeyword!),
    )
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .map(txn => ({
      orderId: txn.orderId,
      userDisplayName: txn.userDisplayName,
      planName: txn.planName,
      amount: txn.amount,
      paidAt: txn.paidAt,
    }))

  return jsonResponse(200, paginate(filtered, validated.page, validated.size))
}

// ─── 4. Chi tiết giao dịch — Phía Admin & Sub-Admin (TXN-203) ───────────────

export async function mockGetAdminTransactionDetailRequest(orderId: string): Promise<Response> {
  await delay(150)
  const txn = allTxns.find(item => item.orderId === orderId)
  if (!txn) return jsonResponse(404, { message: "Không tìm thấy giao dịch." })

  return jsonResponse(200, {
    userDisplayName: txn.userDisplayName,
    planName: txn.planName,
    amount: txn.amount,
    paidAt: txn.paidAt,
    activationStatus: activationStatusOf(txn),
    orderCode: txn.orderCode,
  })
}
