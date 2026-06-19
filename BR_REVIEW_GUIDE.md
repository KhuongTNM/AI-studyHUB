# Hướng dẫn Review Code — Các Business Requirements

> Mục lục: BR-016 · BR-018 · BR-022 · BR-023 · BR-038 · BR-041 · BR-063 · BR-067 · BR-073

---

## Tổng quan các BR

| BR | Chức năng | Backend | Frontend | DB |
|----|-----------|---------|----------|----|
| 016 | Document Scanning Status | `DocumentService` + `DocumentScanProcessor` | `useDocumentState.ts` (polling) | `documents.status` |
| 018 | Document Visibility | `DocumentController` + `DocumentService` | `document-manager.tsx` | `documents.visibility` |
| 022 | Soft Delete (Trash) | `DocumentController` + `DocumentService` | `trash-page.tsx` | `documents.deleted_at` |
| 023 | Restore from Trash | `DocumentController` + `DocumentService` | `useDocumentState.ts` | `documents.status`, `deleted_at` |
| 038 | Flashcard Status | `FlashcardController` + `FlashcardService` | `useFlashcardState.ts` | `flashcards.status` |
| 041 | Create Study Room | `StudyRoomController` + `StudyRoomService` | `useStudyRoomState.ts` | `study_rooms` |
| 063 | Grant Subscription | `AdminUserController` + `AdminUserService` | `admin-dashboard.tsx` | `users.subscription_plan_id` |
| 067 | Permission Guard (Sub-admin ≠ Admin) | `AdminUserService.validateNotAdmin()` | `admin-dashboard.tsx` + `user-table.tsx` | — (logic layer) |
| 073 | Share only Public docs | `StudyRoomService.shareDocument()` | `study-room-panel.tsx` | `documents.visibility` |

---

## BR-016: Document Scanning Status

**Mục tiêu:** Tài liệu sau upload trải qua vòng đời: `uploading → scanning → ready | failed`.

### Vị trí code

| Layer | File | Dòng |
|-------|------|------|
| Entity Enum | `entity/DocumentStatus.java` | 5-10 |
| Entity field | `entity/Document.java` | 45-47 |
| Service (upload) | `service/DocumentService.java` | 94 (set UPLOADING), 104 (gọi scan) |
| Async Processor | `service/DocumentScanProcessor.java` | 27-48 |
| DB Schema | `database/ai_study_hub_schema_mssql.sql` | 149-152 |
| Frontend Hook | `hooks/useDocumentState.ts` | 95-112 |
| Frontend API | `services/api/documents.ts` | 55-63 |

### Luồng hoạt động

```
User upload → DocumentService.upload()
                │
                ├─ setStatus(UPLOADING)              [DocService:94]
                ├─ save → DB
                └─ scanProcessor.simulateScan()       [DocService:104]  ⚡ Async
                                │
                    ┌───────────┴───────────┐
                    ↓                       ↓
            sleep 500ms              sleep 2000ms
            setStatus(SCANNING)     80% → READY     [DocScanProcessor:31-39]
                                     20% → FAILED
                    │
                    ↓
           Frontend polling 2.5s/lần
           (tối đa 24 lần ~60s)       [useDocumentState.ts:95-112]
                    │
           Khi status ≠ scanning/uploading → dừng poll, cập nhật UI
```

### Chi tiết

- **`DocumentStatus` enum** (`entity/DocumentStatus.java`): `UPLOADING`, `SCANNING`, `READY`, `FAILED`, `DELETED`
- **`DocumentScanProcessor`** (`service/DocumentScanProcessor.java:27-48`):
  - `@Async` → chạy trên thread pool riêng (không block response upload)
  - `@Transactional` → mỗi lần update status là một transaction riêng
  - `simulateScan(UUID docId)`: sleep 500ms → SCANNING → sleep 2000ms → READY (80%) / FAILED (20%)
