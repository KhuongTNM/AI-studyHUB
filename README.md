# AI Study Hub

AI Study Hub la he thong quan ly tai lieu hoc tap co AI ho tro hoi dap, duoc tach thanh frontend React/Next.js + TypeScript va backend Java Spring Boot.

## Cau truc

```text
AI-studyHUB/
  IMPLEMENTATION_PLAN.md
  README.md
  database/
    ai_study_hub_schema_mssql.sql
  frontend/
    app/
    components/
    hooks/
    lib/
    public/
    styles/
    package.json
  backend/
    src/main/java/com/aistudyhub/backend/
      AiStudyHubBackendApplication.java
      config/DatabaseConfig.java
      model/User.java
    src/main/resources/application.properties
    pom.xml
```

## Frontend

Frontend hien tai giu lai view/design goc cua prototype bang Next.js, React va TypeScript. Sidebar, header, modal, dashboard va cac man hinh trong prototype duoc giu nguyen de nhom co the noi API backend sau.

Frontend chua ket noi database truc tiep. Cac thao tac dang nhap, upload, chat, room va admin trong prototype chi la state/mock phuc vu hien thi UI; logic that se duoc chuyen sang backend Spring Boot khi phat trien API.

Man hinh da phan anh cac module:

- Authentication
- Document Management
- Cloud Storage
- AI Chatbot
- Flashcard
- Study Room
- Profile/Admin overview
- Trash va Activity Log

Chay frontend:

```bash
cd frontend
npm install
npm run dev
```

Build frontend:

```bash
cd frontend
npm run build
```

## Backend

Backend la Spring Boot skeleton de nhom tiep tuc phat trien API.

File object/entity mau:

```text
backend/src/main/java/com/aistudyhub/backend/model/User.java
```

File ket noi database:

```text
backend/src/main/java/com/aistudyhub/backend/config/DatabaseConfig.java
```

Chay backend:

```bash
cd backend
mvn spring-boot:run
```

Mac dinh backend doc cau hinh SQL Server tu bien moi truong:

```text
DB_URL
DB_USERNAME
DB_PASSWORD
```

Neu khong co bien moi truong, file `application.properties` se dung gia tri mau:

```text
jdbc:sqlserver://localhost:1433;databaseName=AIStudyHub;encrypt=true;trustServerCertificate=true
sa
YourStrongPassword123
```

## Database

Schema MSSQL nam tai:

```text
database/ai_study_hub_schema_mssql.sql
```

Co the chay file nay bang SQL Server Management Studio hoac Azure Data Studio de tao database `AIStudyHub`.

## Business Rules Mapping

Nguon business rules: `AI-Study-Hub-Business-Rules-Group07 (1).docx`.

- BR-001 -> BR-012: Authentication, validation email/password, role mac dinh, login attempts, locked account.
- BR-013 -> BR-026: Document Management, file type PDF/DOCX/PPTX, subject bat buoc, status upload, public/private, soft delete.
- BR-027 -> BR-031: Cloud Storage, storage limit, storage used, canh bao tren 80%, preview.
- BR-032 -> BR-037: AI Chatbot, logged-in user, chat session, document context, Markdown render.
- BR-038 -> BR-042: Flashcard, tao tu tai lieu hoac thu cong, trang thai hoc tap.
- BR-043 -> BR-051: Study Room, subscription-based create room, capacity, room chat.
- BR-052 -> BR-057: Profile va Settings, display name, password, dark mode, language, upgrade plan.
- BR-058 -> BR-070: Admin/Sub-admin, user management, lock/reset/delete, subscription, storage limit, activity log.

## Ghi chu hien tai

- Frontend giu thiet ke prototype goc, khong phai ban redesign moi.
- Frontend chua co API/database integration that; cac service/controller se duoc noi voi backend o giai do tiep theo.
- Backend moi co skeleton, entity `User` va database config.
- Cac API controller/service/repository se duoc bo sung o giai do tiep theo.
