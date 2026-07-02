FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render tự cấp biến $PORT cho mỗi service — mặc định 8000 khi chạy local/docker-compose.
ENV PORT=8000
EXPOSE 8000

# Dùng shell form để $PORT được resolve lúc container khởi động (Render cấp PORT khác nhau mỗi service).
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