- **Frontend polling** (`useDocumentState.ts:95-112`): mỗi 2.5s gọi `GET /api/documents`, kiểm tra nếu status không còn "uploading"/"scanning" thì clear interval và update state
- **DB constraint** (`schema.sql:149-152`): `CHECK (status IN ('uploading','scanning','ready','failed','deleted'))`

### Điểm lưu ý khi review

- Scan processor là **mock/simulate** (sleep + random), khi triển khai thật sẽ thay bằng call AI service thật
- Frontend polling là **tạm thời**; có thể nâng cấp lên WebSocket/SSE sau này
- Transaction: mỗi lần set status là một transaction riêng → đảm bảo consistency nếu có lỗi giữa chừng

---

## BR-018: Document Visibility (Public/Private)

**Mục tiêu:** Người dùng có thể đặt tài liệu là `public` hoặc `private`. Tài liệu public hiển thị cho mọi người.

### Vị trí code

| Layer | File | Dòng |
|-------|------|------|
| Entity Enum | `entity/Visibility.java` | (file riêng) |
| Entity field | `entity/Document.java` | 49-51 |
| Controller | `controller/DocumentController.java` | 99-112 |
| DTO Request | `dto/UpdateVisibilityRequest.java` | 1-12 |
| Service | `service/DocumentService.java` | 204-213 |
| Repository | `repository/DocumentRepository.java` | 16 |
| DB Schema | `database/ai_study_hub_schema_mssql.sql` | 153-156 |
| Frontend API | `services/api/documents.ts` | 99, 172-187 |
| Frontend Hook | `hooks/useDocumentState.ts` | 149-166 |
| Frontend UI | `components/documents/document-manager.tsx` | 91-93 |

### Luồng hoạt động

```
User click toggle visibility trên DocumentCard
        │
        ↓
Frontend: optimistic update             [useDocumentState.ts:152]
        │
        ↓
PUT /api/documents/{id}/visibility     [api/documents.ts:172-187]
Body: {"visibility": "public"}
        │
        ↓
DocumentController.updateVisibility()  [DocController:99-112]
        │
        ↓
DocumentService.updateVisibility()     [DocService:204-213]
  ├─ Kiểm tra quyền sở hữu              [DocService:206-208]
  ├─ setVisibility(newVisibility)
  ├─ setUpdatedAt(now)
  └─ save → DB
        │
        ↓
Frontend: cập nhật lại từ response
(Nếu lỗi → revert optimistic update)    [useDocumentState.ts:158]
```

### Chi tiết

- `Visibility.PRIVATE` là **default** (entity: `visibility = Visibility.PRIVATE`, DB: `DEFAULT N'private'`)
- Backend check ownership: nếu không phải chủ → `403 FORBIDDEN` (dòng 206-208)
- **Public documents API**: `GET /api/documents/public` → `DocumentService.getPublicDocuments()` (dòng 138-141) → lọc `visibility=PUBLIC, status=READY, deleted_at IS NULL`
- **Access control** (`DocService:118-131`): nếu user không phải chủ → chỉ xem được doc `PUBLIC + READY + chưa xoá`

### Điểm lưu ý khi review

- Optimistic update ở frontend → UX mượt, nhưng cần handle revert khi API fail
- `Visibility` là enum riêng (không nằm trong Document.java) → tái sử dụng được cho các entity khác sau này
- DB có composite index `idx_docs_visibility ON documents(visibility, share_status)` để tối ưu query

---

## BR-022: Soft Delete (Move to Trash)

**Mục tiêu:** Xoá tài liệu = soft delete → set `status = 'deleted'` và `deleted_at = NOW()`. Doc chuyển vào thùng rác, không mất khỏi DB.

### Vị trí code

