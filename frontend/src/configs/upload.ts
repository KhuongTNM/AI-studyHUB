const DEFAULT_MAX_UPLOAD_FILE_SIZE_MB = 50
const DEFAULT_MAX_UPLOAD_FILES_COUNT = 5

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Max size per uploaded file, in megabytes. Mirrors backend multipart max-file-size by default. */
export const MAX_UPLOAD_FILE_SIZE_MB = readPositiveNumber(
  process.env.NEXT_PUBLIC_MAX_UPLOAD_FILE_SIZE_MB,
  DEFAULT_MAX_UPLOAD_FILE_SIZE_MB,
)

/** Max size per uploaded file, in bytes. */
export const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024

/** Max number of files accepted per upload batch in the modal. */
export const MAX_UPLOAD_FILES_COUNT = readPositiveNumber(
  process.env.NEXT_PUBLIC_MAX_UPLOAD_FILES_COUNT,
  DEFAULT_MAX_UPLOAD_FILES_COUNT,
)

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
