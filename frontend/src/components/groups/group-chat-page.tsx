"use client"

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react"
import {
  AlertCircle, Download, FileText, Image, Info, Loader2, LogOut, Mail, MessageCircle,
  MoreHorizontal, Paperclip, Plus, Search, Send, Smile, Trash2, UserMinus, Users, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, type Document, type GroupChat, type GroupChatMember, type GroupChatMessage, type GroupInvitationCandidate } from "@/lib/store"

export function GroupChatPage() {
  const {
    currentUser, openAuthModal, language, documents,
    groups, activeGroupId, groupsLoading, groupLoadError, groupCreateLimit, groupJoinLimit,
    setActiveGroupId, loadGroups, createGroup, searchGroupInvitationUser, inviteGroupMemberByEmail,
    leaveGroup, kickGroupMember, deleteGroup,
    updateGroupMuted, updateGroupPinned,
    sendGroupMessage, shareGroupDocument, shareGroupImage, downloadGroupDocument,
    exportGroupChat, reportGroup, generateGroupCode,
  } = useApp()

  const text = groupText[language]
  const [search, setSearch] = useState("")
  const [message, setMessage] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [showFileShare, setShowFileShare] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDesc, setNewGroupDesc] = useState("")
  const [newGroupCode, setNewGroupCode] = useState(generateGroupCode)
  const [error, setError] = useState("")
  const [mockNotice, setMockNotice] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showKickConfirm, setShowKickConfirm] = useState(false)
  const [memberToKick, setMemberToKick] = useState<GroupChatMember | null>(null)
  const [kickError, setKickError] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteCandidate, setInviteCandidate] = useState<GroupInvitationCandidate | null>(null)
  const [inviteSearching, setInviteSearching] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [groupActionBusy, setGroupActionBusy] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [selectedDocumentId, setSelectedDocumentId] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const activeGroup = groups.find(group => group.id === activeGroupId) ?? groups[0] ?? null
  const isActiveGroupOwner = Boolean(activeGroup && currentUser && activeGroup.ownerId === currentUser.id)
  const ownedGroupCount = currentUser ? groups.filter(group => group.ownerId === currentUser.id).length : 0
  const joinedGroupCount = currentUser ? groups.filter(group => group.members.some(member => member.userId === currentUser.id)).length : 0
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

  const getInviteErrorText = useMemo(() => (inviteErrorCode?: string) => {
    const code = inviteErrorCode?.toUpperCase() ?? ""
    if (code.includes("USER_NOT_FOUND")) return text.inviteUserNotFound
    if (code.includes("GROUP_CANNOT_INVITE_SELF")) return text.inviteSelf
    if (code.includes("GROUP_MEMBER_ALREADY_JOINED_OR_INVITED")) return text.inviteDuplicate
    if (code.includes("GROUP_OWNER_REQUIRED") || code.includes("GROUP_ACCESS_DENIED")) return text.inviteOwnerOnly
    if (code.includes("UNAUTHENTICATED")) return text.sessionExpired
    return inviteErrorCode || text.inviteFailed
  }, [text])

  const getDownloadErrorText = useMemo(() => (downloadErrorCode?: string) => {
    const code = downloadErrorCode?.toUpperCase() ?? ""
    if (code.includes("DOCUMENT_NOT_FOUND")) return text.documentNotFound
    if (code.includes("DOCUMENT_NOT_PUBLIC")) return text.documentNotPublic
    if (code.includes("DOCUMENT_NOT_READY")) return text.documentNotReady
    if (code.includes("DOCUMENT_DELETED")) return text.documentDeleted
    if (code.includes("GROUP_ACCESS_DENIED")) return text.groupAccessDenied
    if (code.includes("UNAUTHENTICATED")) return text.sessionExpired
    return downloadErrorCode || text.downloadFailed
  }, [text])

  useEffect(() => {
    if (!showMembers || !activeGroup || !isActiveGroupOwner) {
      setInviteSearching(false)
      setInviteCandidate(null)
      setInviteError("")
      return
    }

    const email = inviteEmail.trim().toLowerCase()
    setInviteCandidate(null)
    setInviteError("")

    if (!email) {
      setInviteSearching(false)
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteSearching(false)
      setInviteError(text.inviteInvalidEmail)
      return
    }

    let cancelled = false
    setInviteSearching(true)
    const timer = window.setTimeout(async () => {
      const result = await searchGroupInvitationUser(activeGroup.id, email)
      if (cancelled) return
      setInviteSearching(false)
      if (!result.success) {
        setInviteError(getInviteErrorText(result.error))
        return
      }
      setInviteCandidate(result.user ?? null)
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeGroup?.id, getInviteErrorText, inviteEmail, isActiveGroupOwner, searchGroupInvitationUser, showMembers, text])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeGroup?.messages.length])

  const handleCreateGroup = async () => {
    setGroupActionBusy(true)
    const result = await createGroup(newGroupName, newGroupDesc, newGroupCode)
    setGroupActionBusy(false)
    if (!result.success) {
      setError(result.error ?? text.createFailed)
      return
    }
    setError("")
    setNewGroupName("")
    setNewGroupDesc("")
    setNewGroupCode(generateGroupCode())
    setShowCreate(false)
  }

  const handleInviteMember = async () => {
    if (!activeGroup || !inviteCandidate || !inviteEmail.trim()) return

    setInviteBusy(true)
    setInviteError("")
    const result = await inviteGroupMemberByEmail(activeGroup.id, inviteEmail.trim().toLowerCase())
    setInviteBusy(false)
    if (!result.success) {
      setInviteError(getInviteErrorText(result.error))
      return
    }

    setInviteEmail("")
    setInviteCandidate(null)
    showMockNotice(text.inviteSent)
  }

  const handleLeaveOrDelete = async () => {
    if (!activeGroup || !currentUser) return
    if (activeGroup.ownerId === currentUser.id) {
      setShowDeleteConfirm(true)
      return
    }

    setGroupActionBusy(true)
    const result = await leaveGroup(activeGroup.id)
    setGroupActionBusy(false)
    if (!result.success) {
      setError(result.error ?? text.actionFailed)
      return
    }
    setError("")
  }

  const handleConfirmDelete = async () => {
    if (!activeGroup) return
    setGroupActionBusy(true)
    const result = await deleteGroup(activeGroup.id)
    setGroupActionBusy(false)
    if (!result.success) {
      setError(result.error ?? text.actionFailed)
      return
    }
    setError("")
    setShowDeleteConfirm(false)
  }

  const openKickConfirm = (member: GroupChatMember) => {
    if (!isActiveGroupOwner || member.role === "owner") return
    setMemberToKick(member)
    setKickError("")
    setShowKickConfirm(true)
  }

  const closeKickConfirm = () => {
    setShowKickConfirm(false)
    setMemberToKick(null)
    setKickError("")
  }

  const getKickErrorText = (error?: string) => {
    switch (error) {
      case "GROUP_OWNER_REQUIRED":
        return text.kickOwnerOnly
      case "GROUP_CANNOT_KICK_SELF":
        return text.kickSelf
      case "GROUP_MEMBER_NOT_FOUND":
        return text.memberNotFound
      case "UNAUTHENTICATED":
        return text.sessionExpired
      default:
        return error || text.kickFailed
    }
  }

  const handleConfirmKick = async () => {
    if (!activeGroup || !memberToKick) return
    setGroupActionBusy(true)
    setKickError("")
    const result = await kickGroupMember(activeGroup.id, memberToKick.userId)
    setGroupActionBusy(false)
    if (!result.success) {
      setKickError(getKickErrorText(result.error))
      return
    }
    setError("")
    showMockNotice(text.memberKicked)
    closeKickConfirm()
  }

  const closeGroupInfo = () => {
    setShowInfo(false)
  }

  const closeMembers = () => {
    setShowMembers(false)
    setInviteEmail("")
    setInviteCandidate(null)
    setInviteError("")
    setInviteSearching(false)
  }

  const showMockNotice = (notice: string) => {
    setMockNotice(notice)
    setError("")
  }

  const handleSend = async () => {
    if (!currentUser) {
      openAuthModal("login")
      return
    }
    if (!activeGroup) return
    setGroupActionBusy(true)
    const result = await sendGroupMessage(activeGroup.id, message)
    setGroupActionBusy(false)
    if (!result.success) {
      setError(result.error ?? text.sendFailed)
      return
    }
    setError("")
    setMessage("")
  }

  const handleShareDocument = async () => {
    if (!activeGroup) return
    const document = readyDocuments.find(item => item.id === selectedDocumentId)
    if (!document) return
    setGroupActionBusy(true)
    const result = await shareGroupDocument(activeGroup.id, document)
    setGroupActionBusy(false)
    if (!result.success) {
      setError(result.error ?? text.shareFailed)
      return
    }
    setError("")
    showMockNotice(text.documentUploaded)
    setSelectedDocumentId("")
    setShowFileShare(false)
  }

  const handleImageUpload = async (file: File) => {
    if (!activeGroup) return
    setGroupActionBusy(true)
    const result = await shareGroupImage(activeGroup.id, file)
    setGroupActionBusy(false)
    if (!result.success) {
      setError(result.error ?? text.imageUploadFailed)
      return
    }
    setError("")
    showMockNotice(text.imageUploaded)
  }

  const handleDownloadSharedDocument = async (documentId: string) => {
    if (!activeGroup) return
    const result = await downloadGroupDocument(activeGroup.id, documentId)
    if (!result.success) {
      setError(getDownloadErrorText(result.error))
      return
    }
    setError("")
  }

  const handleToggleMute = async () => {
    if (!activeGroup) return
    const result = await updateGroupMuted(activeGroup.id, !activeGroup.muted)
    if (!result.success) {
      setError(result.error ?? text.actionFailed)
      return
    }
    setError("")
    showMockNotice(!activeGroup.muted ? text.mutedSaved : text.unmutedSaved)
  }

  const handleTogglePin = async () => {
    if (!activeGroup) return
    const result = await updateGroupPinned(activeGroup.id, !activeGroup.pinned)
    if (!result.success) {
      setError(result.error ?? text.actionFailed)
      return
    }
    setError("")
    showMockNotice(!activeGroup.pinned ? text.pinnedSaved : text.unpinnedSaved)
  }

  const handleExportChat = async () => {
    if (!activeGroup) return
    const result = await exportGroupChat(activeGroup.id)
    if (!result.success) {
      setError(result.error ?? text.exportFailed)
      return
    }
    setError("")
    showMockNotice(text.exportStarted)
  }

  const handleReportGroup = async () => {
    if (!activeGroup) return
    const result = await reportGroup(activeGroup.id, reportReason)
    if (!result.success) {
      setError(result.error ?? text.reportFailed)
      return
    }
    setError("")
    setReportReason("")
    setShowReport(false)
    setShowOptions(false)
    showMockNotice(text.reportSubmitted)
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
                {ownedGroupCount}/{groupCreateLimit} {text.groupsCreated} • {joinedGroupCount}/{groupJoinLimit} {text.groupsJoined}
              </p>
            </div>
            <Button
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setError("")
                setShowCreate(true)
              }}
              disabled={groupCreateLimit <= 0 || ownedGroupCount >= groupCreateLimit || joinedGroupCount >= groupJoinLimit}
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
          {groupLoadError && (
            <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">{groupLoadError}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-8 w-full"
                onClick={() => void loadGroups()}
                disabled={groupsLoading}
              >
                {text.retry}
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredGroups.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 h-8 w-8" />
              {groupsLoading ? text.loadingGroups : groupLoadError ? text.loadFailed : text.noGroups}
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
            <GroupHeader
              group={activeGroup}
              text={text}
              currentUserId={currentUser.id}
              onLeaveOrDelete={handleLeaveOrDelete}
              onShowMembers={() => setShowMembers(true)}
              onShowInfo={() => setShowInfo(true)}
              onShowOptions={() => setShowOptions(true)}
            />

            {mockNotice && (
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                <Info className="h-4 w-4" />
                {mockNotice}
                <button className="ml-auto" onClick={() => setMockNotice("")}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

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
                    onDownload={() => item.documentId && handleDownloadSharedDocument(item.documentId)}
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
                    <Button onClick={handleShareDocument} disabled={!selectedDocumentId || groupActionBusy}>
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
                <Button variant="ghost" size="icon" title={text.uploadImage} onClick={() => imageInputRef.current?.click()}>
                  <Image className="h-4 w-4" />
                </Button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0]
                    event.currentTarget.value = ""
                    if (file) void handleImageUpload(file)
                  }}
                />
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
                <Button variant="ghost" size="icon" title={text.mockEmoji} onClick={() => showMockNotice(text.mockEmoji)}>
                  <Smile className="h-4 w-4" />
                </Button>
                <Button size="icon" onClick={handleSend} disabled={!message.trim() || groupActionBusy}>
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
              <p className="mt-2 text-sm text-muted-foreground">
                {groupsLoading ? text.loadingGroups : groupLoadError ? text.loadFailed : text.emptyBody}
              </p>
              {groupLoadError && (
                <Button variant="outline" className="mt-4" onClick={() => void loadGroups()} disabled={groupsLoading}>
                  {text.retry}
                </Button>
              )}
              <Button className="mt-5" disabled={groupCreateLimit <= 0 || joinedGroupCount >= groupJoinLimit} onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {text.newGroup}
              </Button>
            </div>
          </div>
        )}
      </section>

      {showMembers && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{text.memberList}</h2>
                <p className="text-sm text-muted-foreground">{activeGroup.members.length}/{activeGroup.maxMembers} {text.members}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeMembers}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {isActiveGroupOwner && (
              <div className="mb-4 rounded-lg border border-border bg-background p-3">
                <div className="mb-3 flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{text.inviteMember}</p>
                    <p className="text-xs text-muted-foreground">{text.inviteHint}</p>
                  </div>
                </div>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={event => setInviteEmail(event.target.value)}
                  placeholder={text.inviteEmailPlaceholder}
                  disabled={inviteBusy}
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                />
                {inviteSearching && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {text.inviteSearching}
                  </p>
                )}
                {inviteError && (
                  <p className="mt-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">{inviteError}</p>
                )}
                {inviteCandidate && !inviteSearching && !inviteError && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {inviteCandidate.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{inviteCandidate.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{inviteEmail.trim()}</p>
                    </div>
                    <Button type="button" size="sm" onClick={handleInviteMember} disabled={inviteBusy}>
                      {inviteBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1.5 h-3.5 w-3.5" />}
                      {text.inviteButton}
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              {activeGroup.members.map(member => (
                <div key={member.userId} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {member.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{member.displayName}</p>
                    <p className="text-xs text-muted-foreground">{text.joinedAt}: {member.joinedAt.toLocaleDateString()}</p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-1 text-xs font-medium",
                    member.role === "owner" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary",
                  )}>
                    {member.role === "owner" ? text.owner : text.member}
                  </span>
                  {isActiveGroupOwner && member.role !== "owner" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title={text.kickMember}
                      aria-label={`${text.kickMember}: ${member.displayName}`}
                      onClick={() => openKickConfirm(member)}
                      disabled={groupActionBusy}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showKickConfirm && activeGroup && memberToKick && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{text.kickConfirmTitle}</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeKickConfirm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {text.kickConfirmBody(memberToKick.displayName, activeGroup.name)}
            </p>
            {kickError && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{kickError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={closeKickConfirm}>{text.cancel}</Button>
              <Button variant="destructive" onClick={handleConfirmKick} disabled={groupActionBusy}>
                <UserMinus className="mr-2 h-4 w-4" />
                {text.kickMember}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showInfo && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{text.groupInfo}</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeGroupInfo}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 text-sm">
              <InfoRow label={text.groupName} value={activeGroup.name} />
              <InfoRow label={text.groupId} value={activeGroup.groupCode} />
              <InfoRow label={text.owner} value={activeGroup.ownerName} />
              <InfoRow label={text.memberCount} value={`${activeGroup.members.length}/${activeGroup.maxMembers}`} />
              <InfoRow label={text.createdAt} value={activeGroup.createdAt.toLocaleString()} />
              <InfoRow label={text.description} value={activeGroup.description || text.noDescription} />
            </div>
            <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">{text.groupInfoBackendNote}</p>
          </div>
        </div>
      )}

      {showOptions && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{text.groupOptions}</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowOptions(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Button type="button" variant="outline" className="w-full justify-start" onClick={handleToggleMute}>
                {activeGroup.muted ? text.unmuteGroup : text.muteGroup}
              </Button>
              <Button type="button" variant="outline" className="w-full justify-start" onClick={handleTogglePin}>
                {activeGroup.pinned ? text.unpinGroup : text.pinGroup}
              </Button>
              <Button type="button" variant="outline" className="w-full justify-start" onClick={handleExportChat}>
                {text.exportChat}
              </Button>
              <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setShowReport(true)}>
                {text.reportGroup}
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{text.optionsBackendNote}</p>
          </div>
        </div>
      )}

      {showReport && activeGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{text.reportGroup}</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowReport(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{text.reportHint(activeGroup.name)}</p>
            <textarea
              value={reportReason}
              onChange={event => setReportReason(event.target.value)}
              className="min-h-28 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder={text.reportPlaceholder}
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReport(false)}>{text.cancel}</Button>
              <Button onClick={handleReportGroup} disabled={!reportReason.trim()}>{text.submitReport}</Button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">{text.createTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text.createHint(groupCreateLimit, groupJoinLimit)}</p>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-foreground">{text.groupId}</span>
              <div className="flex gap-2">
                <input
                  value={newGroupCode}
                  readOnly
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-muted px-3 text-sm font-semibold text-foreground outline-none"
                />
                <Button type="button" variant="outline" onClick={() => setNewGroupCode(generateGroupCode())}>
                  {text.regenerate}
                </Button>
              </div>
            </label>
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
              <Button onClick={handleCreateGroup} disabled={groupActionBusy}>{text.create}</Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">{text.deleteConfirmTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {text.deleteConfirmBody(activeGroup.name, activeGroup.groupCode)}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>{text.cancel}</Button>
              <Button variant="destructive" onClick={handleConfirmDelete} disabled={groupActionBusy}>{text.deleteGroup}</Button>
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
          {group.groupCode} • {latestMessage?.messageType === "document"
            ? "Shared a file"
            : latestMessage?.messageType === "image"
              ? "Shared an image"
              : latestMessage?.content ?? group.description}
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-medium text-foreground">{value}</span>
    </div>
  )
}

type GroupText = (typeof groupText)[keyof typeof groupText]

function GroupHeader({
  group, text, currentUserId, onLeaveOrDelete, onShowMembers, onShowInfo, onShowOptions,
}: {
  group: GroupChat
  text: GroupText
  currentUserId: string
  onLeaveOrDelete: () => void
  onShowMembers: () => void
  onShowInfo: () => void
  onShowOptions: () => void
}) {
  const isOwner = group.ownerId === currentUserId
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {group.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-foreground">{group.name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {group.groupCode} • {group.members.length}/{group.maxMembers} {text.members} • {group.description || text.noDescription}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" title={text.members} onClick={onShowMembers}>
          <Users className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" title={text.groupInfo} onClick={onShowInfo}>
          <Info className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={isOwner ? "text-destructive hover:text-destructive" : ""}
          title={isOwner ? text.deleteGroup : text.leaveGroup}
          onClick={onLeaveOrDelete}
        >
          {isOwner ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" title={text.groupOptions} onClick={onShowOptions}>
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
  const imageCanPreview = Boolean(message.imageUrl && /^(https?:\/\/|\/)/.test(message.imageUrl))
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
          ) : message.messageType === "image" ? (
            <div className="w-72 max-w-full space-y-2">
              {imageCanPreview && (
                <img
                  src={message.imageUrl}
                  alt={message.imageName ?? text.sharedImage}
                  className="aspect-video w-full rounded-md border border-border object-cover"
                />
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{message.imageName ?? text.sharedImage}</p>
                <Button
                  type="button"
                  size="sm"
                  variant={isSelf ? "secondary" : "outline"}
                  className="h-8 shrink-0 gap-2"
                  disabled={!imageCanPreview}
                  onClick={() => message.imageUrl && window.open(message.imageUrl, "_blank", "noopener,noreferrer")}
                >
                  <Download className="h-3.5 w-3.5" />
                  {imageCanPreview ? text.download : text.previewUnavailable}
                </Button>
              </div>
              <p className={cn("text-xs", isSelf ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {text.imageMockNote}
              </p>
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
    groupsJoined: "nhóm đã tham gia",
    newGroup: "Tạo nhóm mới",
    search: "Tìm kiếm nhóm",
    groupId: "Group ID",
    sessionExpired: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    regenerate: "Tạo lại",
    leaveGroup: "Rời nhóm",
    deleteGroup: "Xóa nhóm",
    deleteConfirmTitle: "Xác nhận xóa nhóm",
    deleteConfirmBody: (name: string, code: string) => `Bạn có chắc muốn xóa nhóm "${name}" (${code})? Hành động này không thể hoàn tác.`,
    uploadImage: "Upload hình ảnh",
    imageUploaded: "Hình ảnh đã được upload vào chat nhóm.",
    imageUploadFailed: "Không thể upload hình ảnh.",
    documentUploaded: "Tài liệu đã được chia sẻ vào chat nhóm.",
    mockEmoji: "Mock: bảng emoji sẽ được triển khai sau.",
    memberList: "Danh sách thành viên",
    inviteMember: "Mời thành viên",
    inviteHint: "Nhập email tài khoản đã đăng ký để gửi lời mời đang chờ xử lý.",
    inviteEmailPlaceholder: "Email thành viên",
    inviteInvalidEmail: "Vui lòng nhập email hợp lệ.",
    inviteSearching: "Đang tìm người dùng...",
    inviteUserNotFound: "Không tìm thấy người dùng.",
    inviteSelf: "Bạn không thể tự mời chính mình.",
    inviteDuplicate: "Thành viên này đã tham gia hoặc đang có lời mời chờ xử lý.",
    inviteOwnerOnly: "Chỉ chủ nhóm mới có thể mời thành viên.",
    inviteButton: "Mời",
    inviteSent: "Đã gửi lời mời tham gia nhóm.",
    inviteFailed: "Không thể gửi lời mời.",
    joinedAt: "Tham gia",
    owner: "Chủ nhóm",
    member: "Thành viên",
    kickMember: "Xóa thành viên",
    kickConfirmTitle: "Xóa thành viên khỏi nhóm",
    kickConfirmBody: (member: string, group: string) => `Bạn có chắc muốn xóa "${member}" khỏi nhóm "${group}"?`,
    kickOwnerOnly: "Chỉ chủ nhóm mới có thể xóa thành viên.",
    kickSelf: "Chủ nhóm không thể tự xóa mình.",
    memberNotFound: "Không tìm thấy thành viên trong nhóm.",
    memberKicked: "Đã xóa thành viên khỏi nhóm.",
    kickFailed: "Không thể xóa thành viên.",
    groupInfo: "Thông tin nhóm",
    memberCount: "Số thành viên",
    createdAt: "Ngày tạo",
    groupInfoBackendNote: "Thành viên mới tham gia bằng lời mời và xác nhận trong thông báo.",
    groupOptions: "Tùy chọn nhóm",
    muteGroup: "Tắt thông báo nhóm",
    unmuteGroup: "Bật thông báo nhóm",
    pinGroup: "Ghim nhóm",
    unpinGroup: "Bỏ ghim nhóm",
    mutedSaved: "Đã tắt thông báo nhóm.",
    unmutedSaved: "Đã bật thông báo nhóm.",
    pinnedSaved: "Đã ghim nhóm.",
    unpinnedSaved: "Đã bỏ ghim nhóm.",
    exportChat: "Xuất lịch sử chat",
    reportGroup: "Báo cáo nhóm",
    optionMocked: (option: string) => `Mock: "${option}" đã được ghi nhận, backend sẽ triển khai sau.`,
    optionsBackendNote: "Ghim, tắt thông báo, xuất lịch sử và báo cáo nhóm đều gọi API nhóm.",
    exportStarted: "File lịch sử chat đang được tải xuống.",
    exportFailed: "Không thể xuất lịch sử chat.",
    reportHint: (name: string) => `Mô tả lý do bạn muốn báo cáo nhóm "${name}".`,
    reportPlaceholder: "Nhập lý do báo cáo...",
    submitReport: "Gửi báo cáo",
    reportSubmitted: "Đã gửi báo cáo nhóm.",
    reportFailed: "Không thể gửi báo cáo nhóm.",
    sharedImage: "Ảnh đã chia sẻ",
    imageMockNote: "Ảnh đã được gửi qua API nhóm. Bản xem trước chỉ hiển thị khi backend trả URL công khai.",
    noGroups: "Chưa có nhóm nào",
    loadingGroups: "Đang tải nhóm...",
    loadFailed: "Không thể tải danh sách nhóm.",
    retry: "Thử lại",
    loginTitle: "Đăng nhập để dùng chat nhóm",
    loginBody: "Chat nhóm cho phép trao đổi với bạn học và chia sẻ tài liệu công khai.",
    login: "Đăng nhập",
    createFailed: "Không thể tạo nhóm.",
    actionFailed: "Không thể thực hiện thao tác.",
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
    createHint: (created: number, joined: number) => `Gói hiện tại cho phép tạo tối đa ${created} nhóm và tham gia tối đa ${joined} nhóm.`,
    groupName: "Tên nhóm",
    description: "Mô tả",
    descriptionPlaceholder: "Mục tiêu học tập, môn học, hoặc ghi chú cho nhóm",
    cancel: "Hủy",
    create: "Tạo nhóm",
    download: "Tải xuống",
    downloadFailed: "Không thể tải tài liệu.",
    documentNotFound: "Tài liệu không tồn tại hoặc đã bị xóa.",
    documentNotPublic: "Tài liệu này không còn ở chế độ công khai.",
    documentNotReady: "Tài liệu chưa xử lý xong, vui lòng thử lại sau.",
    documentDeleted: "Tài liệu đã bị xóa.",
    groupAccessDenied: "Bạn không còn là thành viên của nhóm này.",
    previewUnavailable: "Chưa có URL",
    unavailable: "Không thể tải",
  },
  en: {
    title: "Group Chat",
    groupsCreated: "groups created",
    groupsJoined: "groups joined",
    newGroup: "Create group",
    search: "Search groups",
    groupId: "Group ID",
    sessionExpired: "Your session has expired. Please log in again.",
    regenerate: "Regenerate",
    leaveGroup: "Leave group",
    deleteGroup: "Delete group",
    deleteConfirmTitle: "Confirm group deletion",
    deleteConfirmBody: (name: string, code: string) => `Are you sure you want to delete "${name}" (${code})? This action cannot be undone.`,
    uploadImage: "Upload image",
    imageUploaded: "Image uploaded to the group chat.",
    imageUploadFailed: "Could not upload image.",
    documentUploaded: "Document shared to the group chat.",
    mockEmoji: "Mock: emoji picker will be implemented later.",
    memberList: "Member list",
    inviteMember: "Invite member",
    inviteHint: "Enter a registered account email to send a pending invitation.",
    inviteEmailPlaceholder: "Member email",
    inviteInvalidEmail: "Enter a valid email address.",
    inviteSearching: "Searching for user...",
    inviteUserNotFound: "User not found.",
    inviteSelf: "You cannot invite yourself.",
    inviteDuplicate: "This member has already joined or already has a pending invitation.",
    inviteOwnerOnly: "Only the group owner can invite members.",
    inviteButton: "Invite",
    inviteSent: "Group invitation sent.",
    inviteFailed: "Could not send the group invitation.",
    joinedAt: "Joined",
    owner: "Owner",
    member: "Member",
    kickMember: "Remove member",
    kickConfirmTitle: "Remove member from group",
    kickConfirmBody: (member: string, group: string) => `Are you sure you want to remove "${member}" from "${group}"?`,
    kickOwnerOnly: "Only the group owner can remove members.",
    kickSelf: "The group owner cannot remove themselves.",
    memberNotFound: "That member is no longer in the group.",
    memberKicked: "Member removed from the group.",
    kickFailed: "Could not remove the member.",
    groupInfo: "Group info",
    memberCount: "Member count",
    createdAt: "Created at",
    groupInfoBackendNote: "New members join through invitations and confirm them from notifications.",
    groupOptions: "Group options",
    muteGroup: "Mute group notifications",
    unmuteGroup: "Unmute group notifications",
    pinGroup: "Pin group",
    unpinGroup: "Unpin group",
    mutedSaved: "Group notifications muted.",
    unmutedSaved: "Group notifications unmuted.",
    pinnedSaved: "Group pinned.",
    unpinnedSaved: "Group unpinned.",
    exportChat: "Export chat history",
    reportGroup: "Report group",
    optionMocked: (option: string) => `Mock: "${option}" has been recorded; backend will implement it later.`,
    optionsBackendNote: "Mute, pin, export chat history, and report group all call group APIs.",
    exportStarted: "Chat history download started.",
    exportFailed: "Could not export chat history.",
    reportHint: (name: string) => `Describe why you want to report "${name}".`,
    reportPlaceholder: "Enter report reason...",
    submitReport: "Submit report",
    reportSubmitted: "Group report submitted.",
    reportFailed: "Could not report group.",
    sharedImage: "Shared image",
    imageMockNote: "Image was sent through the group API. Preview appears only when backend returns a public URL.",
    noGroups: "No groups yet",
    loadingGroups: "Loading groups...",
    loadFailed: "Could not load groups.",
    retry: "Retry",
    loginTitle: "Log in to use group chat",
    loginBody: "Group chat lets students discuss together and share public study documents.",
    login: "Log in",
    createFailed: "Could not create group.",
    actionFailed: "Could not complete this action.",
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
    createHint: (created: number, joined: number) => `Your current package allows up to ${created} created groups and ${joined} joined groups.`,
    groupName: "Group name",
    description: "Description",
    descriptionPlaceholder: "Study goal, subject, or note for this group",
    cancel: "Cancel",
    create: "Create group",
    download: "Download",
    downloadFailed: "Could not download document.",
    documentNotFound: "The document does not exist or has been deleted.",
    documentNotPublic: "This document is no longer public.",
    documentNotReady: "The document is still being processed. Please try again later.",
    documentDeleted: "This document has been deleted.",
    groupAccessDenied: "You are no longer a member of this group.",
    previewUnavailable: "No URL yet",
    unavailable: "Unavailable",
  },
} as const
