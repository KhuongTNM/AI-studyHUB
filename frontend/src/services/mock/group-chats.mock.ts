/**
 * Mock cho module Group Chat — dùng khi MOCK_API = true (mock-config.ts).
 *
 * Phạm vi: đủ để FE tự test luồng "Tạo nhóm" + quy tắc kiểm tra trùng tên
 * (BR-109 → BR-112, xem GroupChat_Duplicate_Name_API_Contract.docx) mà KHÔNG
 * cần chờ Backend code xong ErrorCode.GROUP_NAME_ALREADY_EXISTS.
 *
 * Các API được mock ở đây:
 *   - POST /api/groups            (createGroupApi)      — có check trùng tên
 *   - GET  /api/groups            (fetchGroupsApi)       — để list refresh sau khi tạo
 *   - GET  /api/groups/{id}       (fetchGroupDetailApi)
 *   - GET  /api/groups/{id}/members    (fetchGroupMembersApi)   — trả về owner làm member duy nhất
 *   - GET  /api/groups/{id}/settings   (fetchGroupSettingsApi)  — mặc định muted=false, pinned=false
 *   - GET  /api/groups/{id}/messages   (fetchGroupMessagesApi)  — mặc định rỗng
 *
 * KHÔNG mock: mời thành viên, gửi tin nhắn, xoá/rời nhóm, mute/pin, report,
 * export, upload ảnh/tài liệu — các API này vẫn gọi backend thật; nếu bật
 * MOCK_API mà chưa có backend chạy, các thao tác đó sẽ lỗi (nằm ngoài phạm vi
 * tính năng kiểm tra trùng tên đang cần test).
 *
 * Response trả về đúng field như GroupResponse.java thật (id, groupCode,
 * name, description, ownerId, createdAt, updatedAt) — KHÔNG bọc ApiResponse<T>,
 * lỗi theo đúng quy ước phẳng { "message": "..." } của GlobalExceptionHandler.java,
 * y hệt mô tả trong GroupChat_Duplicate_Name_API_Contract.docx.
 *
 * Khi đổi MOCK_API = false, toàn bộ file này không còn được gọi tới nữa —
 * group-chats.ts sẽ gọi thẳng backend thật như bình thường.
 */

interface MockGroup {
  id: string
  groupCode: string
  name: string
  description: string | null
  ownerId: string
  ownerName: string
  createdAt: string
  updatedAt: string
}

const mockGroups = new Map<string, MockGroup>()
let mockSeq = 0

function newId(): string {
  mockSeq += 1
  return `mock-group-${Date.now()}-${mockSeq}`
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** BR-110: chuẩn hoá CHỈ để so sánh — trim đầu/cuối, gộp khoảng trắng liên tiếp, không phân biệt hoa/thường. */
function normalizeGroupNameForCompare(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN")
}

function genGroupCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let suffix = ""
  for (let i = 0; i < 8; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `GRP-${suffix}`
}

function toApiGroup(group: MockGroup) {
  return {
    id: group.id,
    groupCode: group.groupCode,
    name: group.name,
    description: group.description,
    ownerId: group.ownerId,
    ownerName: group.ownerName,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }
}

// ─── GET /api/groups ─────────────────────────────────────────────────────────
// Chỉ trả về nhóm mà `ownerId` đang sở hữu (mock chưa mô phỏng thành viên chéo
// từ lời mời — đủ dùng để test tạo nhóm + list refresh sau khi tạo).

export async function mockFetchGroupsRequest(ownerId?: string): Promise<Response> {
  await delay(150)
  const groups = Array.from(mockGroups.values())
    .filter(group => !ownerId || group.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toApiGroup)
  return jsonResponse(200, groups)
}

// ─── GET /api/groups/{groupId} ───────────────────────────────────────────────

export async function mockFetchGroupDetailRequest(groupId: string): Promise<Response> {
  await delay(150)
  const group = mockGroups.get(groupId)
  if (!group) return jsonResponse(404, { message: "GROUP_NOT_FOUND" })
  return jsonResponse(200, toApiGroup(group))
}

// ─── POST /api/groups ────────────────────────────────────────────────────────
// Đúng thứ tự kiểm tra như GroupService.createGroup() thật (theo Mục 6, BE):
// 1) name rỗng → GROUP_NAME_REQUIRED (đã có, @NotBlank)
// 2) trùng groupCode → GROUP_CODE_ALREADY_EXISTS (đã có)
// 3) trùng tên trong phạm vi CÙNG owner, sau chuẩn hoá → GROUP_NAME_ALREADY_EXISTS (MỚI, BR-109/110/111)

export async function mockCreateGroupRequest(
  input: { groupCode?: string; name: string; description?: string },
  owner: { id: string; displayName?: string },
): Promise<Response> {
  await delay(300)

  const name = (input.name ?? "").trim()
  if (!name) return jsonResponse(400, { message: "GROUP_NAME_REQUIRED" })

  const groupCode = (input.groupCode ?? "").trim().toUpperCase() || genGroupCode()
  const codeTaken = Array.from(mockGroups.values()).some(
    group => group.groupCode.toUpperCase() === groupCode,
  )
  if (codeTaken) return jsonResponse(400, { message: "GROUP_CODE_ALREADY_EXISTS" })

  const normalizedNewName = normalizeGroupNameForCompare(name)
  const nameTaken = Array.from(mockGroups.values()).some(
    group => group.ownerId === owner.id && normalizeGroupNameForCompare(group.name) === normalizedNewName,
  )
  if (nameTaken) return jsonResponse(400, { message: "GROUP_NAME_ALREADY_EXISTS" })

  const now = new Date().toISOString()
  const group: MockGroup = {
    id: newId(),
    groupCode,
    name,
    description: input.description?.trim() || null,
    ownerId: owner.id,
    ownerName: owner.displayName || "Owner",
    createdAt: now,
    updatedAt: now,
  }
  mockGroups.set(group.id, group)

  return jsonResponse(201, toApiGroup(group))
}

// ─── GET /api/groups/{groupId}/members ──────────────────────────────────────

export async function mockFetchGroupMembersRequest(groupId: string): Promise<Response> {
  await delay(100)
  const group = mockGroups.get(groupId)
  if (!group) return jsonResponse(404, { message: "GROUP_NOT_FOUND" })

  return jsonResponse(200, [
    {
      userId: group.ownerId,
      displayName: group.ownerName,
      avatar: null,
      role: "owner",
      joinedAt: group.createdAt,
    },
  ])
}

// ─── GET /api/groups/{groupId}/settings ─────────────────────────────────────

export async function mockFetchGroupSettingsRequest(groupId: string): Promise<Response> {
  await delay(100)
  return jsonResponse(200, { groupId, muted: false, pinned: false })
}

// ─── GET /api/groups/{groupId}/messages ─────────────────────────────────────

export async function mockFetchGroupMessagesRequest(_groupId: string): Promise<Response> {
  await delay(100)
  return jsonResponse(200, [])
}
