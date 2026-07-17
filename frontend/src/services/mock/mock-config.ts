/**
 * Bật/tắt mock cho 3 API tài liệu đang chờ Backend code xong
 * (preview / download / upload — theo AI-studyHUB_API_File.docx, đối chiếu 17/07/2026).
 *
 * true  → dùng mock, không gọi backend thật (đủ để FE tự test UI/flow).
 * false → gọi thẳng backend thật tại NEXT_PUBLIC_API_URL.
 *
 * Đổi đúng 1 dòng dưới đây khi backend đã deploy xong 3 API.
 */
export const MOCK_API = true
