from fastapi import FastAPI
from routers import ingest, search

app = FastAPI(title="AI Study Hub – AI Service")

app.include_router(ingest.router)
app.include_router(search.router)


@app.get("/health")
def health():
    return {"status": "ok"}
