from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class GymOut(BaseModel):
    id: int
    name: str
    code: str
    
    class Config:
        from_attributes = True

class UserOut(BaseModel):
    id: int
    gym_id: int
    username: str
    role: str
    
    class Config:
        from_attributes = True

class UserWithGym(UserOut):
    gym: Optional[GymOut] = None

class RegisterOwnerRequest(BaseModel):
    username: str
    password: str
    gym_name: str

class RegisterJoinRequest(BaseModel):
    username: str
    password: str
    gym_code: str
    role: str  # trainer or member

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserWithGym

class AssignTrainerRequest(BaseModel):
    trainer_id: int
    member_id: int

class AttendanceCheckinRequest(BaseModel):
    gym_code: str

class AttendanceOut(BaseModel):
    id: int
    member_id: int
    date: str
    status: str
    verified_method: str
    
    class Config:
        from_attributes = True

class PaymentMarkRequest(BaseModel):
    member_id: int
    month: str
    amount_due: int
    amount_paid: int
    status: str
    note: Optional[str] = None

class PaymentOut(BaseModel):
    id: int
    member_id: int
    month: str
    amount_due: int
    amount_paid: int
    status: str
    note: Optional[str] = None
    
    class Config:
        from_attributes = True

class WorkoutCycleCreate(BaseModel):
    member_id: int
    name: str
    start_date: str
    end_date: str

class WorkoutItemCreate(BaseModel):
    day_of_week: int
    exercise_name: str
    sets: int
    reps: int
    weight: Optional[str] = None
    order_index: int = 0

class WorkoutCycleWithItems(BaseModel):
    id: int
    member_id: int
    trainer_id: int
    name: str
    start_date: str
    end_date: str
    is_active: bool
    items: List["WorkoutItemOut"] = []
    
    class Config:
        from_attributes = True

class WorkoutItemOut(BaseModel):
    id: int
    cycle_id: int
    day_of_week: int
    exercise_name: str
    sets: int
    reps: int
    weight: Optional[str] = None
    order_index: int
    
    class Config:
        from_attributes = True

class WorkoutCompleteRequest(BaseModel):
    workout_item_id: int

class WorkoutCompletionOut(BaseModel):
    id: int
    workout_item_id: int
    completed_date: str
    completed_at: datetime
    
    class Config:
        from_attributes = True

class ActivityFeedItem(BaseModel):
    member_id: int
    member_username: str
    exercise_name: str
    sets: int
    reps: int
    completed_date: str
    completed_at: datetime

class MemberStats(BaseModel):
    total_workouts_completed: int
    current_streak: int
    last_7_days_count: int
