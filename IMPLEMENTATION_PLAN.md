# AI Study Hub - Implementation Plan

## 1. Muc tieu

Chuyen prototype hien co thanh cau truc du an ro rang gom:

- `frontend/`: React + TypeScript, chi giu phan giao dien/view.
- `backend/`: Java Spring Boot skeleton, san sang ket noi Microsoft SQL Server.
- `database/`: luu schema MSSQL da duoc cung cap.
- `README.md`: huong dan cau truc, cach chay va mapping nghiep vu chinh.

Du an moi duoc dat tai:

`E:\Education\Lab\SWP391\AI-studyHUB`

Va se duoc dua len GitHub repository:

`https://github.com/KhuongTNM/AI-studyHUB.git`

## 2. Nguon dau vao

- Chu de: `C:\Users\ASUS\Downloads\AI-studyHUB.md`
- Business rules: `C:\Users\ASUS\Downloads\AI-Study-Hub-Business-Rules-Group07 (1).docx`
- Prototype: `E:\test\final\AI-github-Prototype.zip` va thu muc da giai nen `E:\test\final\AI-github-Prototype`
- Database schema: `E:\test\final\ai_study_hub_schema_mssql.sql`

## 3. Nghiep vu can phan anh

Du an se duoc to chuc theo cac module cua AI Study Hub:

- Authentication: dang ky, dang nhap, quen mat khau, profile.
- Document Management: upload, danh sach tai lieu, preview, tim kiem, trash, duyet chia se.
- Cloud Storage: dung luong user, canh bao tren 80%, preview file.
- AI Chatbot: chat theo tai lieu hoac kien thuc chung, chat history.
- Flashcard: tao/xem the ghi nho theo tai lieu.
- Study Room: phong hoc nhom theo subscription plan.
- Admin/Sub-admin: quan ly user, khoa/mo khoa, reset password, subscription, activity log.

## 4. Ke hoach frontend

1. Tao `frontend/` bang React + TypeScript theo huong Vite.
2. Lay y tuong giao dien tu prototype, nhung bo logic nghiep vu/mock action cu.
3. Tao view-only UI:
   - Sidebar/navigation.
   - Header.
   - Dashboard/Home overview.
   - Auth forms dang view.
   - Document manager view.
   - Cloud storage view.
   - AI chat view.
   - Flashcard view.
   - Study room view.
   - Profile view.
   - Admin dashboard view.
4. Du lieu hien thi la static fixture trong component de minh hoa layout, khong xu ly dang nhap/upload/chat that.
5. Khong goi API that trong giai do nay; de san `src/api/README.md` hoac comment endpoint sau khi backend day du hon neu can.

## 5. Ke hoach backend

Backend se dung Spring Boot theo cau truc layer ro rang:

```text
backend/src/main/java/com/aistudyhub/backend/
  AiStudyHubBackendApplication.java
  config/       cau hinh he thong: Security, CORS, Beans, Database
  entity/       map voi bang database bang JPA Entity
  repository/   truy van database bang Spring Data JPA
  dto/          object van chuyen du lieu request/response
  service/      xu ly logic nghiep vu va goi repository
  controller/   nhan HTTP request va tra JSON response
```

Nguyen tac trien khai:

1. Tao `backend/` Spring Boot Maven project voi Java 17.
2. Moi bang database can co entity rieng trong `entity/`.
   - Vi du hien tai: `src/main/java/com/aistudyhub/backend/entity/User.java`
   - Entity chi phu trach mapping voi database, khong viet logic HTTP.
3. Moi entity/module can co repository trong `repository/`.
   - Vi du du kien: `UserRepository extends JpaRepository<User, UUID>`.
   - Repository chi phu trach truy van database.
4. Request/response khong tra truc tiep entity neu khong can thiet.
   - Tao DTO trong `dto/`, vi du `LoginRequest`, `RegisterRequest`, `UserResponse`.
5. Logic nghiep vu dat trong `service/`.
   - Vi du: validate dang ky, hash password, kiem tra locked account, tinh storage.
6. API endpoint dat trong `controller/`.
   - Controller chi nhan request, validate DTO, goi service va tra JSON.
7. Cau hinh he thong dat trong `config/`.
   - `DatabaseConfig.java` da doc database config tu environment/properties.
   - Cac cau hinh sau se them tai day: CORS, Security/JWT, PasswordEncoder, OpenAPI.
8. Tao `application.properties` mau cho SQL Server.
9. Them `pom.xml` voi Spring Boot Web, Data JPA, Validation, SQL Server JDBC driver.

Thu tu phat trien API uu tien:

1. Authentication: register, login, logout/token, profile.
2. Document Management: upload metadata, list, search, soft delete.
3. Cloud Storage: storage used/limit, warning tren 80%.
4. AI Chatbot: chat session, chat message, document context.
5. Flashcard: CRUD flashcard va status hoc tap.
6. Study Room: room, member, chat.
7. Admin/Sub-admin: user management, lock/reset/delete, activity log.

## 6. Ke hoach database

1. Tao `database/`.
2. Copy `ai_study_hub_schema_mssql.sql` vao `database/ai_study_hub_schema_mssql.sql`.
3. README se huong dan chay schema bang SQL Server Management Studio/Azure Data Studio.

## 7. Ke hoach README

README goc se gom:

- Tong quan AI Study Hub.
- Cau truc thu muc.
- Cach chay frontend.
- Cach chay backend.
- Cach cau hinh SQL Server.
- Mapping business rules voi module.
- Ghi chu: frontend hien tai la view-only, backend la skeleton ket noi database.

## 8. Ke hoach GitHub

1. Khoi tao git repo trong `E:\Education\Lab\SWP391\AI-studyHUB` neu chua co.
2. Them remote `origin` tro den `https://github.com/KhuongTNM/AI-studyHUB.git`.
3. Stage, commit cac file da tao.
4. Push len branch mac dinh, uu tien `main`.

## 9. Tieu chi hoan thanh

- Co file `IMPLEMENTATION_PLAN.md` truoc khi bat dau trien khai.
- Co cau truc `frontend/`, `backend/`, `database/`.
- Frontend build duoc ve mat TypeScript/project structure.
- Backend co Maven project, package layer `config/entity/repository/dto/service/controller`, entity mau va database config.
- README ro rang de thanh vien nhom tiep tuc phat trien.
- Du an nam trong `E:\Education\Lab\SWP391\AI-studyHUB`.
- Neu GitHub authentication/network cho phep, du an duoc push len repository yeu cau.
