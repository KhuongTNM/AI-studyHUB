# ── Stage 1: Build ──────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Cache dependencies trước (chỉ rebuild khi pom.xml thay đổi)
COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

# ── Stage 2: Run ─────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Tạo thư mục uploads (Render Disk sẽ mount vào đây)
RUN mkdir -p /app/uploads

COPY --from=build /app/target/backend-0.1.0.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
