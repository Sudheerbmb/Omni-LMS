import asyncio
from sqlalchemy import select
import app.tenancy.models  # noqa: F401
import app.identity.models  # noqa: F401
from app.platform.database import SessionFactory
from app.identity.models import User
from app.identity.security import hash_password

STUDENT_SEEDS = [
    {"email": "student@example.com", "name": "Alex Rivera", "grade_num": 9, "sec_name": "A"},
    {"email": "student.class1@school.edu", "name": "Aarav Patel (Class 1-A)", "grade_num": 1, "sec_name": "A"},
    {"email": "student.class2@school.edu", "name": "Diya Sharma (Class 2-A)", "grade_num": 2, "sec_name": "A"},
    {"email": "student.class3@school.edu", "name": "Ishaan Verma (Class 3-A)", "grade_num": 3, "sec_name": "A"},
    {"email": "student.class4@school.edu", "name": "Ananya Iyer (Class 4-A)", "grade_num": 4, "sec_name": "A"},
    {"email": "student.class5@school.edu", "name": "Rohan Gupta (Class 5-A)", "grade_num": 5, "sec_name": "A"},
    {"email": "student.class6@school.edu", "name": "Sanya Reddy (Class 6-A)", "grade_num": 6, "sec_name": "A"},
    {"email": "student.class7@school.edu", "name": "Kabir Mehta (Class 7-A)", "grade_num": 7, "sec_name": "A"},
    {"email": "student.class8@school.edu", "name": "Pooja Nair (Class 8-A)", "grade_num": 8, "sec_name": "A"},
    {"email": "student.class9@school.edu", "name": "Arjun Rao (Class 9-A)", "grade_num": 9, "sec_name": "A"},
    {"email": "student.class10@school.edu", "name": "Meera Joshi (Class 10-A)", "grade_num": 10, "sec_name": "A"},
]

async def sync_logins():
    async with SessionFactory() as session:
        # 1. Ensure Admins
        admins = [
            ("admin@example.com", "System Admin", "ChangeMe123!"),
            ("admin@lms-platform.com", "Platform Administrator", "OrbitAdmin!2026X7")
        ]
        for email, name, pwd in admins:
            u = await session.scalar(select(User).where(User.email == email))
            if not u:
                u = User(
                    email=email,
                    display_name=name,
                    password_hash=hash_password(pwd),
                    role="admin",
                    status="active",
                    email_verified=True
                )
                session.add(u)
            else:
                u.password_hash = hash_password(pwd)
                u.role = "admin"
                u.status = "active"

        # 2. Ensure all teachers have password Teacher123!
        teachers = (await session.scalars(select(User).where(User.role == "teacher"))).all()
        for t in teachers:
            t.password_hash = hash_password("Teacher123!")
            t.status = "active"
            t.email_verified = True

        # Generic teacher@example.com
        gen_t = await session.scalar(select(User).where(User.email == "teacher@example.com"))
        if not gen_t:
            gen_t = User(
                email="teacher@example.com",
                display_name="Dr. Sarah Connor",
                password_hash=hash_password("Teacher123!"),
                role="teacher",
                status="active",
                email_verified=True
            )
            session.add(gen_t)
        else:
            gen_t.password_hash = hash_password("Teacher123!")
            gen_t.role = "teacher"
            gen_t.status = "active"

        # 3. Ensure Students
        for s_data in STUDENT_SEEDS:
            stu = await session.scalar(select(User).where(User.email == s_data["email"]))
            if not stu:
                stu = User(
                    email=s_data["email"],
                    display_name=s_data["name"],
                    password_hash=hash_password("Student123!"),
                    role="student",
                    status="active",
                    email_verified=True
                )
                session.add(stu)
            else:
                stu.password_hash = hash_password("Student123!")
                stu.role = "student"
                stu.status = "active"

        await session.commit()

        # Print report
        all_users = (await session.scalars(select(User).order_by(User.role, User.email))).all()
        print("=== DATABASE LOGIN CREDENTIALS AUDIT ===")
        for u in all_users:
            pwd = "ChangeMe123!" if "admin@example" in u.email else ("OrbitAdmin!2026X7" if "admin@lms" in u.email else ("Teacher123!" if u.role == "teacher" else "Student123!"))
            print(f"[{u.role.upper():<7}] Email: {u.email:<32} | Password: {pwd:<18} | Name: {u.display_name}")

if __name__ == "__main__":
    asyncio.run(sync_logins())