| Layer | File | Dòng |
|-------|------|------|
| Controller | `controller/DocumentController.java` | 76-82 (GET trash), 91-97 (DELETE) |
| Service | `service/DocumentService.java` | 143-160 |
| Repository | `repository/DocumentRepository.java` | 22-23 |
| DB Schema | `database/ai_study_hub_schema_mssql.sql` | 167-168 |
| Frontend API | `services/api/documents.ts` | 109, 163-170 |
| Frontend Hook | `hooks/useDocumentState.ts` | 127-135 |
| Frontend UI | `components/documents/trash-page.tsx` | (toàn bộ file) |

### Luồng hoạt động

```
User click "Delete" trên document
        │
        ↓
Frontend: optimistic set status = "deleted"     [useDocumentState.ts:129]
        │
        ↓
DELETE /api/documents/{id}                       [api/documents.ts:163-170]
        │
        ↓
DocumentController.delete()                      [DocController:91-97]
        │
        ↓
DocumentService.delete(id, userId)               [DocService:143-153]
  ├─ Kiểm tra quyền sở hữu                       [DocService:145-147]
  ├─ setStatus(DELETED)                          [DocService:148]
  ├─ setDeletedAt(now)                           [DocService:149]
  ├─ setUpdatedAt(now)                           [DocService:150]
  └─ save → DB
        │
        ↓
Frontend: doc biến mất khỏi danh sách chính,
xuất hiện trong Trash page                       [trash-page.tsx]
```

### Chi tiết

- **Không xoá vật lý** — chỉ set status + deleted_at → có thể restore
- **Get trash**: `GET /api/documents/trash` → `DocumentService.getTrashDocuments()` (dòng 157-160) → query `status = DELETED` của user hiện tại
- **Repository**: `findByUserIdAndStatusOrderByCreatedAtDesc(userId, DELETED)` — đã có sẵn cho BR-022/023
- Frontend `trash-page.tsx` là page riêng, chỉ hiển thị doc có `status = "deleted"`

### Điểm lưu ý khi review

- `DELETED` là một status trong `DocumentStatus` enum, không phải trường riêng
- DB `deleted_at` nullable: `NULL` = bình thường, có giá trị = đang ở thùng rác
- Optimistic update → nếu API fail, revert về "ready"

---

## BR-023: Restore from Trash

**Mục tiêu:** Khôi phục tài liệu từ thùng rác → set `deleted_at = NULL`, `status = 'ready'`. Nếu trùng tên, tự động thêm hậu tố " (N)".

### Vị trí code

| Layer | File | Dòng |
|-------|------|------|
| Controller | `controller/DocumentController.java` | 114-121 |
| Service | `service/DocumentService.java` | 162-202 |
| Repository | `repository/DocumentRepository.java` | 25-27 |
| Frontend API | `services/api/documents.ts` | 189-197 |
| Frontend Hook | `hooks/useDocumentState.ts` | 137-147 |

### Luồng hoạt động

```
User click "Restore" trong Trash page
        │
        ↓
Frontend: optimistic set status = "ready"       [useDocumentState.ts:139]
        │
        ↓
POST /api/documents/{id}/restore                [api/documents.ts:189-197]
        │
        ↓
DocumentController.restore()                     [DocController:114-121]
        │
        ↓
DocumentService.restoreDocument(id, userId)      [DocService:162-202]
  ├─ Tìm doc, check status = DELETED             [DocService:164-173]
  ├─ Kiểm tra quyền sở hữu                       [DocService:166]
  ├─ Xử lý trùng tên:
  │   ├─ countByUserIdAndDeletedAtIsNullAndOriginalName(…) > 0?
  │   └─ Nếu có → append " (N)" vào original_name [DocService:175-195]
  ├─ setStatus(READY)                            [DocService:197]
  ├─ setDeletedAt(null)                          [DocService:198]
  ├─ setUpdatedAt(now)                           [DocService:199]
  └─ save → DB
        │
        ↓
Frontend: cập nhật từ response (tên mới nếu có đổi)
```

### Chi tiết

