# AI Study Hub

AI Study Hub là hệ thống quản lý tài liệu học tập có AI hỗ trợ hỏi đáp, được tách thành **frontend** (Next.js + TypeScript) và **backend** (Java Spring Boot).

Repository: [https://github.com/KhuongTNM/AI-studyHUB](https://github.com/KhuongTNM/AI-studyHUB)

## Cấu trúc dự án

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
      api/auth.ts          # Gọi API đăng nhập / đăng ký / đăng xuất
      auth-storage.ts      # Lưu JWT (localStorage)
    public/
    styles/
    .env.local.example     # Mẫu cấu hình URL backend
    package.json
  backend/
    src/main/java/com/aistudyhub/backend/
      AiStudyHubBackendApplication.java
      config/              # Database, Security, CORS, seed dữ liệu demo
      entity/
      repository/
      dto/
      service/
      controller/
      security/
    src/main/resources/application.properties
    pom.xml
```

## Chuẩn bị công cụ

Cài đặt và kiểm tra trước khi chạy dự án:

| Công cụ | Phiên bản gợi ý | Dùng cho |
|---------|-----------------|----------|
| [Java JDK](https://adoptium.net/) | 17+ | Backend Spring Boot |
| [Apache Maven](https://maven.apache.org/download.cgi) | 3.9+ | Build/chạy backend (`mvn`) |
| [Node.js](https://nodejs.org/) | 18+ (LTS) | Frontend Next.js |
| npm | đi kèm Node.js | Cài dependency frontend |
| [SQL Server](https://www.microsoft.com/sql-server) | 2019+ hoặc Express | Database `AIStudyHub` |
| SSMS hoặc Azure Data Studio | mới nhất | Chạy script schema |

Kiểm tra nhanh trong terminal:

```bash
java -version
mvn -version
node -v
npm -v
```

**Lưu ý:** Nếu gặp lỗi `'mvn' is not recognized`, cần cài Maven và thêm thư mục `bin` vào biến môi trường `PATH`, hoặc chạy backend từ IDE (Run class `AiStudyHubBackendApplication`).

## Cấu hình database

### 1. Tạo schema (bắt buộc trước khi chạy backend)

Chạy file SQL trong SQL Server Management Studio hoặc Azure Data Studio:

```text
database/ai_study_hub_schema_mssql.sql
```

Script tạo database **`AIStudyHub`** và các bảng (users, documents, subscription_plans, …).

### 2. Cấu hình kết nối backend → SQL Server

Backend đọc thông tin kết nối theo thứ tự ưu tiên: **biến môi trường** → giá trị mặc định trong file properties.

| Vị trí | Mô tả |
|--------|--------|
| `backend/src/main/resources/application.properties` | File cấu hình chính (mặc định khi dev local) |
| `backend/src/main/java/com/aistudyhub/backend/config/DatabaseConfig.java` | Đọc `app.datasource.*` và tạo `DataSource` (HikariCP) |
| Biến môi trường `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | Ghi đè properties khi deploy / CI |

Các khóa trong `application.properties`:

```properties
app.datasource.url=${DB_URL:jdbc:sqlserver://localhost:1433;databaseName=AIStudyHub;encrypt=true;trustServerCertificate=true}
app.datasource.username=${DB_USERNAME:sa}
app.datasource.password=${DB_PASSWORD:YourStrongPassword123}
```

**Ví dụ đặt biến môi trường (Windows PowerShell):**

```powershell
$env:DB_URL="jdbc:sqlserver://localhost:1433;databaseName=AIStudyHub;encrypt=true;trustServerCertificate=true"
$env:DB_USERNAME="sa"
$env:DB_PASSWORD="MatKhauCuaBan"
```

**Ví dụ đặt biến môi trường (Linux/macOS):**

```bash
export DB_URL="jdbc:sqlserver://localhost:1433;databaseName=AIStudyHub;encrypt=true;trustServerCertificate=true"
export DB_USERNAME="sa"
export DB_PASSWORD="MatKhauCuaBan"
```

Cấu hình JWT và CORS (cùng file `application.properties`):

```properties
app.jwt.secret=${JWT_SECRET:AIStudyHubDevSecretKeyMustBeAtLeast32CharactersLong}
app.jwt.expiration-ms=${JWT_EXPIRATION_MS:86400000}
app.cors.allowed-origins=${CORS_ORIGINS:http://localhost:3000}
```

### 3. Cấu hình frontend → backend API

| Vị trí | Mô tả |
|--------|--------|
| `frontend/.env.local` | File local (không commit secret); copy từ `.env.local.example` |
| `frontend/.env.local.example` | Mẫu: `NEXT_PUBLIC_API_URL=http://localhost:8080` |
| `frontend/lib/api/auth.ts` | Đọc `process.env.NEXT_PUBLIC_API_URL` |

Tạo file `frontend/.env.local`:

```text
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Chạy dự án (thứ tự)

### Quick Start (Windows)

**Chạy backend:**
```bash
cd backend
mvn spring-boot:run
```

Hoặc dùng PowerShell:
```powershell
cd backend
.\run-backend.ps1
```

**Chạy frontend (terminal mới):**
```bash
cd frontend
npm install
npm run dev
```

Mở trình duyệt: **http://localhost:3000** (Backend: **http://localhost:8080**)

---

### Chi tiết từng bước

#### Bước 1 — Database

1. Bật SQL Server.
2. Chạy `database/ai_study_hub_schema_mssql.sql` trong SQL Server Management Studio hoặc Azure Data Studio.
3. Đảm bảo username/password khớp với file `backend/src/main/resources/application.properties`.

#### Bước 2 — Backend (cổng 8080)

**Windows (cmd):**
```bash
cd backend
run-backend.bat
```

**Windows (PowerShell):**
```powershell
cd backend
.\run-backend.ps1
```

**macOS/Linux:**
```bash
cd backend
mvn spring-boot:run
```

Backend chạy tại: **http://localhost:8080**

**Tài khoản demo (auto-seed khi bảng `users` trống):**

| Email | Mật khẩu | Vai trò |
|-------|-----------|---------|
| `admin@aistudyhub.com` | `Admin123` | admin |
| `student@aistudyhub.com` | `Student123` | user |
| `subadmin@aistudyhub.com` | `SubAdmin123` | sub_admin |

#### Bước 3 — Frontend (cổng 3000)

Mở **terminal mới** (backend vẫn chạy):

```bash
cd frontend
npm install
cp .env.local.example .env.local   # Windows: copy .env.local.example .env.local
npm run dev
```

Frontend chạy tại: **http://localhost:3000**

**Build production:**
```bash
npm run build
```

## API Authentication (đã triển khai)

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| `POST` | `/api/auth/register` | Đăng ký (tự đăng nhập, trả JWT) |
| `POST` | `/api/auth/login` | Đăng nhập |
| `POST` | `/api/auth/logout` | Đăng xuất (cần header `Authorization: Bearer <token>`) |
| `GET` | `/api/auth/me` | Lấy thông tin user hiện tại |

Frontend đã nối **đăng nhập, đăng ký, đăng xuất** qua API. Các module khác (tài liệu, chat, room, …) vẫn dùng mock/state trên UI cho đến khi backend bổ sung API tương ứng.

## Backend — cấu trúc layer

```text
HTTP Request  -> Controller -> Service -> Repository -> Entity/Database
HTTP Response <- Controller <- Service <- Repository <- Entity/Database
```

| Package | Trách nhiệm |
|---------|----------------|
| `config/` | Database, Security/JWT, CORS, seed dữ liệu |
| `entity/` | JPA mapping bảng DB |
| `repository/` | Truy vấn Spring Data JPA |
| `dto/` | Request/Response (LoginRequest, RegisterRequest, …) |
| `service/` | Logic nghiệp vụ, validation |
| `controller/` | REST API |
| `security/` | JWT filter, principal |

Quy tắc: không đặt logic nghiệp vụ trong `controller`; frontend **không** gọi database trực tiếp.

## Business Rules Mapping

Nguồn: `AI-Study-Hub-Business-Rules-Group07 (1).docx`.

- **BR-001 → BR-012:** Authentication (email, password, role, login attempts, khóa tài khoản)
- **BR-013 → BR-026:** Document Management
- **BR-027 → BR-031:** Cloud Storage
- **BR-032 → BR-037:** AI Chatbot
- **BR-038 → BR-042:** Flashcard
- **BR-043 → BR-051:** Study Room
- **BR-052 → BR-057:** Profile & Settings
- **BR-058 → BR-070:** Admin / Sub-admin

## Ghi chú hiện tại

- Frontend giữ thiết kế prototype gốc (Next.js).
- **Authentication** (login, register, logout, `/me`) đã nối backend + JWT.
- Document, Cloud, Chatbot, Flashcard, Study Room, Admin: UI có sẵn, logic/API backend đang phát triển dần.
- Nhánh phát triển chính: **`develop`** trên [GitHub](https://github.com/KhuongTNM/AI-studyHUB/tree/develop).
