# StudyHub

StudyHub is an AI-supported study document management system. The project is split into two main sides:

- **Backend:** Java Spring Boot API, SQL Server database, authentication, business logic.
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
| [SQL Server](https://www.microsoft.com/sql-server) | 2019+ hoặc Express | Database `AIStudyHub` |
| SSMS hoặc Azure Data Studio | mới nhất | Chạy script schema |

Kiểm tra nhanh trong terminal:

```bash
java -version
mvn -version
node -v
npm -v
```

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

Open this file to set SQL Server username/password before running the backend:

```properties
app.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=AIStudyHub;encrypt=true;trustServerCertificate=true
app.datasource.username=sa
app.datasource.password=YOUR_SQL_SERVER_PASSWORD
```

Example for local class setup:

```properties
app.datasource.username=sa
app.datasource.password=12345678
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

## Database Setup

Before running the backend, create the database schema.

1. Open SQL Server Management Studio or Azure Data Studio.
2. Connect to your local SQL Server.
3. Run this file:

```text
database/ai_study_hub_schema_mssql.sql
```

This creates the `AIStudyHub` database and required tables.

After running the SQL script, make sure `application.properties` has the same SQL Server username/password.

## How To Run The Project

Run backend and frontend in two separate terminals.

### Terminal 1: Run Backend

From the project root:

```bash
cd backend
mvn spring-boot:run
```

Backend URL:

```text
http://localhost:8080
```

### Terminal 2: Run Frontend

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

1. Start SQL Server.
2. Run `database/ai_study_hub_schema_mssql.sql`.
3. Set database username/password in:

```text
backend/src/main/resources/application.properties
```

4. Start backend:

```bash
cd backend
mvn spring-boot:run
```

5. Start frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

6. Open:

```text
http://localhost:3000
```

## API Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register account and return JWT |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout with `Authorization: Bearer <token>` |
| `GET` | `/api/auth/me` | Get current user |

## Notes

- Backend must be running before frontend API features can work.
- Frontend runs on port `3000`.
- Backend runs on port `8080`.
- SQL Server must be running before backend starts.
- Do not put business logic inside controllers. Use `service/`.
- Frontend must call backend APIs. It must not connect directly to the database.
