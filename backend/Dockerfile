# ── Stage 1: Build ──────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests -B

# ── Stage 2: Run ─────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Cài Python + build deps cho psycopg2
RUN apk add --no-cache \
    python3 py3-pip py3-virtualenv \
    gcc musl-dev libpq-dev python3-dev

RUN mkdir -p /app/uploads

COPY --from=build /app/target/backend-0.1.0.jar app.jar

COPY AI ./AI
RUN python3 -m venv AI/.venv \
    && AI/.venv/bin/pip install --no-cache-dir -r AI/requirements.txt

EXPOSE 8080 8000

CMD ["sh", "-c", "cd AI && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 & java -jar /app/app.jar"]