# Frontend Refactoring — Implement Plan

> Mục tiêu: tách các component > 300 dòng thành các file nhỏ ≤ 150 dòng, dễ đọc và dễ bảo trì hơn.  
> Không thay đổi logic hay UI — pure structural refactor.

---

## Tổng quan

| File | Dòng hiện tại | Số file sau | Dòng orchestrator |
|---|---|---|---|
| `document-manager.tsx` | 666 | 6 | ~130 |
| `chat-interface.tsx` | 657 | 5 | ~120 |
| `profile-page.tsx` | 597 | 6 | ~80 |
| `admin-dashboard.tsx` | 488 | 5 | ~90 |

**Thứ tự thực hiện gợi ý:** document-manager → admin-dashboard → profile-page → chat-interface  
(từ dễ nhất — phân vùng rõ, ít dependency — đến phức tạp nhất)

---

## 1. `document-manager.tsx` — 666 dòng

File này đã có comment phân vùng sẵn (`// ─── Upload Progress`, v.v.), nên tách ra rất cơ học và ít rủi ro nhất.

### Cấu trúc folder sau refactor

```
src/components/documents/
├── document-manager.tsx        # orchestrator (~130 dòng)
├── upload-progress.tsx         # (~30 dòng)
├── document-preview-modal.tsx  # (~65 dòng)
├── edit-doc-modal.tsx          # (~50 dòng)
├── upload-modal.tsx            # (~85 dòng)
├── document-card.tsx           # (~110 dòng)
└── trash-page.tsx              # giữ nguyên
```

### Kế hoạch tách từng file

**`upload-progress.tsx`**
- Move: component `UploadProgress` (dòng 18–48)
- Export: `export function UploadProgress({ doc }: { doc: Document })`

**`document-preview-modal.tsx`**
- Move: component `DocumentPreviewModal` (dòng 51–117)
- Export: `export function DocumentPreviewModal({ doc, onClose, onDownload })`

**`edit-doc-modal.tsx`**
- Move: component `EditDocModal` (dòng 119–169)
- Export: `export function EditDocModal({ doc, onClose })`

**`upload-modal.tsx`**
- Move: component `UploadModal` (dòng 172–255)
- Export: `export function UploadModal({ onClose, onUpload })`

**`document-card.tsx`**
- Move: `fileTypeColors` constant + component `DocumentCard` (dòng 258–370)
- Export: `export const fileTypeColors`, `export function DocumentCard(...)`

**`document-manager.tsx` (orchestrator)**
- Giữ lại: `DocumentManager` — state, filter/sort logic, simulateUpload, layout
- Import các piece từ cùng folder

```typescript
// document-manager.tsx sau refactor
import { UploadProgress }        from "./upload-progress"
import { DocumentPreviewModal }  from "./document-preview-modal"
import { EditDocModal }          from "./edit-doc-modal"
import { UploadModal }           from "./upload-modal"
import { DocumentCard }          from "./document-card"
```

---

## 2. `admin-dashboard.tsx` — 488 dòng

Hiệu quả nhanh: object `text` i18n chiếm ~80 dòng, tách ra ngay lập tức giảm được đáng kể.

### Cấu trúc folder sau refactor

```
src/components/admin/
├── admin-dashboard.tsx     # orchestrator (~90 dòng)
├── stats-overview.tsx      # (~40 dòng)
├── user-table.tsx          # (~120 dòng)
├── confirm-modal.tsx       # (~45 dòng)
└── sub-admin-form.tsx      # (~50 dòng)

src/configs/
└── admin-i18n.ts           # (~90 dòng) — tách từ inline object
```

### Kế hoạch tách từng file

**`configs/admin-i18n.ts`** — làm trước tiên
- Move: object `text` với 2 key `vi` / `en` ra file config riêng
- Dùng lại trong dashboard mà không cần đổi gì khác

```typescript
// configs/admin-i18n.ts
export const adminText = {
  vi: { denied: "Không có quyền truy cập", ... },
  en: { denied: "Access denied", ... },
} as const

// admin-dashboard.tsx
import { adminText } from "@/configs/admin-i18n"
const text = adminText[language]
```

**`stats-overview.tsx`**
- Move: component `Stat` + phần render 4 thẻ thống kê
- Props: `{ totalUsers, activeUsers, lockedUsers, totalStorageUsed }`

**`user-table.tsx`**
- Move: component `UserSummary` + phần search + danh sách user với các action (lock/reset/delete/grant)
- Props: `{ users, documents, onLock, onReset, onDelete, onGrant, onStorageLimit, text }`

**`confirm-modal.tsx`**
- Move: component `ConfirmModal` (dòng 458–488)
- Export: `export function ConfirmModal({ pendingAction, onConfirm, onCancel, text })`

**`sub-admin-form.tsx`**
- Move: phần form tạo tài khoản sub-admin
- Props: `{ onSubmit, text }` — nhận callback, tự quản lý state form nội bộ

---

## 3. `profile-page.tsx` — 597 dòng

Pattern tab rõ ràng (`"info" | "history" | "security" | "packages"`), tách theo từng tab vào subfolder.

### Cấu trúc folder sau refactor

```
src/components/profile/
├── profile-page.tsx          # orchestrator (~80 dòng)
├── checkout-modal.tsx        # (~100 dòng)
└── tabs/
    ├── info-tab.tsx          # (~70 dòng)
    ├── history-tab.tsx       # (~40 dòng)
    ├── security-tab.tsx      # (~55 dòng)
    └── packages-tab.tsx      # (~80 dòng)
```

