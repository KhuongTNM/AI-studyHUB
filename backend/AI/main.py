from dotenv import load_dotenv
load_dotenv()

import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ingest, search
from services.vector_store import db_pool

# Standard JSON-like structured logging config
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize connection pool if needed (currently initialized at module level in vector_store)
    if db_pool is None:
        logger.error("Database pool failed to initialize on startup.")
    else:
        logger.info("Database connection pool initialized.")
        
    yield
    
    # Cleanly close pool on shutdown
    if db_pool:
        logger.info("Closing database connection pool.")
        db_pool.closeall()

app = FastAPI(lifespan=lifespan, title="AI Study Hub - RAG Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, tags=["Ingest"])
app.include_router(search.router, tags=["Search"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
