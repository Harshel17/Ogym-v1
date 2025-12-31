import sys
sys.path.insert(0, '.')

from app.database import SessionLocal, engine, Base
from app.models import Gym, User, TrainerMember, WorkoutCycle, WorkoutItem, Attendance, Payment
from app.auth import hash_password
from datetime import date, timedelta

Base.metadata.create_all(bind=engine)

db = SessionLocal()

existing = db.query(Gym).filter(Gym.code == "DEMO01").first()
if existing:
    print("Demo data already exists. Skipping seed.")
    db.close()
    exit(0)

print("Seeding demo data...")

gym = Gym(name="OGym Demo", code="DEMO01")
db.add(gym)
db.commit()
db.refresh(gym)

owner = User(
    gym_id=gym.id,
    username="owner",
    password_hash=hash_password("owner123"),
    role="owner"
)
db.add(owner)

trainer = User(
    gym_id=gym.id,
    username="trainer",
    password_hash=hash_password("trainer123"),
    role="trainer"
)
db.add(trainer)

member1 = User(
    gym_id=gym.id,
    username="member1",
    password_hash=hash_password("member123"),
    role="member"
)
db.add(member1)

member2 = User(
    gym_id=gym.id,
    username="member2",
    password_hash=hash_password("member123"),
    role="member"
)
db.add(member2)

db.commit()
db.refresh(trainer)
db.refresh(member1)
db.refresh(member2)

assignment1 = TrainerMember(gym_id=gym.id, trainer_id=trainer.id, member_id=member1.id)
assignment2 = TrainerMember(gym_id=gym.id, trainer_id=trainer.id, member_id=member2.id)
db.add(assignment1)
db.add(assignment2)
db.commit()

today = date.today()
start = today.isoformat()
end = (today + timedelta(days=30)).isoformat()

cycle = WorkoutCycle(
    gym_id=gym.id,
    member_id=member1.id,
    trainer_id=trainer.id,
    name="Push-Pull-Legs Beginner",
    start_date=start,
    end_date=end,
    is_active=True
)
db.add(cycle)
db.commit()
db.refresh(cycle)

exercises = [
    (1, "Bench Press", 3, 10, "40kg", 0),
    (1, "Overhead Press", 3, 10, "20kg", 1),
    (1, "Tricep Dips", 3, 12, None, 2),
    (2, "Deadlift", 3, 8, "60kg", 0),
    (2, "Barbell Row", 3, 10, "40kg", 1),
    (2, "Bicep Curls", 3, 12, "10kg", 2),
    (3, "Squats", 3, 10, "50kg", 0),
    (3, "Leg Press", 3, 12, "80kg", 1),
    (3, "Calf Raises", 3, 15, "30kg", 2),
    (4, "Bench Press", 3, 10, "42.5kg", 0),
    (4, "Incline Dumbbell Press", 3, 10, "15kg", 1),
    (5, "Pull-ups", 3, 8, None, 0),
    (5, "Cable Row", 3, 10, "35kg", 1),
]

for day, name, sets, reps, weight, order in exercises:
    item = WorkoutItem(
        cycle_id=cycle.id,
        day_of_week=day,
        exercise_name=name,
        sets=sets,
        reps=reps,
        weight=weight,
        order_index=order
    )
    db.add(item)

yesterday = (date.today() - timedelta(days=1)).isoformat()
att = Attendance(
    gym_id=gym.id,
    member_id=member1.id,
    date=yesterday,
    status="present",
    verified_method="qr"
)
db.add(att)

this_month = date.today().strftime("%Y-%m")
payment = Payment(
    gym_id=gym.id,
    member_id=member1.id,
    month=this_month,
    amount_due=5000,
    amount_paid=5000,
    status="paid",
    note="Monthly membership"
)
db.add(payment)

db.commit()
db.close()

print("Seed complete!")
print("Gym Code: DEMO01")
print("Users:")
print("  owner / owner123 (owner)")
print("  trainer / trainer123 (trainer)")
print("  member1 / member123 (member)")
print("  member2 / member123 (member)")