- **Kiểm tra trùng tên** (`DocService:175-195`): dùng `countByUserIdAndDeletedAtIsNullAndOriginalName()` để đếm số doc cùng tên đang active (không bị xoá)
- Tên mới = `original_name + " (" + count + ")"` (VD: "Bai tap (2)")
- **Repository methods** (`DocumentRepository.java:25-27`):
  - `countByUserIdAndDeletedAtIsNullAndOriginalName(userId, originalName)` — đếm số doc cùng tên
  - `findByUserIdAndDeletedAtIsNullAndOriginalNameStartingWith(userId, prefix)` — tìm danh sách để xác định số thứ tự

### Điểm lưu ý khi review

- Chỉ restore được doc có `status = DELETED`
- Xử lý trùng tên giúp tránh conflict khi restore, đặc biệt khi user xoá rồi tạo mới cùng tên
- API trả về document response với tên đã được cập nhật → frontend cập nhật đúng tên mới

---

## BR-038: Flashcard Status Update

**Mục tiêu:** Flashcard có vòng đời `new → learning → mastered`. User có thể cập nhật trạng thái.

### Vị trí code

| Layer | File | Dòng |
|-------|------|------|
| Entity Enum | `entity/FlashcardStatus.java` | 5-18 |
| Entity field | `entity/Flashcard.java` | 30-32 |
| Controller | `controller/FlashcardController.java` | 42-47 |
| DTO Request | `dto/UpdateFlashcardStatusRequest.java` | 1-12 |
| Service | `service/FlashcardService.java` | 33-56 |
| DB Schema | `database/ai_study_hub_schema_mssql.sql` | 256-259 |
| Frontend API | `services/api/flashcards.ts` | 94-111 |
| Frontend Hook | `hooks/useFlashcardState.ts` | 29-45 |
| Frontend Type | `states/types.ts` | 114 |

### Luồng hoạt động

```
User thay đổi status flashcard (VD: "new" → "learning")
        │
        ↓
Frontend: optimistic update                     [useFlashcardState.ts:32]
        │
        ↓
PATCH /api/flashcards/{id}/status               [api/flashcards.ts:94-111]
Body: {"status": "learning"}
        │
        ↓
FlashcardController.updateStatus()               [FlashcardController:42-47]
        │
        ↓
FlashcardService.updateStatus(id, request)       [FlashcardService:33-56]
  ├─ Tìm flashcard                               [dòng 35]
  ├─ Kiểm tra quyền sở hữu (userId match)        [dòng 39]
  ├─ Parse status string → FlashcardStatus enum  [dòng 48]
  │   (dùng FlashcardStatus.fromString())
  ├─ setStatus(newStatus)                        [dòng 53]
  └─ save → DB + return response
        │
        ↓
Frontend: cập nhật từ server response            [useFlashcardState.ts:38]
(Nếu lỗi → silent error, giữ nguyên optimistic)
```

### Chi tiết

- **`FlashcardStatus` enum** (`FlashcardStatus.java:5-18`): `NEW`, `LEARNING`, `MASTERED` + method `fromString()` để parse an toàn (ném exception nếu không hợp lệ)
- **DB constraint** (`schema.sql:256-259`): `CHECK (status IN ('new', 'learning', 'mastered'))` + `DEFAULT 'new'`
- **Owner check**: chỉ chủ sở hữu mới update được flashcard (dòng 39)

### Điểm lưu ý khi review

- Backend dùng `@PatchMapping` — đúng semantic (PATCH cho update một phần)
- `fromString()` xử lý case-insensitive → an toàn khi frontend gửi "New", "NEW", "new"
- Frontend chỉ gọi API khi status thực sự thay đổi (tránh request vô ích)

---

## BR-041: Create Study Room

**Mục tiêu:** User có subscription trả phí (hoặc admin/sub-admin) tạo phòng học với code, password (tuỳ chọn), và sức chứa theo plan.

### Vị trí code

