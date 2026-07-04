"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import {
  AlertCircle, Download, FileText, Image, Info, LogOut, MessageCircle,
  MoreHorizontal, Paperclip, Plus, Search, Send, Smile, Trash2, Users, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, type Document, type GroupChat, type GroupChatMessage } from "@/lib/store"

export function GroupChatPage() {
  const {
    currentUser, openAuthModal, language, documents, downloadDocument,
    groups, activeGroupId, groupCreateLimit, groupJoinLimit,
    setActiveGroupId, createGroup, joinGroup, leaveGroup, deleteGroup,
    updateGroupMuted, updateGroupPinned,
    sendGroupMessage, shareGroupDocument, shareGroupImage, generateGroupCode,
  } = useApp()

  const text = groupText[language]
  const [search, setSearch] = useState("")
  const [message, setMessage] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showFileShare, setShowFileShare] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDesc, setNewGroupDesc] = useState("")
  const [newGroupCode, setNewGroupCode] = useState(generateGroupCode)
  const [newGroupPassword, setNewGroupPassword] = useState("")
  const [joinGroupCode, setJoinGroupCode] = useState("")
  const [joinGroupPassword, setJoinGroupPassword] = useState("")
  const [error, setError] = useState("")
  const [mockNotice, setMockNotice] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [groupActionBusy, setGroupActionBusy] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeGroup = groups.find(group => group.id === activeGroupId) ?? groups[0] ?? null
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeGroup?.messages.length])

  const handleCreateGroup = async () => {
    setGroupActionBusy(true)
    const result = await createGroup(newGroupName, newGroupDesc, newGroupPassword, newGroupCode)
    setGroupActionBusy(false)
    if (!result.success) {
      setError(result.error ?? text.createFailed)
      return
    }
    setError("")
    setNewGroupName("")
    setNewGroupDesc("")
    setNewGroupPassword("")
    setNewGroupCode(generateGroupCode())
    setShowCreate(false)
  }

  const handleJoinGroup = async () => {
    setGroupActionBusy(true)
    const result = await joinGroup(joinGroupCode, joinGroupPassword)
    setGroupActionBusy(false)
    if (!result.success) {
      setError(result.error ?? text.joinFailed)
      return
    }
    setError("")
    setJoinGroupCode("")
    setJoinGroupPassword("")
    setShowJoin(false)
  }

  const handleLeaveOrDelete = async () => {
    if (!activeGroup || !currentUser) return
    if (activeGroup.ownerId === currentUser.id) {
      setDeletePassword("")
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
    const result = await deleteGroup(activeGroup.id, deletePassword)
    setGroupActionBusy(false)
    if (!result.success) {
      setError(result.error ?? text.actionFailed)
      return
    }
    setError("")
    setDeletePassword("")
    setShowDeleteConfirm(false)
  }

  const showMockNotice = (notice: string) => {
    setMockNotice(notice)
    setError("")
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
    showMockNotice(text.documentUploaded)
    setSelectedDocumentId("")
    setShowFileShare(false)
  }

  const handleImageUpload = () => {
    if (!activeGroup) return
    const result = shareGroupImage(activeGroup.id)
    if (!result.success) {
      setError(result.error ?? text.imageUploadFailed)
      return
    }
    setError("")
    showMockNotice(text.imageUploaded)
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
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full justify-center"
            disabled={joinedGroupCount >= groupJoinLimit}
            onClick={() => {
              setError("")
              setShowJoin(true)
            }}
          >
            <Users className="mr-2 h-4 w-4" />
            {text.joinGroup}
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">{text.joinHint(groupJoinLimit)}</p>
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
                <Button variant="ghost" size="icon" title={text.uploadImage} onClick={handleImageUpload}>
                  <Image className="h-4 w-4" />
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
                <Button variant="ghost" size="icon" title={text.mockEmoji} onClick={() => showMockNotice(text.mockEmoji)}>
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
              <Button className="mt-5" disabled={groupCreateLimit <= 0 || joinedGroupCount >= groupJoinLimit} onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {text.newGroup}
              </Button>
            </div>
          </div>
        )}
      </section>

      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{text.joinGroup}</h2>
                <p className="text-sm text-muted-foreground">{text.joinHint(groupJoinLimit)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowJoin(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <input
                value={joinGroupCode}
                onChange={event => setJoinGroupCode(event.target.value.toUpperCase())}
                placeholder={text.groupId}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <input
                value={joinGroupPassword}
                onChange={event => setJoinGroupPassword(event.target.value)}
                placeholder={text.password}
                type="password"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <Button type="button" className="w-full" disabled={joinedGroupCount >= groupJoinLimit || groupActionBusy} onClick={handleJoinGroup}>
                {text.join}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showMembers && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{text.memberList}</h2>
                <p className="text-sm text-muted-foreground">{activeGroup.members.length}/{activeGroup.maxMembers} {text.members}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowMembers(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
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
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showInfo && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{text.groupInfo}</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowInfo(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 text-sm">
              <InfoRow label={text.groupName} value={activeGroup.name} />
              <InfoRow label={text.groupId} value={activeGroup.groupCode} />
              <InfoRow label={text.password} value={text.passwordProtected} />
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
              {[text.exportChat, text.reportGroup].map(option => (
                <Button key={option} type="button" variant="outline" className="w-full justify-start" onClick={() => showMockNotice(text.optionMocked(option))}>
                  {option}
                </Button>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{text.optionsBackendNote}</p>
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
              <span className="mb-1 block text-sm font-medium text-foreground">{text.password}</span>
              <input
                value={newGroupPassword}
                onChange={event => setNewGroupPassword(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                placeholder={text.passwordPlaceholder}
                type="password"
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
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-foreground">{text.password}</span>
              <input
                value={deletePassword}
                onChange={event => setDeletePassword(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                placeholder={text.deletePasswordPlaceholder}
                type="password"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>{text.cancel}</Button>
              <Button variant="destructive" onClick={handleConfirmDelete} disabled={groupActionBusy || !deletePassword.trim()}>{text.deleteGroup}</Button>
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

function InfoRow({ label, value }: { label: string; value: string }) {
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
              {message.imageUrl && (
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
                  onClick={() => message.imageUrl && window.open(message.imageUrl, "_blank", "noopener,noreferrer")}
                >
                  <Download className="h-3.5 w-3.5" />
                  {text.download}
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
    joinGroup: "Tham gia nhóm",
    join: "Tham gia",
    joinHint: (groups: number) => `Bạn có thể tham gia tối đa ${groups} nhóm, tính cả nhóm tự tạo.`,
    groupId: "Group ID",
    password: "Mật khẩu nhóm",
    passwordPlaceholder: "Nhập mật khẩu để bạn học tham gia",
    passwordProtected: "Được bảo vệ bởi backend",
    regenerate: "Tạo lại",
    leaveGroup: "Rời nhóm",
    deleteGroup: "Xóa nhóm",
    deleteConfirmTitle: "Xác nhận xóa nhóm",
    deleteConfirmBody: (name: string, code: string) => `Nhập mật khẩu nhóm để xóa "${name}" (${code}). Backend sẽ xác thực mật khẩu trước khi xóa.`,
    deletePasswordPlaceholder: "Nhập mật khẩu nhóm",
    deletePasswordWrong: "Mật khẩu nhóm không đúng.",
    uploadImage: "Upload hình ảnh",
    imageUploaded: "Mock: hình ảnh đã được upload vào chat nhóm.",
    imageUploadFailed: "Không thể upload hình ảnh.",
    documentUploaded: "Mock: tài liệu đã được chia sẻ vào chat nhóm.",
    mockEmoji: "Mock: bảng emoji sẽ được triển khai sau.",
    memberList: "Danh sách thành viên",
    joinedAt: "Tham gia",
    owner: "Chủ nhóm",
    member: "Thành viên",
    groupInfo: "Thông tin nhóm",
    memberCount: "Số thành viên",
    createdAt: "Ngày tạo",
    groupInfoBackendNote: "Mật khẩu nhóm không được hiển thị. Backend chỉ lưu password_hash và xác thực khi tham gia hoặc xóa nhóm.",
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
    optionsBackendNote: "Ghim và tắt thông báo đã gọi API nhóm. Xuất lịch sử chat và báo cáo nhóm vẫn là luồng mô phỏng cho task sau.",
    sharedImage: "Ảnh đã chia sẻ",
    imageMockNote: "Ảnh mock được tạo trên frontend. Backend sau này sẽ upload file và trả URL thật.",
    noGroups: "Chưa có nhóm nào",
    loginTitle: "Đăng nhập để dùng chat nhóm",
    loginBody: "Chat nhóm cho phép trao đổi với bạn học và chia sẻ tài liệu công khai.",
    login: "Đăng nhập",
    createFailed: "Không thể tạo nhóm.",
    joinFailed: "Không thể tham gia nhóm.",
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
    unavailable: "Không thể tải",
  },
  en: {
    title: "Group Chat",
    groupsCreated: "groups created",
    groupsJoined: "groups joined",
    newGroup: "Create group",
    search: "Search groups",
    joinGroup: "Join group",
    join: "Join",
    joinHint: (groups: number) => `You can join up to ${groups} groups, including groups you created.`,
    groupId: "Group ID",
    password: "Group password",
    passwordPlaceholder: "Enter the password classmates will use to join",
    passwordProtected: "Protected by backend",
    regenerate: "Regenerate",
    leaveGroup: "Leave group",
    deleteGroup: "Delete group",
    deleteConfirmTitle: "Confirm group deletion",
    deleteConfirmBody: (name: string, code: string) => `Enter the group password to delete "${name}" (${code}). The backend will verify the password before deletion.`,
    deletePasswordPlaceholder: "Enter group password",
    deletePasswordWrong: "Group password is incorrect.",
    uploadImage: "Upload image",
    imageUploaded: "Mock: image uploaded to the group chat.",
    imageUploadFailed: "Could not upload image.",
    documentUploaded: "Mock: document shared to the group chat.",
    mockEmoji: "Mock: emoji picker will be implemented later.",
    memberList: "Member list",
    joinedAt: "Joined",
    owner: "Owner",
    member: "Member",
    groupInfo: "Group info",
    memberCount: "Member count",
    createdAt: "Created at",
    groupInfoBackendNote: "The group password is never displayed. Backend stores only password_hash and verifies it for join/delete actions.",
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
    optionsBackendNote: "Mute and pin call the group API. Export chat and report group remain mocked for a later task.",
    sharedImage: "Shared image",
    imageMockNote: "Mock image generated in frontend. Backend will later upload the file and return a real URL.",
    noGroups: "No groups yet",
    loginTitle: "Log in to use group chat",
    loginBody: "Group chat lets students discuss together and share public study documents.",
    login: "Log in",
    createFailed: "Could not create group.",
    joinFailed: "Could not join group.",
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
    unavailable: "Unavailable",
  },
} as const
