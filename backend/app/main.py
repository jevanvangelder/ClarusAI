from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.chat import router as chat_router
from app.api.chat_history import router as chat_history_router
from app.api.modules import router as modules_router
from app.api.ebooks import router as ebooks_router
from app.api.opdrachten import router as opdrachten_router
from app.api.submissions import router as submissions_router

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://localhost:5173",
        "https://clarusai-frontend.onrender.com",
        "https://www.clarusai.nl",
        "https://clarusai.nl"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(chat_history_router)
app.include_router(modules_router)
app.include_router(ebooks_router)
app.include_router(opdrachten_router)
app.include_router(submissions_router)

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.APP_NAME}", "status": "running", "version": "0.1.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}