| Layer | File | Dòng |
|-------|------|------|
| Entity | `entity/StudyRoom.java` | 1-59 |
| DTO Request | `dto/CreateStudyRoomRequest.java` | 1-19 |
| Controller | `controller/StudyRoomController.java` | 40-43 |
| Service | `service/StudyRoomService.java` | 78-110, 209-243 |
| DB Schema | `database/ai_study_hub_schema_mssql.sql` | 279-298 |
| Frontend API | `services/api/study-rooms.ts` | 95-120 |
| Frontend Hook | `hooks/useStudyRoomState.ts` | 79-114 |

### Luồng hoạt động

```
User nhập room code + password (tuỳ chọn), click "Create"
        │
        ↓
Frontend: validate (đã login? còn capacity?)    [useStudyRoomState.ts:87-99]
        │
        ↓
POST /api/study-rooms                            [api/study-rooms.ts:95-120]
Body: {"roomCode": "MYROOM", "password": "..."}
        │
        ↓
StudyRoomController.create()                     [StudyRoomController:40-43]
        │
        ↓
StudyRoomService.createRoom(request)             [StudyRoomService:78-110]
  ├─ getCurrentUser()                            [dòng 79]
  ├─ checkCreateRoomPermission(user)             [dòng 83]
  │   ├─ Nếu role = admin/sub_admin → OK
  │   └─ Nếu user thường → phải có subscription
  │       plan trả phí & chưa hết hạn            [dòng 209-230]
  ├─ Check unique roomCode                       [dòng 85-87]
  ├─ roomCode = roomCode.toUpperCase()           [dòng 89]
  ├─ resolveMaxMembers(user)                     [dòng 93]
  │   ├─ free → không cho tạo                    [dòng 234-235]
  │   ├─ plan_2_4 → 4 members                    [dòng 237]
  │   ├─ plan_5_plus → 99 members                [dòng 239]
  │   └─ admin/sub_admin → 99 members            [dòng 241]
  ├─ Create StudyRoom entity + save              [dòng 96-106]
  ├─ Add host as member                          [dòng 107]
  └─ Add system message                          [dòng 108]
        │
        ↓
Frontend: upsert room vào state, join phòng      [useStudyRoomState.ts:102-103]
```

### Chi tiết

- **Permission** (`StudyRoomService.checkCreateRoomPermission()` dòng 209-230):
  - Admin/sub_admin → auto allowed
  - User thường → cần `subscriptionPlanId != null` + `subscriptionExpiresAt > now` (nếu có)
- **Max members** (`resolveMaxMembers()` dòng 232-243):
  - Free/null → throw exception (không được tạo phòng)
  - plan_2_4 → 4
  - plan_5_plus → 99
  - admin/sub_admin → 99
- **Password**: nullable → `NULL` = phòng mở, `NOT NULL` = phòng có password (hash trong DB)
- **Room code**: tự động uppercase (frontend + backend đều xử lý)

### Điểm lưu ý khi review

- Có 2 layer check permission: frontend (UX) và backend (bảo mật)
- `resolveMaxMembers()` dùng switch-case trên tên plan string — cần đồng bộ với dữ liệu seed trong DB
- Password được hash (BCrypt?) — cần kiểm tra khi join room

---

## BR-063: Grant Subscription (Admin/Sub-admin)

**Mục tiêu:** Admin/Sub-admin có thể cấp gói subscription cho user. Sub-admin chỉ cấp được cho regular user (không admin, không sub-admin khác).

### Vị trí code

| Layer | File | Dòng |
|-------|------|------|
| Controller | `controller/AdminUserController.java` | 71-77 |
| DTO Request | `dto/GrantSubscriptionRequest.java` | 1-16 |
| Service | `service/AdminUserService.java` | 110-148 |
| Frontend API | `services/api/admin-users.ts` | 95-116 |
| Frontend Hook | `hooks/useSubscriptionState.ts` | 88-147 |
| Frontend UI | `components/admin/admin-dashboard.tsx` | 282-338 |

### Luồng hoạt động

