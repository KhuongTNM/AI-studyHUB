# Group Chat Backend API Needed

Frontend status: implemented with mocked local state. Replace the mocked calls in `frontend/src/hooks/useGroupChatState.ts` when these APIs are ready.

Room status: the old study room feature is being removed, not kept. Group Chat replaces it completely.

## Business Rules Needed

- **BR-GC-001 - Group chat is separate from AI Chatbot.** Users create and open study groups from the Group Chat page/sidebar, not from the AI Chatbot toolbar.
- **BR-GC-002 - Group creation requires active study group subscription.** Free users cannot create groups. Users on `2-4` can create up to 4 groups. Users on `5+`, Admin, and Sub-admin can create up to 99 groups.
- **BR-GC-003 - Group member capacity follows creator package.** `2-4` groups allow up to 4 members. `5+`, Admin, and Sub-admin groups allow up to 99 members.
- **BR-GC-004 - Group chat supports public document sharing.** Only documents with visibility `public` can be shared to a group. Private documents must be disabled/unavailable.
- **BR-GC-005 - Shared private/changed-private files are not downloadable.** If a shared document later becomes private, show it greyed out and block download.

## Data Model

## Remove Old Room Backend

Drop or remove these old room artifacts after migrating any useful data:

- Tables:
  - `study_rooms`
  - `study_room_members`
  - `study_room_messages`
- Java/backend layer:
  - `StudyRoomController`
  - `StudyRoomService`
  - `StudyRoomRepository`
  - old `StudyRoom`, `StudyRoomMember`, `StudyRoomMessage` entities/DTOs
- API routes:
  - `GET /api/study-rooms`
  - `POST /api/study-rooms`
  - `GET /api/study-rooms/{roomCode}`
  - `POST /api/study-rooms/{roomCode}/join`
  - `POST /api/study-rooms/{roomCode}/leave`
  - `POST /api/study-rooms/{roomCode}/messages`
  - `POST /api/study-rooms/{roomCode}/share-document`

If database data must be preserved, migrate room records into the new group tables first:

- `study_rooms` -> `groups`
- `study_room_members` -> `group_members`
- `study_room_messages` -> `group_messages`

If no old room data is needed, drop the old tables directly after the new group tables and APIs are ready.

### `groups`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uniqueidentifier | Primary key |
| `name` | nvarchar(120) | Required |
| `description` | nvarchar(500) | Optional |
| `owner_id` | uniqueidentifier | FK to `users.id` |
| `max_members` | int | Derived from owner's active package |
| `created_at` | datetime2 | Required |
| `updated_at` | datetime2 | Required |

### `group_members`

| Column | Type | Notes |
| --- | --- | --- |
| `group_id` | uniqueidentifier | FK to `groups.id` |
| `user_id` | uniqueidentifier | FK to `users.id` |
| `role` | varchar(20) | `owner` or `member` |
| `joined_at` | datetime2 | Required |

Unique constraint: `(group_id, user_id)`.

### `group_messages`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uniqueidentifier | Primary key |
| `group_id` | uniqueidentifier | FK to `groups.id` |
| `sender_id` | uniqueidentifier null | Null/system for system messages |
| `content` | nvarchar(max) | Text body or document label |
| `message_type` | varchar(20) | `text`, `document`, `system` |
| `document_id` | uniqueidentifier null | FK to documents when `document` |
| `created_at` | datetime2 | Required |

## API Endpoints

All endpoints require `Authorization: Bearer <token>`.

### List My Groups

`GET /api/groups`

Returns groups where the current user is a member.

Response:

```json
[
  {
    "id": "group-id",
    "name": "SWP391 Team",
    "description": "Assignment discussion",
    "ownerId": "user-id",
    "ownerName": "Hung Nguyen",
    "maxMembers": 4,
    "members": [],
    "messages": [],
    "createdAt": "2026-06-18T13:00:00Z",
    "updatedAt": "2026-06-18T13:00:00Z"
  }
]
```

### Create Group

`POST /api/groups`

Request:

```json
{
  "name": "SWP391 Team",
  "description": "Assignment discussion"
}
```

Backend must:

- Check active package.
- Check created group count limit.
- Set `maxMembers` from package.
- Add creator into `group_members` as `owner`.

### Get Group Detail

`GET /api/groups/{groupId}`

Returns one group with members and recent messages.

### Send Group Message

`POST /api/groups/{groupId}/messages`

Request:

```json
{
  "content": "Can someone review this document?"
}
```

Response: created message or refreshed group detail.

### Share Document To Group

`POST /api/groups/{groupId}/documents`

Request:

```json
{
  "documentId": "document-id"
}
```

Backend must reject private documents. For document messages, response should include:

```json
{
  "messageType": "document",
  "documentId": "document-id",
  "documentName": "Lab2.pdf",
  "documentSubject": "Programming",
  "documentVisibility": "public",
  "documentDownloadable": true
}
```

### Download Shared Group Document

`GET /api/groups/{groupId}/documents/{documentId}/download`

Backend must:

- Confirm requester is a group member.
- Confirm document is still public.
- Reject if document is private/deleted.
- Stream the file.

### Add Member

`POST /api/groups/{groupId}/members`

Request:

```json
{
  "email": "classmate@example.com"
}
```

Backend must enforce `maxMembers`.

### Leave Group

`DELETE /api/groups/{groupId}/members/me`

Owner behavior should be decided by team: either block owner leaving until ownership transfer, or close the group.