### Kế hoạch tách từng file

**`tabs/info-tab.tsx`**
- Move: tab "info" — avatar initials, form tên hiển thị, storage progress bar
- Props: `{ user, displayName, setDisplayName, saved, onSave }`

**`tabs/history-tab.tsx`**
- Move: tab "history" — render danh sách `userLogs`
- Props: `{ logs: ActivityLog[] }`

**`tabs/security-tab.tsx`**
- Move: tab "security" — form đổi mật khẩu + validation logic
- Tự quản lý state `oldPass / newPass / confirmPass` nội bộ
- Props: `{ onChangePassword: (old, new) => void; error: string; success: string }`

**`tabs/packages-tab.tsx`**
- Move: tab "packages" — bảng so sánh gói Free/Basic/Pro + nút mua
- Props: `{ currentUser, packagePrices, onBuy: (tier: PackageTier) => void }`

**`checkout-modal.tsx`**
- Move: toàn bộ flow checkout (QR/card/wallet, VietQR API call, confirm)
- Có async logic riêng nên xứng đáng là file độc lập
- Props: `{ tier, onClose, onSuccess }`

**`profile-page.tsx` (orchestrator)**
- Giữ lại: tab switcher, shared state (`tab`, `showCheckoutModal`, `selectedTier`)
- Lắng nghe `sessionStorage` event để mở tab packages từ nơi khác

```typescript
// profile-page.tsx sau refactor
import { InfoTab }       from "./tabs/info-tab"
import { HistoryTab }    from "./tabs/history-tab"
import { SecurityTab }   from "./tabs/security-tab"
import { PackagesTab }   from "./tabs/packages-tab"
import { CheckoutModal } from "./checkout-modal"
```

---

## 4. `chat-interface.tsx` — 657 dòng

File phức tạp nhất vì Study Room panel lẫn vào cùng component với chat thông thường. Nên tách `study-room-panel.tsx` trước vì nó chiếm ~200 dòng và có state riêng biệt.

### Cấu trúc folder sau refactor

```
src/components/
├── chat-interface.tsx          # orchestrator (~120 dòng)
└── chat/
    ├── chat-toolbar.tsx        # (~70 dòng)
    ├── chat-message.tsx        # (~60 dòng)
    ├── chat-input-bar.tsx      # (~50 dòng)
    └── study-room-panel.tsx    # (~150 dòng)
```

### Kế hoạch tách từng file

**`chat/study-room-panel.tsx`** — tách trước tiên
- Move: toàn bộ UI và logic Study Room (join/create room, members list, room messages, roomInput)
- State nội bộ: `roomActionTab`, `roomIdInput`, `roomPasswordInput`, `roomError`, `roomInput`
- Props: `{ rooms, currentRoomId, currentUser, onCreateRoom, onJoinRoom, onLeaveRoom, onCloseRoom, onSendMessage }`

**`chat/chat-toolbar.tsx`**
- Move: toolbar với nút New Chat, Document picker dropdown, Study Room toggle button
- Props: `{ onNewChat, documents, selectedDocId, onSelectDoc, showRoomPanel, onToggleRoom }`

**`chat/chat-message.tsx`**
- Move: render một message bubble (user hoặc AI), nút copy/thumbs up/thumbs down
- Props: `{ message: ChatMessage; copiedId: string | null; onCopy: (id, content) => void }`

**`chat/chat-input-bar.tsx`**
- Move: textarea, character counter, nút Send, suggested questions khi chưa có chat
- Props: `{ input, setInput, isLoading, maxLength, onSend, onKeyDown, showSuggestions, suggestedQuestions }`

**`chat-interface.tsx` (orchestrator)**
- Giữ lại: `handleSend`, `handleNewChat`, session management, `useEffect` scroll
- Có thể extract thêm vào `hooks/useChatSession.ts` nếu muốn

```typescript
// chat-interface.tsx sau refactor
import { ChatToolbar }      from "./chat/chat-toolbar"
import { ChatMessage }      from "./chat/chat-message"
import { ChatInputBar }     from "./chat/chat-input-bar"
import { StudyRoomPanel }   from "./chat/study-room-panel"
```

---

## Các cải tiến bổ sung (không bắt buộc)

### Tách hook logic cho chat

Dự án đã có pattern hook tốt (`useAdminState`, `useChatState`...). Có thể mở rộng thêm:

```typescript
// hooks/useChatSession.ts
export function useChatSession() {
  // handleSend, handleNewChat, session state management
}

// hooks/useStudyRoom.ts  
export function useStudyRoom() {
  // join, create, leave, sendMessage
}
```

### Barrel export (index.ts)

Mỗi folder component nên có `index.ts` để import gọn hơn:

```typescript
// components/documents/index.ts
export { DocumentManager }       from "./document-manager"
export { DocumentCard }          from "./document-card"
export { UploadModal }           from "./upload-modal"

// Dùng ở nơi khác:
import { DocumentManager } from "@/components/documents"
```

---

## Quy tắc khi thực hiện

1. **Tách từng file một, commit riêng** — đừng tách tất cả cùng lúc, khó review và rollback
2. **Không thay đổi logic** trong lần refactor này — chỉ move code, không optimize
3. **Kiểm tra sau mỗi file** — chạy app và test tính năng liên quan trước khi tách file tiếp theo
4. **Props typing** — khi tách component, định nghĩa rõ ràng interface cho props thay vì dùng inline type
5. **Không tách UI library** — folder `components/ui/` giữ nguyên, đây là shadcn/ui không cần đụng đến
