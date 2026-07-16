# API Changelog (Backend -> Frontend)

> [!WARNING]
> **Các thay đổi sau là BẮT BUỘC để Frontend tích hợp với Backend.**

## 1. Xác thực thao tác xóa Gói dịch vụ (DELETE `/api/admin/subscription-plans/{planName}`)
- **Yêu cầu mới**: Để xóa một gói dịch vụ, Frontend phải gửi mật khẩu Admin qua HTTP Header `X-Admin-Password`.
- **Lý do**: Đảm bảo bảo mật khi xóa gói, vì HTTP DELETE theo chuẩn REST không nên chứa request body.
- **Phản hồi**: 
  - Nếu thiếu header: `400 Bad Request` ("Thiếu header X-Admin-Password.")
  - Nếu sai mật khẩu: `403 Forbidden` ("Mật khẩu Admin không chính xác.")

## 2. Thêm trường `adminPassword` vào `UpdatePlanRequest` (PUT `/api/admin/subscription-plans/{planName}`)
- **Yêu cầu mới**: Body request của API sửa đổi gói phải gửi kèm `adminPassword` để xác thực quyền thay đổi gói.
- **DTO**:
```json
{
  "description": "Mô tả gói",
  "price": 100000,
  "createGroupLimit": 10,
  "adminPassword": "mat khau admin"
}
```

## 3. Tạo nhóm (`POST /api/groups`)
- **Phản hồi lỗi mới**:
  - `403 Forbidden` (Code: `GROUP_CREATE_NOT_ALLOWED`): Gói hiện tại không được phép tạo nhóm (limit = 0).
  - `400 Bad Request` (Code: `GROUP_CREATE_LIMIT_REACHED`): Đã vượt giới hạn số lượng nhóm tối đa có thể tạo.

## 4. Tham gia nhóm (`POST /api/groups/join`)
- **Phản hồi lỗi mới**:
  - `400 Bad Request` (Code: `GROUP_JOIN_LIMIT_REACHED`): Người dùng đã tham gia số nhóm vượt quá giới hạn cho phép của gói.

## 5. Danh sách gói dịch vụ (Client API)
- **Endpoint**: `GET /api/subscription-plans`
- **Mô tả**: Sẽ chỉ trả về các gói đang hoạt động (không bị soft-delete). Dành cho người dùng (User) xem để mua gói.

## 6. Lỗi đồng thời khi tạo nhóm
- **Lưu ý**: Nhờ sử dụng cơ chế Pessimistic Lock ở database, việc gọi API tạo nhóm đồng thời nhiều lần (Race Condition) sẽ được tuần tự hóa, đảm bảo số nhóm tạo ra không vượt quá số lượng cho phép của gói hiện hành. Frontend có thể nhận thấy độ trễ rất nhỏ khi gửi request tạo nhóm quá nhanh, hoặc lỗi `GROUP_CREATE_LIMIT_REACHED`.
