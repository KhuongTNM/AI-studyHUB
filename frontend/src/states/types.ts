export type UserRole = "guest" | "user" | "sub-admin" | "admin"
export type PackageTier = "free" | "2-4" | "5+"

export interface User {
  id: string
  email: string
  displayName: string
  password: string
  avatar?: string
  role: UserRole
  isLocked: boolean
  emailVerified: boolean
  createdAt: Date
  loginAttempts: number
  lastActive: Date
  storageUsed: number
  storageLimit: number
  subscriptionTier?: PackageTier
  subscriptionExpiresAt?: Date
  languagePreference?: Language
}

export interface PackagePrice {
  id: string
  name: string
  tier: PackageTier
  price: number
  maxUsers: number
}

export interface GroupChatMember {
  userId: string
  displayName: string
  avatar?: string
  role: "owner" | "member"
  joinedAt: Date
}

export interface GroupChatMessage {
  id: string
  groupId: string
  senderId: string
  senderName: string
  content: string
  timestamp: Date
  messageType: "text" | "document" | "image" | "system"
  documentId?: string
  documentName?: string
  documentSubject?: string
  documentVisibility?: "public" | "private"
  documentDownloadable?: boolean
  imageUrl?: string
  imageName?: string
}

export interface GroupChat {
  id: string
  groupCode: string
  password: string
  name: string
  description?: string
  ownerId: string
  ownerName: string
  maxMembers: number
  members: GroupChatMember[]
  messages: GroupChatMessage[]
  createdAt: Date
  updatedAt: Date
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface Folder {
  id: string
  name: string
  parentId: string | null  // null = root
  subject?: string         // Môn học gắn với thư mục
  createdAt: Date
  createdBy: string
  color?: string
}

export type DocStatus = "uploading" | "scanning" | "ready" | "failed" | "deleted"
export type ShareStatus = "none" | "pending" | "approved" | "rejected"

export interface Document {
  id: string
  name: string
  type: "pdf" | "docx" | "pptx"
  size: string
  sizeBytes: number
  uploadedAt: Date
  uploadedBy: string
  categoryId: string
  subject: string
  folderId?: string | null  // null or undefined = root
  status: DocStatus
  uploadProgress?: number
  description?: string
  tags: string[]
  downloadCount: number
  isPublic: boolean
  shareStatus: ShareStatus
  shareNote?: string
  reviewedBy?: string
  reviewedAt?: Date
}

export interface ChatSource {
  content: string
  documentId?: string
  documentName?: string
  score?: number
  [key: string]: unknown
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: ChatSource[]
  isStreaming?: boolean
  error?: boolean
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  documentId?: string
  createdAt: Date
}

export interface ActivityLog {
  id: string
  userId: string
  action: string
  target: string
  timestamp: Date
}
export type FlashcardStatus = "new" | "learning" | "mastered"

export interface Flashcard {
  id: string
  documentId?: string
  question: string
  answer: string
  createdAt: Date
  status?: FlashcardStatus
}
export type Language = "vi" | "en"
