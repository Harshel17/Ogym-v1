from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import User, TrainerMember, WorkoutCycle, WorkoutItem, WorkoutCompletion
from ..schemas import UserOut, WorkoutCycleCreate, WorkoutItemCreate, WorkoutCycleWithItems, ActivityFeedItem
from ..auth import get_current_user, require_role

router = APIRouter(prefix="/api/trainer", tags=["trainer"])

def get_assigned_member_ids(db: Session, trainer_id: int) -> List[int]:
    assignments = db.query(TrainerMember).filter(
        TrainerMember.trainer_id == trainer_id
    ).all()
    return [a.member_id for a in assignments]

@router.get("/members", response_model=List[UserOut])
def get_my_members(
    user: User = Depends(require_role(["trainer"])),
    db: Session = Depends(get_db)
):
    member_ids = get_assigned_member_ids(db, user.id)
    members = db.query(User).filter(User.id.in_(member_ids)).all()
    return members

@router.get("/cycles")
def get_trainer_cycles(
    user: User = Depends(require_role(["trainer"])),
    db: Session = Depends(get_db)
):
    cycles = db.query(WorkoutCycle).filter(
        WorkoutCycle.trainer_id == user.id,
        WorkoutCycle.gym_id == user.gym_id
    ).all()
    
    result = []
    for c in cycles:
        member = db.query(User).filter(User.id == c.member_id).first()
        items = db.query(WorkoutItem).filter(WorkoutItem.cycle_id == c.id).order_by(WorkoutItem.day_of_week, WorkoutItem.order_index).all()
        result.append({
            "id": c.id,
            "member_id": c.member_id,
            "member_username": member.username if member else None,
            "trainer_id": c.trainer_id,
            "name": c.name,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "is_active": c.is_active,
            "items": [
                {
                    "id": i.id,
                    "cycle_id": i.cycle_id,
                    "day_of_week": i.day_of_week,
                    "exercise_name": i.exercise_name,
                    "sets": i.sets,
                    "reps": i.reps,
                    "weight": i.weight,
                    "order_index": i.order_index
                }
                for i in items
            ]
        })
    
    return result

@router.post("/cycles")
def create_cycle(
    req: WorkoutCycleCreate,
    user: User = Depends(require_role(["trainer"])),
    db: Session = Depends(get_db)
):
    member_ids = get_assigned_member_ids(db, user.id)
    if req.member_id not in member_ids:
        raise HTTPException(status_code=403, detail="Member not assigned to you")
    
    cycle = WorkoutCycle(
        gym_id=user.gym_id,
        member_id=req.member_id,
        trainer_id=user.id,
        name=req.name,
        start_date=req.start_date,
        end_date=req.end_date,
        is_active=True
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    
    return {"id": cycle.id, "message": "Cycle created"}

@router.post("/cycles/{cycle_id}/items")
def add_workout_item(
    cycle_id: int,
    req: WorkoutItemCreate,
    user: User = Depends(require_role(["trainer"])),
    db: Session = Depends(get_db)
):
    cycle = db.query(WorkoutCycle).filter(
        WorkoutCycle.id == cycle_id,
        WorkoutCycle.trainer_id == user.id
    ).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    
    item = WorkoutItem(
        cycle_id=cycle_id,
        day_of_week=req.day_of_week,
        exercise_name=req.exercise_name,
        sets=req.sets,
        reps=req.reps,
        weight=req.weight,
        order_index=req.order_index
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    
    return {"id": item.id, "message": "Item added"}

@router.get("/activity", response_model=List[ActivityFeedItem])
def get_activity_feed(
    user: User = Depends(require_role(["trainer"])),
    db: Session = Depends(get_db)
):
    member_ids = get_assigned_member_ids(db, user.id)
    
    completions = db.query(WorkoutCompletion).filter(
        WorkoutCompletion.gym_id == user.gym_id,
        WorkoutCompletion.member_id.in_(member_ids)
    ).order_by(WorkoutCompletion.completed_at.desc()).limit(50).all()
    
    result = []
    for c in completions:
        member = db.query(User).filter(User.id == c.member_id).first()
        item = db.query(WorkoutItem).filter(WorkoutItem.id == c.workout_item_id).first()
        if member and item:
            result.append(ActivityFeedItem(
                member_id=c.member_id,
                member_username=member.username,
                exercise_name=item.exercise_name,
                sets=item.sets,
                reps=item.reps,
                completed_date=c.completed_date,
                completed_at=c.completed_at
            ))
    
    return result
