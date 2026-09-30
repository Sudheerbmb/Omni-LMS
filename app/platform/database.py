from collections.abc import AsyncIterator

from sqlalchemy import Connection, inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.platform.config import settings
from app.platform.models import Base


# â”€â”€ Engine & session factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

_engine_kwargs: dict = {"pool_pre_ping": True}

if "sqlite" not in settings.database_url:
    _engine_kwargs.update(
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
    )

if settings.database_echo:
    _engine_kwargs["echo"] = True

engine = create_async_engine(settings.database_url, **_engine_kwargs)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


# â”€â”€ Schema initialisation (development only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def init_database() -> None:
    """Create all tables and bootstrap the admin account (dev mode only)."""
    # Import every model module so SQLAlchemy registers them before create_all
    import app.ai.models  # noqa: F401
    import app.assessment.models  # noqa: F401
    import app.assignments.models  # noqa: F401
    import app.certification.models  # noqa: F401
    import app.classroom.models  # noqa: F401
    import app.coding.models  # noqa: F401
    import app.communication.models  # noqa: F401
    import app.courses.models  # noqa: F401
    import app.content.models  # noqa: F401
    import app.enrollment.models  # noqa: F401
    import app.identity.models  # noqa: F401
    import app.learning.models  # noqa: F401
    import app.notifications.models  # noqa: F401
    import app.tenancy.models  # noqa: F401
    import app.timetable.models  # noqa: F401

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        if "sqlite" in settings.database_url:
            await connection.run_sync(_patch_sqlite_columns)

    await _bootstrap_admin()


def _patch_sqlite_columns(connection: Connection) -> None:
    """Apply schema patches that Alembic would handle in production."""
    inspector = inspect(connection)
    tables = inspector.get_table_names()

    if "users" in tables:
        columns = {c["name"] for c in inspector.get_columns("users")}
        if "role" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(32) DEFAULT 'student' NOT NULL"))
        if "phone_number" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(32)"))
        if "avatar_url" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))
        if "bio" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN bio TEXT"))
        if "timezone" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN timezone VARCHAR(64) DEFAULT 'UTC'"))
        if "locale" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN locale VARCHAR(16) DEFAULT 'en'"))
        if "email_verified" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0"))
        if "last_login_at" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))
        if "login_count" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0"))
        if "failed_login_count" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN failed_login_count INTEGER DEFAULT 0"))
        if "locked_until" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME"))

    if "courses" in tables:
        columns = {c["name"] for c in inspector.get_columns("courses")}
        if "category" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN category VARCHAR(100)"))
        if "tags" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN tags JSON"))
        if "thumbnail_url" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN thumbnail_url VARCHAR(500)"))
        if "level" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN level VARCHAR(32) DEFAULT 'beginner'"))
        if "language" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN language VARCHAR(16) DEFAULT 'en'"))
        if "estimated_hours" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN estimated_hours REAL"))
        if "max_students" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN max_students INTEGER"))
        if "price" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN price REAL DEFAULT 0.0"))
        if "is_free" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN is_free BOOLEAN DEFAULT 1"))
        if "rating_avg" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN rating_avg REAL DEFAULT 0.0"))
        if "rating_count" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN rating_count INTEGER DEFAULT 0"))
        if "enrolled_count" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN enrolled_count INTEGER DEFAULT 0"))


async def _bootstrap_admin() -> None:
    if not settings.bootstrap_admin_email or not settings.bootstrap_admin_password:
        return

    from app.identity.models import User
    from app.identity.security import hash_password

    async with SessionFactory() as session:
        existing = await session.scalar(
            select(User).where(User.email == settings.bootstrap_admin_email.lower())
        )
        if existing:
            return
        session.add(User(
            email=settings.bootstrap_admin_email.lower(),
            display_name=settings.bootstrap_admin_name,
            password_hash=hash_password(settings.bootstrap_admin_password),
            role="admin",
            status="active",
            email_verified=True,
        ))
        await session.commit()

