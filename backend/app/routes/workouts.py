from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date, timedelta

from ..database import get_db
from ..models import User, WorkoutCycle, WorkoutItem, WorkoutCompletion
from ..schemas import WorkoutCompleteRequest, WorkoutCompletionOut, MemberStats
from ..auth import get_current_user, require_role
from .attendance import mark_attendance_for_member

router = APIRouter(prefix="/api/workouts", tags=["workouts"])

@router.get("/cycles/my")
def get_my_cycle(
    user: User = Depends(require_role(["member"])),
    db: Session = Depends(get_db)
):
    cycle = db.query(WorkoutCycle).filter(
        WorkoutCycle.gym_id == user.gym_id,
        WorkoutCycle.member_id == user.id,
        WorkoutCycle.is_active == True
    ).first()
    
    if not cycle:
        return None
    
    items = db.query(WorkoutItem).filter(
        WorkoutItem.cycle_id == cycle.id
    ).order_by(WorkoutItem.day_of_week, WorkoutItem.order_index).all()
    
    return {
        "id": cycle.id,
        "name": cycle.name,
        "start_date": cycle.start_date,
        "end_date": cycle.end_date,
        "is_active": cycle.is_active,
        "items": [
            {
                "id": i.id,
                "day_of_week": i.day_of_week,
                "exercise_name": i.exercise_name,
                "sets": i.sets,
                "reps": i.reps,
                "weight": i.weight,
                "order_index": i.order_index
            }
            for i in items
        ]
    }

@router.get("/today")
def get_today_workout(
    user: User = Depends(require_role(["member"])),
    db: Session = Depends(get_db)
):
    cycle = db.query(WorkoutCycle).filter(
        WorkoutCycle.gym_id == user.gym_id,
        WorkoutCycle.member_id == user.id,
        WorkoutCycle.is_active == True
    ).first()
    
    if not cycle:
        return {"items": [], "message": "No active workout cycle"}
    
    today_dow = date.today().weekday()
    day_of_week = (today_dow + 1) % 7
    
    items = db.query(WorkoutItem).filter(
        WorkoutItem.cycle_id == cycle.id,
        WorkoutItem.day_of_week == day_of_week
    ).order_by(WorkoutItem.order_index).all()
    
    today_str = date.today().isoformat()
    completions = db.query(WorkoutCompletion).filter(
        WorkoutCompletion.member_id == user.id,
        WorkoutCompletion.completed_date == today_str
    ).all()
    completed_ids = {c.workout_item_id for c in completions}
    
    return {
        "cycle_name": cycle.name,
        "day_of_week": day_of_week,
        "items": [
            {
                "id": i.id,
                "exercise_name": i.exercise_name,
                "sets": i.sets,
                "reps": i.reps,
                "weight": i.weight,
                "order_index": i.order_index,
                "completed": i.id in completed_ids
            }
            for i in items
        ]
    }

@router.post("/complete")
def complete_workout(
    req: WorkoutCompleteRequest,
    user: User = Depends(require_role(["member"])),
    db: Session = Depends(get_db)
):
    item = db.query(WorkoutItem).filter(WorkoutItem.id == req.workout_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Workout item not found")
    
    cycle = db.query(WorkoutCycle).filter(
        WorkoutCycle.id == item.cycle_id,
        WorkoutCycle.member_id == user.id
    ).first()
    if not cycle:
        raise HTTPException(status_code=403, detail="Not your workout")
    
    today_str = date.today().isoformat()
    
    existing = db.query(WorkoutCompletion).filter(
        WorkoutCompletion.workout_item_id == req.workout_item_id,
        WorkoutCompletion.member_id == user.id,
        WorkoutCompletion.completed_date == today_str
    ).first()
    
    if existing:
        return {"message": "Already completed", "id": existing.id}
    
    completion = WorkoutCompletion(
        gym_id=user.gym_id,
        cycle_id=cycle.id,
        workout_item_id=req.workout_item_id,
        member_id=user.id,
        completed_date=today_str
    )
    db.add(completion)
    db.commit()
    db.refresh(completion)
    
    mark_attendance_for_member(db, user.gym_id, user.id, "workout")
    
    return {"message": "Workout completed", "id": completion.id}

@router.get("/history/my")
def get_my_history(
    user: User = Depends(require_role(["member"])),
    db: Session = Depends(get_db)
):
    completions = db.query(WorkoutCompletion).filter(
        WorkoutCompletion.member_id == user.id
    ).order_by(WorkoutCompletion.completed_date.desc()).limit(100).all()
    
    result = []
    for c in completions:
        item = db.query(WorkoutItem).filter(WorkoutItem.id == c.workout_item_id).first()
        if item:
            result.append({
                "id": c.id,
                "exercise_name": item.exercise_name,
                "sets": item.sets,
                "reps": item.reps,
                "weight": item.weight,
                "completed_date": c.completed_date,
                "completed_at": c.completed_at.isoformat() if c.completed_at else None
            })
    
    return result

@router.get("/stats/my", response_model=MemberStats)
def get_my_stats(
    user: User = Depends(require_role(["member"])),
    db: Session = Depends(get_db)
):
    total = db.query(WorkoutCompletion).filter(
        WorkoutCompletion.member_id == user.id
    ).count()
    
    seven_days_ago = (date.today() - timedelta(days=7)).isoformat()
    last_7 = db.query(WorkoutCompletion).filter(
        WorkoutCompletion.member_id == user.id,
        WorkoutCompletion.completed_date >= seven_days_ago
    ).count()
    
    streak = 0
    check_date = date.today()
    while True:
        count = db.query(WorkoutCompletion).filter(
            WorkoutCompletion.member_id == user.id,
            WorkoutCompletion.completed_date == check_date.isoformat()
        ).count()
        if count > 0:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    
    return MemberStats(
        total_workouts_completed=total,
        current_streak=streak,
        last_7_days_count=last_7
    )
