"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import {
  AlertCircle, Download, FileText, Image, Info, Link2, Lock, MessageCircle,
  MoreHorizontal, Paperclip, Plus, Search, Send, Smile, Users, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, type Document, type GroupChat, type GroupChatMessage } from "@/lib/store"

export function GroupChatPage() {
  const {
    currentUser, openAuthModal, language, documents, downloadDocument,
    groups, activeGroupId, groupLimit, groupMemberLimit,
    setActiveGroupId, createGroup, sendGroupMessage, shareGroupDocument,
  } = useApp()

  const text = groupText[language]
  const [search, setSearch] = useState("")
  const [message, setMessage] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [showFileShare, setShowFileShare] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDesc, setNewGroupDesc] = useState("")
  const [error, setError] = useState("")
  const [selectedDocumentId, setSelectedDocumentId] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeGroup = groups.find(group => group.id === activeGroupId) ?? groups[0] ?? null
  const ownedGroupCount = currentUser ? groups.filter(group => group.ownerId === currentUser.id).length : 0
  const readyDocuments = documents.filter(document => document.status === "ready")
  const filteredGroups = groups.filter(group => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return group.name.toLowerCase().includes(query) || group.description?.toLowerCase().includes(query)
  })

  const groupedDocuments = useMemo(() => {
    const bySubject = new Map<string, Document[]>()
    for (const document of readyDocuments) {
      const subject = document.subject?.trim() || text.noSubject
      bySubject.set(subject, [...(bySubject.get(subject) ?? []), document])
    }
    return Array.from(bySubject.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [readyDocuments, text.noSubject])

  useEffect(() => {
    if (!activeGroupId && activeGroup) setActiveGroupId(activeGroup.id)
  }, [activeGroup, activeGroupId, setActiveGroupId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeGroup?.messages.length])

  const handleCreateGroup = () => {
    const result = createGroup(newGroupName, newGroupDesc)
    if (!result.success) {
      setError(result.error ?? text.createFailed)
      return
    }
    setError("")
    setNewGroupName("")
    setNewGroupDesc("")
    setShowCreate(false)
  }

  const handleSend = () => {
    if (!currentUser) {
      openAuthModal("login")
      return
    }
    if (!activeGroup) return
    const result = sendGroupMessage(activeGroup.id, message)
    if (!result.success) {
      setError(result.error ?? text.sendFailed)
      return
    }
    setError("")
    setMessage("")
  }

  const handleShareDocument = () => {
    if (!activeGroup) return
    const document = readyDocuments.find(item => item.id === selectedDocumentId)
    if (!document) return
    const result = shareGroupDocument(activeGroup.id, document)
    if (!result.success) {
      setError(result.error ?? text.shareFailed)
      return
    }
    setError("")
    setSelectedDocumentId("")
    setShowFileShare(false)
  }

  if (!currentUser) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20 p-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">{text.loginTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{text.loginBody}</p>
          <Button className="mt-5" onClick={() => openAuthModal("login")}>{text.login}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden bg-muted/30">
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-border bg-background">
        <div className="border-b border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-foreground">{text.title}</h1>
              <p className="text-xs text-muted-foreground">
                {ownedGroupCount}/{groupLimit} {text.groupsCreated} • {groupMemberLimit} {text.memberLimit}
              </p>
            </div>
            <Button
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setError("")
                setShowCreate(true)
              }}
              disabled={groupLimit <= 0 || ownedGroupCount >= groupLimit}
              title={text.newGroup}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={text.search}
              className="h-9 w-full rounded-lg border border-border bg-muted/50 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          {groupLimit <= 0 && (
            <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{text.upgradeRequired}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredGroups.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 h-8 w-8" />
              {text.noGroups}
            </div>
          ) : (
            filteredGroups.map(group => (
              <GroupListItem
                key={group.id}
                group={group}
                active={group.id === activeGroup?.id}
                currentUserId={currentUser.id}
                onClick={() => setActiveGroupId(group.id)}
              />
            ))
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {activeGroup ? (
          <>
            <GroupHeader group={activeGroup} text={text} />

            {error && (
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
                <button className="ml-auto" onClick={() => setError("")}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              <div className="mx-auto flex max-w-5xl flex-col gap-3">
                {activeGroup.messages.map(item => (
                  <GroupMessageBubble
                    key={item.id}
                    message={item}
                    isSelf={item.senderId === currentUser.id}
                    text={text}
                    onDownload={() => item.documentId && downloadDocument(item.documentId)}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {showFileShare && (
              <div className="border-t border-border bg-background p-3">
                <div className="mx-auto max-w-5xl rounded-lg border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{text.shareFile}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowFileShare(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <select
                      value={selectedDocumentId}
                      onChange={event => setSelectedDocumentId(event.target.value)}
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">{text.chooseDocument}</option>
                      {groupedDocuments.map(([subject, subjectDocs]) => (
                        <optgroup key={subject} label={subject}>
                          {subjectDocs.map(document => (
                            <option key={document.id} value={document.id} disabled={!document.isPublic}>
                              {document.name} - {document.isPublic ? text.publicDoc : text.privateDoc}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <Button onClick={handleShareDocument} disabled={!selectedDocumentId}>
                      <FileText className="mr-2 h-4 w-4" />
                      {text.share}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{text.publicOnlyNote}</p>
                </div>
              </div>
            )}

            <div className="border-t border-border bg-background">
              <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
                <Button variant="ghost" size="icon" title={text.shareFile} onClick={() => setShowFileShare(prev => !prev)}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Image">
                  <Image className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Link">
                  <Link2 className="h-4 w-4" />
                </Button>
                <input
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={text.messagePlaceholder(activeGroup.name)}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-4 text-sm outline-none focus:border-primary focus:bg-background"
                />
                <Button variant="ghost" size="icon">
                  <Smile className="h-4 w-4" />
                </Button>
                <Button size="icon" onClick={handleSend} disabled={!message.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-md text-center">
              <Users className="mx-auto mb-3 h-12 w-12 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">{text.emptyTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{text.emptyBody}</p>
              <Button className="mt-5" disabled={groupLimit <= 0} onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {text.newGroup}
              </Button>
            </div>
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">{text.createTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text.createHint(groupLimit, groupMemberLimit)}</p>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-foreground">{text.groupName}</span>
              <input
                value={newGroupName}
                onChange={event => setNewGroupName(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                placeholder="SWP391 Team"
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-foreground">{text.description}</span>
              <textarea
                value={newGroupDesc}
                onChange={event => setNewGroupDesc(event.target.value)}
                className="min-h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder={text.descriptionPlaceholder}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>{text.cancel}</Button>
              <Button onClick={handleCreateGroup}>{text.create}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupListItem({
  group, active, currentUserId, onClick,
}: {
  group: GroupChat
  active: boolean
  currentUserId: string
  onClick: () => void
}) {
  const latestMessage = group.messages[group.messages.length - 1]
  const unread = !active && group.messages.length > 2
  return (
    <button
      onClick={onClick}
      className={cn(
        "mb-1 flex w-full gap-3 rounded-lg p-3 text-left transition-colors",
        active ? "bg-primary/10" : "hover:bg-muted",
      )}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {group.name.slice(0, 2).toUpperCase()}
        {unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-destructive ring-2 ring-background" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
          {group.ownerId === currentUserId && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Owner</span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {latestMessage?.messageType === "document" ? "Shared a file" : latestMessage?.content ?? group.description}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] text-muted-foreground">
          {latestMessage ? latestMessage.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""}
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">{group.members.length}/{group.maxMembers}</p>
      </div>
    </button>
  )
}

type GroupText = (typeof groupText)[keyof typeof groupText]

function GroupHeader({ group, text }: { group: GroupChat; text: GroupText }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {group.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-foreground">{group.name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {group.members.length}/{group.maxMembers} {text.members} • {group.description || text.noDescription}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" title={text.members}>
          <Users className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" title="Info">
          <Info className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" title="More">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

function GroupMessageBubble({
  message, isSelf, text, onDownload,
}: {
  message: GroupChatMessage
  isSelf: boolean
  text: GroupText
  onDownload: () => void
}) {
  if (message.messageType === "system") {
    return (
      <div className="text-center">
        <span className="inline-flex rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
          {message.content}
        </span>
      </div>
    )
  }

  const downloadable = message.documentDownloadable !== false && message.documentVisibility !== "private"
  return (
    <div className={cn("flex gap-2", isSelf ? "justify-end" : "justify-start")}>
      {!isSelf && (
        <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {message.senderName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className={cn("max-w-[72%]", isSelf ? "items-end" : "items-start")}>
        <p className={cn("mb-1 text-xs text-muted-foreground", isSelf ? "text-right" : "text-left")}>{message.senderName}</p>
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm shadow-sm",
            isSelf
              ? "border-primary/20 bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground",
            message.messageType === "document" && !downloadable && "opacity-60",
          )}
        >
          {message.messageType === "document" ? (
            <div className="min-w-64 space-y-2">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">{message.documentName}</p>
                  <p className={cn("text-xs", isSelf ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {message.documentSubject} • {message.documentVisibility === "private" ? text.privateDoc : text.publicDoc}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={isSelf ? "secondary" : "outline"}
                className="h-8 w-full gap-2"
                disabled={!downloadable}
                onClick={onDownload}
              >
                <Download className="h-3.5 w-3.5" />
                {downloadable ? text.download : text.unavailable}
              </Button>
            </div>
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          )}
        </div>
        <p className={cn("mt-1 text-[11px] text-muted-foreground", isSelf ? "text-right" : "text-left")}>
          {message.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}

const groupText = {
  vi: {
    title: "Chat nhóm",
    groupsCreated: "nhóm đã tạo",
    memberLimit: "thành viên/nhóm",
    newGroup: "Tạo nhóm mới",
    search: "Tìm kiếm nhóm",
    upgradeRequired: "Gói hiện tại chưa cho phép tạo nhóm. Hãy nâng cấp gói học nhóm để dùng tính năng này.",
    noGroups: "Chưa có nhóm nào",
    loginTitle: "Đăng nhập để dùng chat nhóm",
    loginBody: "Chat nhóm cho phép trao đổi với bạn học và chia sẻ tài liệu công khai.",
    login: "Đăng nhập",
    createFailed: "Không thể tạo nhóm.",
    sendFailed: "Không thể gửi tin nhắn.",
    shareFailed: "Không thể chia sẻ tài liệu.",
    noSubject: "Chưa đặt môn",
    members: "thành viên",
    noDescription: "Không có mô tả",
    shareFile: "Chia sẻ tài liệu",
    chooseDocument: "Chọn tài liệu công khai",
    publicDoc: "Public",
    privateDoc: "Private",
    share: "Chia sẻ",
    publicOnlyNote: "Chỉ tài liệu Public mới có thể chia sẻ vào nhóm. Private sẽ bị vô hiệu hóa.",
    messagePlaceholder: (name: string) => `Nhắn tin tới ${name}`,
    emptyTitle: "Chọn hoặc tạo một nhóm",
    emptyBody: "Nhóm dùng để chat với bạn học và chia sẻ tài liệu học tập.",
    createTitle: "Tạo nhóm học tập",
    createHint: (groups: number, members: number) => `Gói hiện tại cho phép tạo tối đa ${groups} nhóm, mỗi nhóm tối đa ${members} thành viên.`,
    groupName: "Tên nhóm",
    description: "Mô tả",
    descriptionPlaceholder: "Mục tiêu học tập, môn học, hoặc ghi chú cho nhóm",
    cancel: "Hủy",
    create: "Tạo nhóm",
    download: "Tải xuống",
    unavailable: "Không thể tải",
  },
  en: {
    title: "Group Chat",
    groupsCreated: "groups created",
    memberLimit: "members/group",
    newGroup: "Create group",
    search: "Search groups",
    upgradeRequired: "Your current plan cannot create groups. Upgrade to a study group package to use this feature.",
    noGroups: "No groups yet",
    loginTitle: "Log in to use group chat",
    loginBody: "Group chat lets students discuss together and share public study documents.",
    login: "Log in",
    createFailed: "Could not create group.",
    sendFailed: "Could not send message.",
    shareFailed: "Could not share document.",
    noSubject: "No subject",
    members: "members",
    noDescription: "No description",
    shareFile: "Share document",
    chooseDocument: "Choose public document",
    publicDoc: "Public",
    privateDoc: "Private",
    share: "Share",
    publicOnlyNote: "Only Public documents can be shared to groups. Private documents are disabled.",
    messagePlaceholder: (name: string) => `Message ${name}`,
    emptyTitle: "Choose or create a group",
    emptyBody: "Groups are for classmate chat and shared study materials.",
    createTitle: "Create study group",
    createHint: (groups: number, members: number) => `Your current package allows up to ${groups} groups with ${members} members per group.`,
    groupName: "Group name",
    description: "Description",
    descriptionPlaceholder: "Study goal, subject, or note for this group",
    cancel: "Cancel",
    create: "Create group",
    download: "Download",
    unavailable: "Unavailable",
  },
} as const
