/**
 * Mock cho 3 API: preview / download / upload — dùng khi MOCK_API = true (mock-config.ts).
 *
 * Mục tiêu: trả về đúng Response (status, headers, body) như trong
 * AI-studyHUB_API_File.docx để code xử lý ở documents.ts (parse header,
 * đọc blob...) được test y hệt lúc chạy với backend thật — không có
 * logic "giả" nào khác giữa 2 chế độ ngoài nguồn dữ liệu.
 *
 * Khi đổi MOCK_API = false, toàn bộ file này không còn được gọi tới nữa.
 */

// ─── Kho dữ liệu giả lập trong phiên làm việc (mất khi reload trang) ────────

interface MockDoc {
  id: string
  userId: string
  folderId: string | null
  originalName: string
  title: string
  subject: string
  visibility: "private" | "public"
  tags: string[]
  fileType: "pdf" | "docx" | "pptx"
  fileSizeBytes: number
  createdAt: string
}

const mockDocs = new Map<string, MockDoc>()
let mockSeq = 0

function newId(): string {
  mockSeq += 1
  return `mock-${Date.now()}-${mockSeq}`
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Tạo file PDF/binary giả để test preview & download thật sự có blob ─────

/** PDF hợp lệ tối thiểu — đủ để PDF.js / trình duyệt render được, không lỗi. */
function buildFakePdfBlob(): Blob {
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 150]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 78>>stream
BT /F1 14 Tf 20 100 Td (AI-studyHUB - Mock Preview (MOCK_API=true)) Tj ET
endstream
endobj
xref
0 6
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`
  return new Blob([pdf], { type: "application/pdf" })
}

function buildFakeOriginalFileBlob(fileType: string): Blob {
  const mime =
    fileType === "pdf"
      ? "application/pdf"
      : fileType === "pptx"
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  return new Blob([`Mock file content cho document (fileType=${fileType}).`], { type: mime })
}

/** Encode đúng RFC 5987 cho filename* — giữ nguyên dấu tiếng Việt để FE test decode. */
function rfc5987Encode(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())
}

function asciiFallback(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\x7F]/g, "_")
}

// ─── 1. Preview (GET /api/documents/{id}/preview) ───────────────────────────

export async function mockPreviewRequest(_id: string): Promise<Response> {
  await delay(400)
  const blob = buildFakePdfBlob()
  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
    },
  })
}

// ─── 2. Download (POST /api/documents/{id}/download) ────────────────────────

export async function mockDownloadRequest(id: string): Promise<Response> {
  await delay(400)
  const doc = mockDocs.get(id)
  const originalName = doc?.originalName ?? "Tài liệu mẫu.docx"
  const fileType = doc?.fileType ?? "docx"
  const mime =
    fileType === "pdf"
      ? "application/pdf"
      : fileType === "pptx"
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

  const blob = buildFakeOriginalFileBlob(fileType)
  const disposition = `attachment; filename="${asciiFallback(originalName)}"; filename*=UTF-8''${rfc5987Encode(originalName)}`

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": disposition,
    },
  })
}

// ─── 3. Upload (POST /api/documents/upload, multipart/form-data) ───────────

export async function mockUploadRequest(formData: FormData, _batchId?: string): Promise<Response> {
  await delay(600)

  const file = formData.get("file")
  const subject = (formData.get("subject") as string) || ""
  const title = (formData.get("title") as string) || ""
  const visibility = ((formData.get("visibility") as string) || "private") as "private" | "public"
  const tagsRaw = (formData.get("tags") as string) || ""
  const folderId = (formData.get("folderId") as string) || null

  if (!(file instanceof File)) {
    return jsonResponse(400, { message: "Chỉ hỗ trợ file PDF, DOCX, PPTX." })
  }
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (!ext || !["pdf", "docx", "pptx"].includes(ext)) {
    return jsonResponse(400, { message: "Chỉ hỗ trợ file PDF, DOCX, PPTX." })
  }
  if (!subject.trim()) {
    return jsonResponse(400, { message: "Môn học không được để trống." })
  }

  // BR mới: chặn trùng originalName trong CÙNG folder (kể cả cả 2 đều root/null),
  // không phân biệt hoa/thường — KHÔNG auto-rename (xem mục 3 trong docx).
  const duplicate = Array.from(mockDocs.values()).some(
    d => d.folderId === folderId && d.originalName.toLowerCase() === file.name.toLowerCase(),
  )
  if (duplicate) {
    return jsonResponse(409, {
      code: "DUPLICATE_FILE_NAME",
      message: `File '${file.name}' đã tồn tại trong thư mục này.`,
      timestamp: new Date().toISOString(),
      details: { fileName: file.name, folderId },
    })
  }

  const id = newId()
  const now = new Date().toISOString()
  const doc: MockDoc = {
    id,
    userId: "mock-current-user",
    folderId,
    originalName: file.name,
    title: title || file.name,
    subject: subject.trim(),
    visibility,
    tags: tagsRaw.split(",").map(t => t.trim()).filter(Boolean),
    fileType: ext as "pdf" | "docx" | "pptx",
    fileSizeBytes: file.size,
    createdAt: now,
  }
  mockDocs.set(id, doc)

  return jsonResponse(201, {
    id: doc.id,
    userId: doc.userId,
    folderId: doc.folderId,
    originalName: doc.originalName,
    title: doc.title,
    fileSizeBytes: doc.fileSizeBytes,
    fileType: doc.fileType,
    subject: doc.subject,
    status: "ready",
    // Mock hoàn tất "quét file" + "sinh embedding" ngay lập tức (không có hàng đợi
    // async thật như backend), nên trả luôn "done" — nếu không, polling ở
    // useDocumentState.ts sẽ chờ mãi vì GET /api/documents thật không biết
    // tới tài liệu mock này.
    embeddingStatus: "done",
    visibility: doc.visibility,
    downloadCount: 0,
    createdAt: doc.createdAt,
    updatedAt: doc.createdAt,
  })
}

// ─── 4. Danh sách tài liệu (GET /api/documents) ─────────────────────────────
// Dùng cho lần load đầu trang VÀ cho vòng polling sau khi upload (chờ
// status/embeddingStatus chuyển từ "scanning" sang "ready"/"done").

export async function mockFetchDocumentsRequest(): Promise<Response> {
  await delay(150)
  const docs = Array.from(mockDocs.values()).map(doc => ({
    id: doc.id,
    userId: doc.userId,
    folderId: doc.folderId,
    originalName: doc.originalName,
    title: doc.title,
    fileSizeBytes: doc.fileSizeBytes,
    fileType: doc.fileType,
    subject: doc.subject,
    status: "ready",
    embeddingStatus: "done",
    visibility: doc.visibility,
    tags: doc.tags,
    downloadCount: 0,
    createdAt: doc.createdAt,
    updatedAt: doc.createdAt,
  }))
  return jsonResponse(200, docs)
}