```
Admin mở user table → click "Grant" trên 1 user
        │
        ↓
Modal: chọn plan (Free / 2-4 / 5+), nhập duration
→ confirm với mật khẩu admin                    [admin-dashboard.tsx:282-338]
        │
        ↓
Frontend: check role (admin mới được grant cho admin khác)  [useSubscriptionState.ts:105]
        │
        ↓
POST /api/admin/users/{userId}/subscription     [api/admin-users.ts:95-116]
Body: {"plan": "plan_2_4", "durationMonths": 6}
        │
        ↓
AdminUserController.grantSubscription()          [AdminUserController:71-77]
        │
        ↓
AdminUserService.grantSubscription(userId, req) [AdminUserService:112-148]
  ├─ Check current user role: admin/sub_admin    [dòng 113]
  ├─ Find target user                            [dòng 114]
  ├─ validateNotAdmin(targetUser)                [dòng 117]
  │   → sub-admin không được operate trên admin
  ├─ Nếu current là sub-admin:
  │   → target phải là regular user              [dòng 119-121]
  ├─ Map plan string → DB plan name              [dòng 123-128]
  ├─ Lookup SubscriptionPlan entity              [dòng 130-131]
  ├─ Update user.subscriptionPlanId              [dòng 133]
  ├─ Update user.storageLimitBytes               [dòng 134]
  │   (dùng storage_bytes từ SubscriptionPlan)
  ├─ Nếu plan = free → expiresAt = null          [dòng 137]
  │   Nếu plan ≠ free → requires duration > 0
  │   → set subscriptionExpiresAt = now + months  [dòng 139-144]
  └─ Save user → return response
        │
        ↓
Frontend: cập nhật user trong table + toast success
```

### Chi tiết

- **Phân quyền**:
  - Admin: grant được cho tất cả (admin, sub-admin, user)
  - Sub-admin: **chỉ** grant được cho regular user
- **`validateNotAdmin()`** (`AdminUserService:103`): nếu target là admin & current là sub-admin → throw
- **Free plan**: set `subscriptionExpiresAt = null` (vĩnh viễn)
- **Paid plan**: yêu cầu `durationMonths > 0`, tính `expiresAt = now + durationMonths`
- **Storage limit**: lấy từ `SubscriptionPlan.storageBytes` gán vào `user.storageLimitBytes`

### Điểm lưu ý khi review

- Logic phân quyền sub-admin ↔ admin được implement cả backend + frontend
- Duration months chỉ áp dụng cho paid plan
- Khi grant "Free", storage limit vẫn được cập nhật theo plan Free (thường là 512MB)

---

## BR-067: Permission Guard — Sub-admin không được thao tác trên Admin

**Mục tiêu:** Thiết lập permission guard xuyên suốt: Sub-admin **không được phép** thực hiện bất kỳ thao tác quản trị nào lên tài khoản Admin. Admin có thể thao tác trên tất cả trừ Admin khác và chính mình.

> ⚠ BR-067 **không phải** là tính năng storage limit. Đây là **lớp bảo vệ phân quyền** áp dụng cho *tất cả* admin operations: Grant Subscription, Storage Limit, Lock/Unlock, Reset Password, Delete User.

### Vị trí code

| Layer | File | Dòng | Vai trò |
|-------|------|------|---------|
| Backend — Core guard | `service/AdminUserService.java` | 103-108 | `validateNotAdmin()` — sub-admin không được operate trên admin |
| Backend — Used in | `service/AdminUserService.java` | 117, 156, 184, 212 | Áp dụng trong grantSubscription, updateStorageLimit, setLockStatus, resetPassword |
| Frontend — UI guard | `components/admin/admin-dashboard.tsx` | 69-74 | `canTouchAccount()` — quy tắc phân quyền phía UI |
| Frontend — Row-level | `components/admin/user-table.tsx` | 96 | `canOperate()` — disable button theo role |
| Frontend — Hook | `hooks/useSubscriptionState.ts` | 88-147 | `grantSubscription()` — check role trước khi gọi API |

