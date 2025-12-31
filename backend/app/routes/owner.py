from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import qrcode
import io
import json

from ..database import get_db
from ..models import User, Gym, TrainerMember
from ..schemas import UserOut, AssignTrainerRequest
from ..auth import get_current_user, require_role

router = APIRouter(prefix="/api/owner", tags=["owner"])

@router.get("/members", response_model=List[UserOut])
def get_members(
    user: User = Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    members = db.query(User).filter(
        User.gym_id == user.gym_id,
        User.role == "member"
    ).all()
    return members

@router.get("/trainers", response_model=List[UserOut])
def get_trainers(
    user: User = Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    trainers = db.query(User).filter(
        User.gym_id == user.gym_id,
        User.role == "trainer"
    ).all()
    return trainers

@router.post("/assign-trainer")
def assign_trainer(
    req: AssignTrainerRequest,
    user: User = Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    trainer = db.query(User).filter(
        User.id == req.trainer_id,
        User.gym_id == user.gym_id,
        User.role == "trainer"
    ).first()
    if not trainer:
        raise HTTPException(status_code=404, detail="Trainer not found")
    
    member = db.query(User).filter(
        User.id == req.member_id,
        User.gym_id == user.gym_id,
        User.role == "member"
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    existing = db.query(TrainerMember).filter(
        TrainerMember.trainer_id == req.trainer_id,
        TrainerMember.member_id == req.member_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already assigned")
    
    assignment = TrainerMember(
        gym_id=user.gym_id,
        trainer_id=req.trainer_id,
        member_id=req.member_id
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    
    return {"message": "Trainer assigned successfully", "id": assignment.id}

@router.get("/assignments")
def get_assignments(
    user: User = Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    assignments = db.query(TrainerMember).filter(
        TrainerMember.gym_id == user.gym_id
    ).all()
    
    result = []
    for a in assignments:
        trainer = db.query(User).filter(User.id == a.trainer_id).first()
        member = db.query(User).filter(User.id == a.member_id).first()
        result.append({
            "id": a.id,
            "trainer_id": a.trainer_id,
            "trainer_username": trainer.username if trainer else None,
            "member_id": a.member_id,
            "member_username": member.username if member else None
        })
    
    return result

@router.get("/qr-code")
def get_qr_code(
    user: User = Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    gym = db.query(Gym).filter(Gym.id == user.gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="Gym not found")
    
    payload = json.dumps({"type": "ogym_checkin", "gym_code": gym.code})
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    
    return StreamingResponse(buf, media_type="image/png")

@router.get("/qr-data")
def get_qr_data(
    user: User = Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    gym = db.query(Gym).filter(Gym.id == user.gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="Gym not found")
    
    return {"type": "ogym_checkin", "gym_code": gym.code}
