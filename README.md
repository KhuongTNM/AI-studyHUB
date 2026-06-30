# StudyHub

StudyHub is an AI-supported study document management system. The project is split into two main sides:

- **Backend:** Java Spring Boot API, PostgreSQL database, authentication, business logic.
- **Frontend:** Next.js + TypeScript user interface, API client, pages, components, and state hooks.

Repository: [https://github.com/KhuongTNM/AI-studyHUB](https://github.com/KhuongTNM/AI-studyHUB)

## Required Tools

Install these before running the project:

| Tool | Suggested version | Purpose |
|---------|-----------------|----------|
| [Java JDK](https://adoptium.net/) | 17+ | Backend Spring Boot |
| [Apache Maven](https://maven.apache.org/download.cgi) | 3.9+ | Build/chạy backend (`mvn`) |
| [Node.js](https://nodejs.org/) | 18+ (LTS) | Frontend Next.js |
| npm | đi kèm Node.js | Cài dependency frontend |
| [PostgreSQL](https://www.postgresql.org/download/) | 15+ (kèm extension `pgvector`) | Database `AIStudyHub` |
| [pgAdmin 4](https://www.pgadmin.org/) hoặc psql CLI | mới nhất | Chạy script schema |
| [Python](https://www.python.org/downloads/) | 3.11+ | Backend AI/RAG (FastAPI) |

Kiểm tra nhanh trong terminal:

```bash
java -version
mvn -version
node -v
npm -v
psql --version
python --version
```

> **Lưu ý khi cài Python trên Windows:** trong màn hình cài đặt, bắt buộc tick chọn **"Add Python to environment variables"** (hoặc **"Add python.exe to PATH"** ở bản cài cũ). Nếu bỏ qua bước này, lệnh `python` trong terminal sẽ không nhận diện được hoặc bị Windows tự động mở Microsoft Store. Sau khi cài xong phải đóng terminal cũ và mở terminal mới để PATH được cập nhật.

If `mvn` is not recognized, install Maven and add the Maven `bin` folder to Windows `PATH`.

## Project File Organization

### Backend Side

```text
backend/
  pom.xml
  src/main/java/com/aistudyhub/backend/
    AiStudyHubBackendApplication.java   # Main Spring Boot application
    config/                             # Database, CORS, security, seed data
    controller/                         # REST API endpoints
    dto/                                # Request/response objects
    entity/                             # JPA database table mapping
    exception/                          # Global error handling
    repository/                         # Spring Data JPA database queries
    security/                           # JWT filter and authenticated principal
    service/                            # Business logic and validation
  src/main/resources/
    application.properties              # Backend database/JWT/CORS config
```

Backend flow:

```text
HTTP Request -> Controller -> Service -> Repository -> Entity/Database
HTTP Response <- Controller <- Service <- Repository <- Entity/Database
```

Important backend file:

```text
backend/src/main/resources/application.properties
```

Open this file to set PostgreSQL connection info before running the backend:

```properties
app.datasource.url=jdbc:postgresql://localhost:5432/AIStudyHub
app.datasource.username=postgres
app.datasource.password=YOUR_POSTGRESQL_PASSWORD
```

Example for local setup:

```properties
app.datasource.username=postgres
app.datasource.password=12345
```

### Frontend Side

```text
frontend/
  package.json
  next.config.mjs
  public/                               # Public static assets and favicon
  src/
    app/                                # Next.js App Router pages/layout
    components/                         # UI components by feature
      admin/
      auth/
      chat/
      cloud/
      documents/
      flashcards/
      profile/
      ui/
    configs/                            # Frontend config and i18n helpers
    hooks/                              # React hooks and feature state logic
    lib/                                # Shared store, auth storage, utilities
    services/api/                       # Frontend API calls to backend
    states/                             # Shared types and app state models
    styles/                             # Global CSS
    utils/                              # Shared frontend helper functions
```

Important frontend file:

```text
frontend/.env.local
```

Create this file if it does not exist, then set the backend API URL:

```text
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### AI Service Side (Python / FastAPI)

```text
backend/AI/
  main.py                                # FastAPI app entrypoint
  requirements.txt                       # Python dependencies
  .env                                   # DATABASE_URL, OPENAI_API_KEY (hoặc Gemini key), model config
  services/
    embedding.py                         # Sinh embedding vector cho từng chunk văn bản
    llm_service.py                       # Gọi LLM để sinh câu trả lời (RAG)
    vector_store.py                      # Lưu/truy vấn vector trong PostgreSQL (pgvector)
  routers/
    ingest.py                            # API nhận và xử lý tài liệu upload
    search.py                            # API tìm kiếm/hỏi đáp theo nội dung tài liệu
```

AI service dùng chung database `AIStudyHub` với backend Java (bảng `ai.document_chunks`), và backend Java gọi sang AI service qua `ai.service.url=http://localhost:8000` trong `application.properties`.

Important AI service file:

```text
backend/AI/.env
```

```env
DATABASE_URL=postgresql://postgres:12345@localhost:5432/AIStudyHub
OPENAI_API_KEY=sk-your-key-here
LLM_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small
UPLOAD_DIR=./uploads
```

> Có thể dùng Gemini API (miễn phí, lấy key tại https://aistudio.google.com/apikey) thay cho OpenAI nếu chưa có quota — xem cấu hình `base_url` trong `services/embedding.py` và `services/llm_service.py`.

## Database Setup

Before running the backend, create the database schema.

### Option A — pgAdmin 4

1. Open pgAdmin 4 and connect to your local PostgreSQL server.
2. Right-click **Databases** → **Create** → **Database**, đặt tên `AIStudyHub`.
3. Right-click database `AIStudyHub` → **Query Tool**.
4. Mở và chạy file:

```text
database/ai_study_hub_schema_postgresql.sql
```

### Option B — psql CLI

```bash
psql -U postgres -c "CREATE DATABASE \"AIStudyHub\";"
psql -U postgres -d AIStudyHub -f database/ai_study_hub_schema_postgresql.sql
```

Script tạo toàn bộ schema và bảng cần thiết cho hệ thống.

After running the SQL script, make sure `application.properties` has the matching PostgreSQL username and password.

## How To Run The Project

Chạy backend Java, AI service Python, và frontend trong ba terminal riêng biệt.

### Terminal 1: Run Backend (Java)

From the project root:

```bash
cd backend
mvn spring-boot:run
```

Backend URL:

```text
http://localhost:8080
```

### Terminal 2: Run AI Service (Python)

From the project root:

```bash
cd backend/AI
python -m venv .venv
```

Kích hoạt môi trường ảo (chỉ cần làm lại nếu mở terminal mới):

```bash
# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

Cài thư viện (chỉ cần chạy 1 lần, hoặc khi `requirements.txt` thay đổi):

```bash
pip install -r requirements.txt
```

Tạo file `backend/AI/.env` theo mẫu ở mục "AI Service Side" phía trên, rồi chạy:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Kiểm tra service đã chạy:

```text
http://localhost:8000/health
```

### Terminal 3: Run Frontend

Open a new terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

## Run Order Checklist

1. Start PostgreSQL (đảm bảo service PostgreSQL đang chạy).
2. Tạo database và chạy schema script:

```bash
psql -U postgres -c "CREATE DATABASE \"AIStudyHub\";"
psql -U postgres -d AIStudyHub -f database/ai_study_hub_schema_postgresql.sql
```

3. Set database username/password in:

```text
backend/src/main/resources/application.properties
```

4. Start backend:

```bash
cd backend
mvn spring-boot:run
```

5. Start AI service (Python) trong terminal khác:

```bash
cd backend/AI
python -m venv .venv          # chỉ cần làm lần đầu
.venv\Scripts\activate        # Windows | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt   # chỉ cần làm lần đầu, hoặc khi requirements.txt thay đổi
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

6. Start frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

7. Open:

```text
http://localhost:3000
```

## Notes

- Backend must be running before frontend API features can work.
- AI service (Python) must be running on port `8000` before document upload/chat features can work — backend Java gọi sang AI service qua HTTP.
- Frontend runs on port `3000`.
- Backend runs on port `8080`.
- AI service runs on port `8000`.
- PostgreSQL must be running before backend starts, and must have the `pgvector` extension enabled.
- Do not put business logic inside controllers. Use `service/`.
- Frontend must call backend APIs. It must not connect directly to the database.