### Luồng hoạt động

#### Backend: `validateNotAdmin()` (AdminUserService:103-108)
```
Admin/Sub-admin gửi request đến bất kỳ admin endpoint nào
(Grant / Storage Limit / Lock / Reset Password / Delete)
        │
        ↓
AdminUserService.requireAdminOrSubAdmin()
→ xác thực actor có quyền admin/sub_admin         [dòng 152]
        │
        ↓
AdminUserService.validateNotAdmin(actor, target)   [dòng 104-108]
        │
        ├─ Nếu actor = sub_admin && target = admin
        │   → throw FORBIDDEN "Cannot operate on Admin accounts."
        │
        └─ Nếu không → cho phép đi tiếp
                │
                ↓
        Kiểm tra bổ sung (tuỳ endpoint):
        ├─ Sub-admin chỉ operate trên regular user [dòng 119-121, 161-163]
        ├─ Không self-service                       [dòng 164]
        └─ Logic đặc thù (validate storage, ...)
```

#### Frontend: `canTouchAccount()` + `canOperate()` (2 lớp)
```
admin-dashboard.tsx:69-74              user-table.tsx:96
canTouchAccount(target)                canOperate(user)
        │                                      │
        ├─ target.id === self → false          ├─ isSubAdmin?
        ├─ target.role === "admin" → false     │   → user.role === "user"
        └─ isSubAdmin?                         └─ → user.role !== "admin"
            → target.role !== "user" → false
```

### Chi tiết

- **`validateNotAdmin()`** (`AdminUserService:103-108`): method private, được gọi ở **4 nơi**:
  1. `grantSubscription()` (dòng 117)
  2. `updateStorageLimit()` (dòng 156)
  3. `setLockStatus()` (dòng 184)
  4. `resetPassword()` (dòng 212)
- **Frontend `canTouchAccount()`** (`admin-dashboard.tsx:69-74`):
  - Admin: không touch được admin khác + không self-service
  - Sub-admin: chỉ touch được regular user
- **Frontend `canOperate()`** (`user-table.tsx:96`):
  - Sub-admin → disabled nếu user.role !== "user"
  - Admin → disabled nếu user.role === "admin"
- Áp dụng cho **tất cả** button action: Grant, Reset Password, Lock/Unlock, Delete, Storage Limit

### So sánh quyền (Actor → Target)

| Actor | Target: user | Target: sub-admin | Target: admin |
|-------|:-----------:|:-----------------:|:------------:|
| **Admin** | ✅ | ✅ | ❌ (không touch admin khác) |
| **Sub-admin** | ✅ | ❌ | ❌ |

### Điểm lưu ý khi review

- Đây là **cross-cutting concern** — 1 method guard nhưng ảnh hưởng đến nhiều endpoint
- Frontend + Backend đều implement guard → không thể bypass từ UI
- Bug fixed ở commit `cc5dbf3`: trước đó admin không touch được sub-admin trong UI (đã sửa)
- Bug fixed ở commit `395e3c4`: sub-admin có thể operate trên sub-admin khác backend (đã sửa)

---

## BR-073: Share only Public Documents

**Mục tiêu:** Chỉ tài liệu có `visibility = Public` mới được chia sẻ vào phòng học. Hệ thống từ chối Private và hiển thị lỗi rõ ràng.

### Vị trí code

| Layer | File | Dòng |
|-------|------|------|
| Controller | `controller/StudyRoomController.java` | 64 |
| Service | `service/StudyRoomService.java` | 180-207, đặc biệt 193-195 |
| DTO Request | `dto/ShareRoomDocumentRequest.java` | (file riêng) |
| Frontend UI | `components/chat/study-room-panel.tsx` | 190-234 |
| Frontend Hook | `hooks/useStudyRoomState.ts` | 175-190 |
| Frontend API | `services/api/study-rooms.ts` | 174-185 |
| Frontend i18n | `components/chat/study-room-panel.tsx` | 523 (vi), 566-567 (en) |

