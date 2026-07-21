// Giới hạn dung lượng/số lượng file KHÔNG còn hardcode ở đây nữa.
// Admin cấu hình trong DB (bảng core.upload_settings), FE đọc qua
// hooks/useUploadSettings.ts -> services/api/upload-settings.ts.
// File này chỉ giữ các constant về LOẠI file cho phép (không đổi theo admin).

export const ACCEPTED_UPLOAD_EXTENSIONS = ["pdf", "docx", "pptx"] as const

export const ACCEPTED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const

export const ACCEPTED_UPLOAD_INPUT_TYPES = ACCEPTED_UPLOAD_EXTENSIONS
  .map(extension => `.${extension}`)
  .join(",")

export const ACCEPTED_UPLOAD_LABEL = ACCEPTED_UPLOAD_EXTENSIONS
  .map(extension => extension.toUpperCase())
  .join(", ")
