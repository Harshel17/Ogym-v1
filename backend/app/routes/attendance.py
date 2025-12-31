from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from ..database import get_db
from ..models import User, Gym, Attendance
from ..schemas import AttendanceCheckinRequest, AttendanceOut
from ..auth import get_current_user, require_role

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

def mark_attendance_for_member(db: Session, gym_id: int, member_id: int, method: str = "qr"):
    today = date.today().isoformat()
    
    existing = db.query(Attendance).filter(
        Attendance.gym_id == gym_id,
        Attendance.member_id == member_id,
        Attendance.date == today
    ).first()
    
    if existing:
        if method == "workout" and existing.verified_method == "qr":
            existing.verified_method = "both"
            db.commit()
        return existing
    
    attendance = Attendance(
        gym_id=gym_id,
        member_id=member_id,
        date=today,
        status="present",
        verified_method=method
    )
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    return attendance

@router.post("/checkin", response_model=AttendanceOut)
def checkin(
    req: AttendanceCheckinRequest,
    user: User = Depends(require_role(["member"])),
    db: Session = Depends(get_db)
):
    gym = db.query(Gym).filter(Gym.code == req.gym_code.upper()).first()
    if not gym:
        raise HTTPException(status_code=400, detail="Invalid gym code")
    
    if gym.id != user.gym_id:
        raise HTTPException(status_code=403, detail="This QR code is for a different gym")
    
    attendance = mark_attendance_for_member(db, user.gym_id, user.id, "qr")
    return attendance

@router.get("/my", response_model=List[AttendanceOut])
def get_my_attendance(
    user: User = Depends(require_role(["member"])),
    db: Session = Depends(get_db)
):
    records = db.query(Attendance).filter(
        Attendance.gym_id == user.gym_id,
        Attendance.member_id == user.id
    ).order_by(Attendance.date.desc()).limit(30).all()
    return records

@router.get("/gym")
def get_gym_attendance(
    user: User = Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    records = db.query(Attendance).filter(
        Attendance.gym_id == user.gym_id
    ).order_by(Attendance.date.desc()).limit(100).all()
    
    result = []
    for r in records:
        member = db.query(User).filter(User.id == r.member_id).first()
        result.append({
            "id": r.id,
            "member_id": r.member_id,
            "member_username": member.username if member else None,
            "date": r.date,
            "status": r.status,
            "verified_method": r.verified_method
        })
    
    return result