### Luồng hoạt động

```
User mở share dialog trong study room panel
        │
        ↓
Frontend: hiển thị danh sách document (chỉ ready)
Mỗi doc hiển thị: "Tên - Public" hoặc "Tên - Private"
Private docs → disabled trong dropdown          [study-room-panel.tsx:200-203]
        │
        ↓
User chọn 1 document (chỉ chọn được Public)
Click "Share"
        │
        ↓
Frontend check lại isPublic                     [study-room-panel.tsx:213-216]
Nếu không public → setShareError("Private docs cannot be shared")
        │
        ↓
POST /api/study-rooms/{code}/share-document     [api/study-rooms.ts:174-185]
Body: {"documentId": "..."}
        │
        ↓
StudyRoomService.shareDocument(code, request)   [StudyRoomService:180-207]
  ├─ getCurrentUser()                            [dòng 182]
  ├─ requireActiveMember(code, userId)          [dòng 183]
  │   → user phải là member active của phòng
  ├─ Tìm document + check tồn tại                [dòng 184-185]
  ├─ Check deletedAt == null && status == READY  [dòng 186-188]
  │   → "Chỉ được chia sẻ tài liệu đã sẵn sàng."
  ├─ Check ownership                             [dòng 189-192]
  │   → "Bạn không có quyền chia sẻ tài liệu này."
  ├─ ★ CHECK VISIBILITY ★                        [dòng 193-195]
  │   if (doc.getVisibility() != Visibility.PUBLIC)
  │       throw "Chỉ tài liệu Public mới được chia sẻ vào phòng."
  ├─ Tạo StudyRoomMessage (type = TYPE_DOCUMENT) [dòng 197-205]
  │   + set documentId, content = "Shared document: {title}"
  └─ save message → return response
        │
        ↓
Frontend: append message vào chat, clear form
```

### Chi tiết

- **2 lớp bảo vệ**:
  1. **Frontend**: disable option Private + check lại trước khi gọi API → UX tốt, ngăn ngay từ UI
  2. **Backend**: kiểm tra `visibility != PUBLIC` → `400 Bad Request` → bảo mật, không thể bypass
- **Điều kiện để share được document**:
  1. User là member active của phòng
  2. Document tồn tại, chưa bị soft delete
  3. Document status = `READY`
  4. User là owner của document
  5. **visibility = PUBLIC**
- **Message type**: `StudyRoomMessage.TYPE_DOCUMENT` — phân biệt với tin nhắn text thông thường

### Điểm lưu ý khi review

- Đây là BR trọng tâm — có cả UI guard + API guard
- Frontend dùng `disabled={!doc.isPublic}` trong `<option>` để ngăn chọn Private
- Backend throw `ApiException` với status code `400` + message tiếng Việt rõ ràng
- `share_status` và `share_note` đã có trong DB/Entity nhưng chưa dùng — dành cho luồng duyệt share sau này

---

## Tổng kết: Các pattern chung

### Backend Architecture Pattern
```
Controller (nhận request, parse params)
    → Service (@Transactional, business logic, validation)
        → Repository (JPA, query DB)
            → Entity (model)
```

### Frontend Architecture Pattern
```
UI Component (giao diện, event handler)
    → Hook (state management, optimistic update, error handling)
        → API Service (fetch, auth headers, map response)
            → Backend API
```

### Các pattern xuyên suốt
- **Optimistic update**: Cập nhật UI ngay, gọi API sau, revert nếu lỗi
- **2-layer validation**: Frontend (UX) + Backend (bảo mật)
- **Enum standardization**: DocumentStatus, Visibility, FlashcardStatus — dùng enum cả BE + FE
- **Soft delete**: Không xoá vật lý, chỉ set deleted_at + status
- **Role-based access**: Admin/Sub-admin có quyền cao hơn, sub-admin bị giới hạn so với admin
