from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routes import auth, owner, attendance, payments, trainer, workouts

Base.metadata.create_all(bind=engine)

app = FastAPI(title="OGym API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(owner.router)
app.include_router(attendance.router)
app.include_router(payments.router)
app.include_router(trainer.router)
app.include_router(workouts.router)

@app.get("/")
def root():
    return {"message": "OGym API v1.0", "status": "running"}

@app.get("/health")
def health():
    return {"status": "healthy"}
