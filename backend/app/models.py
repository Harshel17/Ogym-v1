from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Date, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Gym(Base):
    __tablename__ = "gyms"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String(6), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    
    users = relationship("User", back_populates="gym")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # owner, trainer, member
    created_at = Column(DateTime, server_default=func.now())
    
    gym = relationship("Gym", back_populates="users")

class TrainerMember(Base):
    __tablename__ = "trainer_members"
    
    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False, index=True)
    trainer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    
    __table_args__ = (UniqueConstraint('trainer_id', 'member_id', name='unique_trainer_member'),)

class Attendance(Base):
    __tablename__ = "attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    status = Column(String, default="present")
    verified_method = Column(String, default="qr")  # qr, workout, both
    created_at = Column(DateTime, server_default=func.now())
    
    __table_args__ = (UniqueConstraint('gym_id', 'member_id', 'date', name='unique_attendance'),)

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    month = Column(String, nullable=False)  # YYYY-MM
    amount_due = Column(Integer, default=0)
    amount_paid = Column(Integer, default=0)
    status = Column(String, default="unpaid")  # paid, unpaid, partial
    note = Column(String, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class WorkoutCycle(Base):
    __tablename__ = "workout_cycles"
    
    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    trainer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

class WorkoutItem(Base):
    __tablename__ = "workout_items"
    
    id = Column(Integer, primary_key=True, index=True)
    cycle_id = Column(Integer, ForeignKey("workout_cycles.id"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Sunday, 6=Saturday
    exercise_name = Column(String, nullable=False)
    sets = Column(Integer, nullable=False)
    reps = Column(Integer, nullable=False)
    weight = Column(String, nullable=True)
    order_index = Column(Integer, default=0)

class WorkoutCompletion(Base):
    __tablename__ = "workout_completions"
    
    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False, index=True)
    cycle_id = Column(Integer, ForeignKey("workout_cycles.id"), nullable=False, index=True)
    workout_item_id = Column(Integer, ForeignKey("workout_items.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    completed_date = Column(String, nullable=False)  # YYYY-MM-DD
    completed_at = Column(DateTime, server_default=func.now())
