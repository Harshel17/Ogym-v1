from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import User, Payment
from ..schemas import PaymentMarkRequest, PaymentOut
from ..auth import get_current_user, require_role

router = APIRouter(prefix="/api/payments", tags=["payments"])

@router.get("/my", response_model=List[PaymentOut])
def get_my_payments(
    user: User = Depends(require_role(["member"])),
    db: Session = Depends(get_db)
):
    records = db.query(Payment).filter(
        Payment.gym_id == user.gym_id,
        Payment.member_id == user.id
    ).order_by(Payment.month.desc()).all()
    return records

@router.get("/gym")
def get_gym_payments(
    user: User = Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    records = db.query(Payment).filter(
        Payment.gym_id == user.gym_id
    ).order_by(Payment.month.desc()).all()
    
    result = []
    for r in records:
        member = db.query(User).filter(User.id == r.member_id).first()
        result.append({
            "id": r.id,
            "member_id": r.member_id,
            "member_username": member.username if member else None,
            "month": r.month,
            "amount_due": r.amount_due,
            "amount_paid": r.amount_paid,
            "status": r.status,
            "note": r.note
        })
    
    return result

@router.post("/mark", response_model=PaymentOut)
def mark_payment(
    req: PaymentMarkRequest,
    user: User = Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    member = db.query(User).filter(
        User.id == req.member_id,
        User.gym_id == user.gym_id,
        User.role == "member"
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    existing = db.query(Payment).filter(
        Payment.gym_id == user.gym_id,
        Payment.member_id == req.member_id,
        Payment.month == req.month
    ).first()
    
    if existing:
        existing.amount_due = req.amount_due
        existing.amount_paid = req.amount_paid
        existing.status = req.status
        existing.note = req.note
        db.commit()
        db.refresh(existing)
        return existing
    
    payment = Payment(
        gym_id=user.gym_id,
        member_id=req.member_id,
        month=req.month,
        amount_due=req.amount_due,
        amount_paid=req.amount_paid,
        status=req.status,
        note=req.note
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
