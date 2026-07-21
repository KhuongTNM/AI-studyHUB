import { useEffect, useState } from "react"
import { fetchUploadSettingsApi, type UploadSettings } from "@/services/api/upload-settings"

// Fallback CHỈ dùng trong lúc đang tải xong API lần đầu, không phải rule nghiệp vụ cố định.
const LOADING_FALLBACK: UploadSettings = {
  maxFileSizeBytes: 50 * 1024 * 1024,
  maxFileSizeMb: 50,
  maxFilesPerUpload: 5,
}

export function useUploadSettings() {
  const [settings, setSettings] = useState<UploadSettings>(LOADING_FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchUploadSettingsApi()
      .then((data) => {
        if (!cancelled) setSettings(data)
      })
      .catch(() => {
        // giữ fallback nếu API lỗi, không chặn user thao tác
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ...settings, loading }
}
