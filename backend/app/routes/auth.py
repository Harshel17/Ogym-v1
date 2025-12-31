from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Gym
from ..schemas import RegisterOwnerRequest, RegisterJoinRequest, LoginRequest, TokenResponse, UserWithGym, GymOut
from ..auth import hash_password, verify_password, create_access_token, get_current_user
import random
import string

router = APIRouter(prefix="/api/auth", tags=["auth"])

def generate_gym_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@router.post("/register-owner", response_model=TokenResponse)
def register_owner(req: RegisterOwnerRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    code = generate_gym_code()
    while db.query(Gym).filter(Gym.code == code).first():
        code = generate_gym_code()
    
    gym = Gym(name=req.gym_name, code=code)
    db.add(gym)
    db.commit()
    db.refresh(gym)
    
    user = User(
        gym_id=gym.id,
        username=req.username,
        password_hash=hash_password(req.password),
        role="owner"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token({"user_id": user.id, "gym_id": user.gym_id, "role": user.role})
    
    return TokenResponse(
        access_token=token,
        user=UserWithGym(
            id=user.id,
            gym_id=user.gym_id,
            username=user.username,
            role=user.role,
            gym=GymOut(id=gym.id, name=gym.name, code=gym.code)
        )
    )

@router.post("/register-join", response_model=TokenResponse)
def register_join(req: RegisterJoinRequest, db: Session = Depends(get_db)):
    if req.role not in ["trainer", "member"]:
        raise HTTPException(status_code=400, detail="Role must be trainer or member")
    
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    gym = db.query(Gym).filter(Gym.code == req.gym_code.upper()).first()
    if not gym:
        raise HTTPException(status_code=400, detail="Invalid gym code")
    
    user = User(
        gym_id=gym.id,
        username=req.username,
        password_hash=hash_password(req.password),
        role=req.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token({"user_id": user.id, "gym_id": user.gym_id, "role": user.role})
    
    return TokenResponse(
        access_token=token,
        user=UserWithGym(
            id=user.id,
            gym_id=user.gym_id,
            username=user.username,
            role=user.role,
            gym=GymOut(id=gym.id, name=gym.name, code=gym.code)
        )
    )

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    gym = db.query(Gym).filter(Gym.id == user.gym_id).first()
    token = create_access_token({"user_id": user.id, "gym_id": user.gym_id, "role": user.role})
    
    return TokenResponse(
        access_token=token,
        user=UserWithGym(
            id=user.id,
            gym_id=user.gym_id,
            username=user.username,
            role=user.role,
            gym=GymOut(id=gym.id, name=gym.name, code=gym.code) if gym else None
        )
    )

@router.get("/me", response_model=UserWithGym)
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    gym = db.query(Gym).filter(Gym.id == user.gym_id).first()
    return UserWithGym(
        id=user.id,
        gym_id=user.gym_id,
        username=user.username,
        role=user.role,
        gym=GymOut(id=gym.id, name=gym.name, code=gym.code) if gym else None
    )
