# Spark Backend Account Reviews Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the new `spark-store-backend` FastAPI + MySQL service for Flarum-backed login, app reviews/ratings, and default user app-list sync.

**Architecture:** The backend validates Flarum access tokens, maps Flarum users to local users, signs Spark Store JWTs, and persists Spark Store-specific data in MySQL. The API uses synchronous FastAPI routes, SQLAlchemy ORM, Alembic migrations, and pytest API tests with a SQLite test database.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.x, Alembic, PyMySQL, Pydantic Settings, python-jose, httpx, pytest.

---

## File Structure

Create a new sibling repository at `/home/spark/Desktop/shenmo-spark-store/spark-store-backend`.

Backend files:

- Create: `README.md` - project overview, setup, test commands, API summary.
- Create: `.gitignore` - Python, virtualenv, test, and secret ignores.
- Create: `.env.example` - safe configuration template.
- Create: `pyproject.toml` - dependencies, pytest config, tooling config.
- Create: `alembic.ini` - Alembic config.
- Create: `alembic/env.py` - migration environment wired to app metadata.
- Create: `alembic/versions/0001_initial.py` - initial MySQL schema.
- Create: `app/main.py` - FastAPI app factory and router registration.
- Create: `app/core/config.py` - environment settings.
- Create: `app/core/security.py` - JWT creation and decoding.
- Create: `app/db/session.py` - SQLAlchemy engine/session dependency.
- Create: `app/db/base.py` - declarative base and model imports.
- Create: `app/models/user.py` - `User` ORM model.
- Create: `app/models/store_app.py` - `StoreApp` ORM model.
- Create: `app/models/review.py` - `Review` ORM model.
- Create: `app/models/app_list.py` - app-list ORM models.
- Create: `app/schemas/auth.py` - auth request/response schemas.
- Create: `app/schemas/review.py` - review request/response schemas.
- Create: `app/schemas/app_list.py` - app-list request/response schemas.
- Create: `app/services/flarum.py` - Flarum profile validation client.
- Create: `app/api/deps.py` - auth and DB dependencies.
- Create: `app/api/router.py` - API router aggregator.
- Create: `app/api/routes/auth.py` - auth endpoints.
- Create: `app/api/routes/reviews.py` - review and rating endpoints.
- Create: `app/api/routes/app_lists.py` - app-list endpoints.
- Create: `tests/conftest.py` - test app and database fixtures.
- Create: `tests/test_auth.py` - Flarum auth tests.
- Create: `tests/test_reviews.py` - review behavior tests.
- Create: `tests/test_app_lists.py` - app-list sync tests.

## Task 1: Initialize Backend Repository

**Files:**
- Create: `/home/spark/Desktop/shenmo-spark-store/spark-store-backend/README.md`
- Create: `/home/spark/Desktop/shenmo-spark-store/spark-store-backend/.gitignore`

- [ ] **Step 1: Verify parent directory exists**

Run: `ls "/home/spark/Desktop/shenmo-spark-store"`

Expected: output includes `spark-store`.

- [ ] **Step 2: Create repository directory**

Run: `mkdir "/home/spark/Desktop/shenmo-spark-store/spark-store-backend"`

Expected: command exits 0.

- [ ] **Step 3: Initialize Git repository**

Run: `git init`

Workdir: `/home/spark/Desktop/shenmo-spark-store/spark-store-backend`

Expected: output says an empty Git repository was initialized.

- [ ] **Step 4: Write initial README**

Create `README.md` with:

```markdown
# Spark Store Backend

Python backend for Spark Store account login, app reviews, ratings, and user app-list sync.

The service uses the Spark forum Flarum instance as the identity provider and stores Spark Store-specific data in MySQL.

## Development

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
pytest
```
```

- [ ] **Step 5: Write `.gitignore`**

Create `.gitignore` with:

```gitignore
.venv/
__pycache__/
*.py[cod]
.pytest_cache/
.coverage
htmlcov/
.env
*.sqlite3
dist/
build/
*.egg-info/
```

- [ ] **Step 6: Commit initial repository**

Run:

```bash
git add README.md .gitignore
git commit -m "first commit"
git remote add origin https://gitee.com/momen_official/spark-store-backend.git
```

Expected: commit succeeds and `git remote -v` shows the Gitee origin.

## Task 2: Add Backend Project Skeleton

**Files:**
- Create: `pyproject.toml`
- Create: `.env.example`
- Create: `app/__init__.py`
- Create: `app/main.py`
- Create: `app/core/config.py`
- Create: `app/api/router.py`
- Test: `tests/test_health.py`

- [ ] **Step 1: Write failing health test**

Create `tests/test_health.py` with:

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_ok():
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run test and verify failure**

Run: `pytest tests/test_health.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app'`.

- [ ] **Step 3: Add package config**

Create `pyproject.toml` with:

```toml
[build-system]
requires = ["setuptools>=69"]
build-backend = "setuptools.build_meta"

[project]
name = "spark-store-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115,<1.0",
  "uvicorn[standard]>=0.30,<1.0",
  "sqlalchemy>=2.0,<3.0",
  "alembic>=1.13,<2.0",
  "pymysql>=1.1,<2.0",
  "pydantic-settings>=2.4,<3.0",
  "python-jose[cryptography]>=3.3,<4.0",
  "httpx>=0.27,<1.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3,<9.0",
  "pytest-cov>=5.0,<6.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 4: Add settings**

Create `.env.example` with:

```env
APP_NAME="Spark Store Backend"
DATABASE_URL="mysql+pymysql://spark:spark_password@127.0.0.1:3306/spark_store"
JWT_SECRET_KEY="change-me-in-production"
JWT_ALGORITHM="HS256"
JWT_EXPIRE_MINUTES="10080"
FLARUM_BASE_URL="https://bbs.spark-app.store"
```

Create `app/core/config.py` with:

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Spark Store Backend"
    database_url: str = "sqlite:///./spark-store-dev.sqlite3"
    jwt_secret_key: str = "dev-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080
    flarum_base_url: str = "https://bbs.spark-app.store"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: Add FastAPI app**

Create `app/__init__.py` as an empty file.

Create `app/api/router.py` with:

```python
from fastapi import APIRouter

api_router = APIRouter()
```

Create `app/main.py` with:

```python
from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router)
    return app


app = create_app()
```

- [ ] **Step 6: Run test and verify pass**

Run: `pytest tests/test_health.py -v`

Expected: PASS.

- [ ] **Step 7: Commit skeleton**

Run:

```bash
git add .
git commit -m "feat: add FastAPI backend skeleton"
```

Expected: commit succeeds.

## Task 3: Add Database Models And Migration

**Files:**
- Create: `app/db/session.py`
- Create: `app/db/base.py`
- Create: `app/models/user.py`
- Create: `app/models/store_app.py`
- Create: `app/models/review.py`
- Create: `app/models/app_list.py`
- Create: `alembic.ini`
- Create: `alembic/env.py`
- Create: `alembic/versions/0001_initial.py`
- Test: `tests/test_models.py`

- [ ] **Step 1: Write failing model test**

Create `tests/test_models.py` with:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.user import User
from app.models.store_app import StoreApp
from app.models.review import Review


def test_review_model_persists_tagged_rating():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(flarum_user_id="123", username="momen", display_name="Momen")
        app = StoreApp(
            app_key="apm:amd64-apm:office:wps",
            pkgname="wps",
            origin="apm",
            store_arch="amd64-apm",
            category="office",
            latest_seen_version="1.0.0",
        )
        session.add_all([user, app])
        session.flush()

        review = Review(
            user_id=user.id,
            app_id=app.id,
            rating=5,
            content="Works well.",
            version="1.0.0",
            package_arch="amd64",
            client_arch="amd64",
            distro="deepin 25",
            origin="apm",
            category="office",
        )
        session.add(review)
        session.commit()

        stored = session.query(Review).one()
        assert stored.rating == 5
        assert stored.version == "1.0.0"
        assert stored.distro == "deepin 25"
```

- [ ] **Step 2: Run test and verify failure**

Run: `pytest tests/test_models.py -v`

Expected: FAIL with missing `app.db.base` or models.

- [ ] **Step 3: Add database session and base**

Create `app/db/session.py` with:

```python
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Create `app/db/base.py` with:

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models.app_list import UserAppList, UserAppListItem  # noqa: E402,F401
from app.models.review import Review  # noqa: E402,F401
from app.models.store_app import StoreApp  # noqa: E402,F401
from app.models.user import User  # noqa: E402,F401
```

- [ ] **Step 4: Add ORM models**

Create `app/models/user.py` with:

```python
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    flarum_user_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(128), default="")
    display_name: Mapped[str] = mapped_column(String(128), default="")
    avatar_url: Mapped[str] = mapped_column(String(1024), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    reviews = relationship("Review", back_populates="user")
    app_lists = relationship("UserAppList", back_populates="user")
```

Create `app/models/store_app.py` with:

```python
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StoreApp(Base):
    __tablename__ = "apps"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    app_key: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    pkgname: Mapped[str] = mapped_column(String(255), index=True)
    origin: Mapped[str] = mapped_column(String(16), index=True)
    store_arch: Mapped[str] = mapped_column(String(64), index=True)
    category: Mapped[str] = mapped_column(String(128), index=True)
    latest_seen_version: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    reviews = relationship("Review", back_populates="app")
```

Create `app/models/review.py` with:

```python
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
        UniqueConstraint(
            "user_id",
            "app_id",
            "version",
            "package_arch",
            "client_arch",
            "distro",
            "origin",
            "category",
            name="uq_reviews_user_app_tags",
        ),
        Index("ix_reviews_app_filters", "app_id", "version", "package_arch", "client_arch", "distro", "origin", "category"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    app_id: Mapped[int] = mapped_column(ForeignKey("apps.id"), index=True)
    rating: Mapped[int]
    content: Mapped[str] = mapped_column(Text)
    version: Mapped[str] = mapped_column(String(255), default="unknown")
    package_arch: Mapped[str] = mapped_column(String(64), default="unknown")
    client_arch: Mapped[str] = mapped_column(String(64), default="unknown")
    distro: Mapped[str] = mapped_column(String(255), default="unknown")
    origin: Mapped[str] = mapped_column(String(16), default="")
    category: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="reviews")
    app = relationship("StoreApp", back_populates="reviews")
```

Create `app/models/app_list.py` with:

```python
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserAppList(Base):
    __tablename__ = "user_app_lists"
    __table_args__ = (UniqueConstraint("user_id", "snapshot_name", name="uq_user_app_lists_default"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    snapshot_name: Mapped[str] = mapped_column(String(128), default="default")
    client_arch: Mapped[str] = mapped_column(String(64), default="unknown")
    distro: Mapped[str] = mapped_column(String(255), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="app_lists")
    items = relationship("UserAppListItem", back_populates="app_list", cascade="all, delete-orphan")


class UserAppListItem(Base):
    __tablename__ = "user_app_list_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    list_id: Mapped[int] = mapped_column(ForeignKey("user_app_lists.id"), index=True)
    pkgname: Mapped[str] = mapped_column(String(255), index=True)
    origin: Mapped[str] = mapped_column(String(16), index=True)
    category: Mapped[str] = mapped_column(String(128), index=True)
    version: Mapped[str] = mapped_column(String(255), default="")
    package_arch: Mapped[str] = mapped_column(String(64), default="unknown")
    app_name: Mapped[str] = mapped_column(String(255), default="")
    icon_url: Mapped[str] = mapped_column(String(1024), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    app_list = relationship("UserAppList", back_populates="items")
```

- [ ] **Step 5: Run model test and verify pass**

Run: `pytest tests/test_models.py -v`

Expected: PASS.

- [ ] **Step 6: Add Alembic migration**

Create `alembic.ini` with:

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = sqlite:///./spark-store-dev.sqlite3

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

Create `alembic/env.py` with:

```python
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings
from app.db.base import Base

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Create `alembic/versions/0001_initial.py` with:

```python
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("flarum_user_id", sa.String(length=64), nullable=False),
        sa.Column("username", sa.String(length=128), nullable=False),
        sa.Column("display_name", sa.String(length=128), nullable=False),
        sa.Column("avatar_url", sa.String(length=1024), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("flarum_user_id"),
    )
    op.create_index("ix_users_flarum_user_id", "users", ["flarum_user_id"])

    op.create_table(
        "apps",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("app_key", sa.String(length=512), nullable=False),
        sa.Column("pkgname", sa.String(length=255), nullable=False),
        sa.Column("origin", sa.String(length=16), nullable=False),
        sa.Column("store_arch", sa.String(length=64), nullable=False),
        sa.Column("category", sa.String(length=128), nullable=False),
        sa.Column("latest_seen_version", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("app_key"),
    )
    op.create_index("ix_apps_app_key", "apps", ["app_key"])
    op.create_index("ix_apps_pkgname", "apps", ["pkgname"])
    op.create_index("ix_apps_origin", "apps", ["origin"])
    op.create_index("ix_apps_store_arch", "apps", ["store_arch"])
    op.create_index("ix_apps_category", "apps", ["category"])

    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("app_id", sa.Integer(), sa.ForeignKey("apps.id"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("version", sa.String(length=255), nullable=False),
        sa.Column("package_arch", sa.String(length=64), nullable=False),
        sa.Column("client_arch", sa.String(length=64), nullable=False),
        sa.Column("distro", sa.String(length=255), nullable=False),
        sa.Column("origin", sa.String(length=16), nullable=False),
        sa.Column("category", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
        sa.UniqueConstraint("user_id", "app_id", "version", "package_arch", "client_arch", "distro", "origin", "category", name="uq_reviews_user_app_tags"),
    )
    op.create_index("ix_reviews_user_id", "reviews", ["user_id"])
    op.create_index("ix_reviews_app_id", "reviews", ["app_id"])
    op.create_index("ix_reviews_app_filters", "reviews", ["app_id", "version", "package_arch", "client_arch", "distro", "origin", "category"])

    op.create_table(
        "user_app_lists",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("snapshot_name", sa.String(length=128), nullable=False),
        sa.Column("client_arch", sa.String(length=64), nullable=False),
        sa.Column("distro", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "snapshot_name", name="uq_user_app_lists_default"),
    )
    op.create_index("ix_user_app_lists_user_id", "user_app_lists", ["user_id"])

    op.create_table(
        "user_app_list_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("list_id", sa.Integer(), sa.ForeignKey("user_app_lists.id"), nullable=False),
        sa.Column("pkgname", sa.String(length=255), nullable=False),
        sa.Column("origin", sa.String(length=16), nullable=False),
        sa.Column("category", sa.String(length=128), nullable=False),
        sa.Column("version", sa.String(length=255), nullable=False),
        sa.Column("package_arch", sa.String(length=64), nullable=False),
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("icon_url", sa.String(length=1024), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_app_list_items_list_id", "user_app_list_items", ["list_id"])
    op.create_index("ix_user_app_list_items_pkgname", "user_app_list_items", ["pkgname"])
    op.create_index("ix_user_app_list_items_origin", "user_app_list_items", ["origin"])
    op.create_index("ix_user_app_list_items_category", "user_app_list_items", ["category"])


def downgrade() -> None:
    op.drop_table("user_app_list_items")
    op.drop_table("user_app_lists")
    op.drop_table("reviews")
    op.drop_table("apps")
    op.drop_table("users")
```

Run: `alembic upgrade head`

Expected: local development database receives revision `0001_initial`.

- [ ] **Step 7: Commit database layer**

Run:

```bash
git add app/db app/models alembic.ini alembic tests/test_models.py
git commit -m "feat: add database schema"
```

Expected: commit succeeds.

## Task 4: Implement Flarum Auth And JWT

**Files:**
- Create: `app/core/security.py`
- Create: `app/services/flarum.py`
- Create: `app/schemas/auth.py`
- Create: `app/api/deps.py`
- Create: `app/api/routes/auth.py`
- Modify: `app/api/router.py`
- Test: `tests/conftest.py`
- Test: `tests/test_auth.py`

- [ ] **Step 1: Write failing auth tests**

Create `tests/conftest.py` with a SQLite test database, dependency override for `get_db`, and `TestClient(create_app())` fixture.

Create `tests/test_auth.py` with:

```python
from app.models.user import User


def test_auth_flarum_creates_user_and_returns_jwt(client, monkeypatch):
    async def fake_fetch_profile(token: str, user_id: str):
        assert token == "forum-token"
        assert user_id == "123"
        return {
            "flarum_user_id": "123",
            "username": "momen",
            "display_name": "Momen",
            "avatar_url": "https://bbs.spark-app.store/avatar.png",
        }

    monkeypatch.setattr("app.api.routes.auth.fetch_flarum_profile", fake_fetch_profile)

    response = client.post("/auth/flarum", json={"flarum_user_id": "123", "flarum_token": "forum-token"})

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["display_name"] == "Momen"


def test_me_requires_jwt(client):
    response = client.get("/me")
    assert response.status_code == 401
```

- [ ] **Step 2: Run auth tests and verify failure**

Run: `pytest tests/test_auth.py -v`

Expected: FAIL with missing auth routes or schemas.

- [ ] **Step 3: Add JWT helpers**

Create `app/core/security.py` with:

```python
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import get_settings


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "exp": expires}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None
```

- [ ] **Step 4: Add auth schemas and Flarum service**

Create `app/schemas/auth.py` with:

```python
from pydantic import BaseModel, Field


class FlarumAuthRequest(BaseModel):
    flarum_user_id: str = Field(min_length=1, max_length=64)
    flarum_token: str = Field(min_length=1)


class UserPublic(BaseModel):
    id: int
    flarum_user_id: str
    username: str
    display_name: str
    avatar_url: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
```

Create `app/services/flarum.py` with:

```python
import httpx

from app.core.config import get_settings


async def fetch_flarum_profile(token: str, user_id: str) -> dict[str, str]:
    settings = get_settings()
    url = f"{settings.flarum_base_url.rstrip('/')}/api/users/{user_id}"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url, headers={"Authorization": f"Token {token}"})

    if response.status_code != 200:
        raise ValueError("invalid flarum token")

    data = response.json()["data"]
    attrs = data.get("attributes", {})
    return {
        "flarum_user_id": str(data.get("id", user_id)),
        "username": attrs.get("username") or "",
        "display_name": attrs.get("displayName") or attrs.get("username") or "",
        "avatar_url": attrs.get("avatarUrl") or "",
    }
```

- [ ] **Step 5: Add auth dependency and routes**

Create `app/api/deps.py` with:

```python
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid bearer token")
    user = db.get(User, int(subject)) if subject.isdigit() else None
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    return user
```

Create `app/api/routes/auth.py` with:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, FlarumAuthRequest, UserPublic
from app.services.flarum import fetch_flarum_profile

router = APIRouter(tags=["auth"])


@router.post("/auth/flarum", response_model=AuthResponse)
async def auth_flarum(payload: FlarumAuthRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        profile = await fetch_flarum_profile(payload.flarum_token, payload.flarum_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid flarum token") from exc

    user = db.scalar(select(User).where(User.flarum_user_id == profile["flarum_user_id"]))
    if user is None:
        user = User(**profile)
        db.add(user)
    else:
        user.username = profile["username"]
        user.display_name = profile["display_name"]
        user.avatar_url = profile["avatar_url"]
    db.commit()
    db.refresh(user)

    return AuthResponse(access_token=create_access_token(str(user.id)), user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)) -> User:
    return user
```

Modify `app/api/router.py` to include:

```python
from fastapi import APIRouter

from app.api.routes import auth

api_router = APIRouter()
api_router.include_router(auth.router)
```

- [ ] **Step 6: Run auth tests and verify pass**

Run: `pytest tests/test_auth.py -v`

Expected: PASS.

- [ ] **Step 7: Commit auth**

Run:

```bash
git add app tests/test_auth.py tests/conftest.py
git commit -m "feat: add Flarum auth"
```

Expected: commit succeeds.

## Task 5: Implement Reviews And Rating Summary

**Files:**
- Create: `app/schemas/review.py`
- Create: `app/api/routes/reviews.py`
- Modify: `app/api/router.py`
- Test: `tests/test_reviews.py`

- [ ] **Step 1: Write failing review tests**

Create `tests/test_reviews.py` with:

```python
from app.core.security import create_access_token
from app.models.user import User


def seed_user(db_session):
    user = User(flarum_user_id="123", username="momen", display_name="Momen", avatar_url="")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def test_create_review_and_rating_summary(client, db_session):
    user = seed_user(db_session)

    response = client.post(
        "/apps/apm:amd64-apm:office:wps/reviews",
        headers=auth_headers(user),
        json={
            "rating": 5,
            "content": "Works well.",
            "tags": {
                "origin": "apm",
                "category": "office",
                "pkgname": "wps",
                "version": "1.0.0",
                "package_arch": "amd64",
                "client_arch": "amd64",
                "distro": "deepin 25",
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["rating"] == 5

    summary = client.get("/apps/apm:amd64-apm:office:wps/rating-summary")
    assert summary.status_code == 200
    assert summary.json()["average_rating"] == 5.0
    assert summary.json()["review_count"] == 1
    assert summary.json()["star_counts"]["5"] == 1


def test_reviews_filter_by_version(client, db_session):
    user = seed_user(db_session)
    headers = auth_headers(user)

    for version in ["1.0.0", "2.0.0"]:
        response = client.post(
            "/apps/apm:amd64-apm:office:wps/reviews",
            headers=headers,
            json={
                "rating": 4,
                "content": f"Version {version}",
                "tags": {
                    "origin": "apm",
                    "category": "office",
                    "pkgname": "wps",
                    "version": version,
                    "package_arch": "amd64",
                    "client_arch": "amd64",
                    "distro": "deepin 25",
                },
            },
        )
        assert response.status_code == 200

    response = client.get("/apps/apm:amd64-apm:office:wps/reviews", params={"version": "2.0.0"})

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["version"] == "2.0.0"
```

- [ ] **Step 2: Run review tests and verify failure**

Run: `pytest tests/test_reviews.py -v`

Expected: FAIL with `404 Not Found` for review endpoints.

- [ ] **Step 3: Add review schemas**

Create `app/schemas/review.py` with:

```python
from datetime import datetime

from pydantic import BaseModel, Field


class ReviewTags(BaseModel):
    origin: str = Field(min_length=1, max_length=16)
    category: str = Field(min_length=1, max_length=128)
    pkgname: str = Field(min_length=1, max_length=255)
    version: str = Field(default="unknown", max_length=255)
    package_arch: str = Field(default="unknown", max_length=64)
    client_arch: str = Field(default="unknown", max_length=64)
    distro: str = Field(default="unknown", max_length=255)


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=5000)
    tags: ReviewTags


class ReviewPublic(BaseModel):
    id: int
    rating: int
    content: str
    version: str
    package_arch: str
    client_arch: str
    distro: str
    origin: str
    category: str
    created_at: datetime
    updated_at: datetime
    user_display_name: str
    user_avatar_url: str


class RatingSummary(BaseModel):
    average_rating: float
    review_count: int
    star_counts: dict[int, int]
```

- [ ] **Step 4: Add review routes**

Create `app/api/routes/reviews.py` with:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.review import Review
from app.models.store_app import StoreApp
from app.models.user import User
from app.schemas.review import RatingSummary, ReviewCreate, ReviewPublic

router = APIRouter(tags=["reviews"])


def parse_app_key(app_key: str) -> dict[str, str]:
    parts = app_key.split(":", 3)
    if len(parts) != 4:
        raise HTTPException(status_code=422, detail="invalid app key")
    origin, store_arch, category, pkgname = parts
    return {"origin": origin, "store_arch": store_arch, "category": category, "pkgname": pkgname}


def get_or_create_app(db: Session, app_key: str) -> StoreApp:
    parsed = parse_app_key(app_key)
    app = db.scalar(select(StoreApp).where(StoreApp.app_key == app_key))
    if app is not None:
        return app
    app = StoreApp(app_key=app_key, latest_seen_version="", **parsed)
    db.add(app)
    db.flush()
    return app


def to_public(review: Review) -> ReviewPublic:
    return ReviewPublic(
        id=review.id,
        rating=review.rating,
        content=review.content,
        version=review.version,
        package_arch=review.package_arch,
        client_arch=review.client_arch,
        distro=review.distro,
        origin=review.origin,
        category=review.category,
        created_at=review.created_at,
        updated_at=review.updated_at,
        user_display_name=review.user.display_name,
        user_avatar_url=review.user.avatar_url,
    )


@router.post("/apps/{app_key}/reviews", response_model=ReviewPublic)
def upsert_review(
    app_key: str,
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReviewPublic:
    app = get_or_create_app(db, app_key)
    tags = payload.tags
    review = db.scalar(
        select(Review).where(
            Review.user_id == user.id,
            Review.app_id == app.id,
            Review.version == tags.version,
            Review.package_arch == tags.package_arch,
            Review.client_arch == tags.client_arch,
            Review.distro == tags.distro,
            Review.origin == tags.origin,
            Review.category == tags.category,
        )
    )
    if review is None:
        review = Review(user_id=user.id, app_id=app.id)
        db.add(review)
    review.rating = payload.rating
    review.content = payload.content.strip()
    review.version = tags.version or "unknown"
    review.package_arch = tags.package_arch or "unknown"
    review.client_arch = tags.client_arch or "unknown"
    review.distro = tags.distro or "unknown"
    review.origin = tags.origin
    review.category = tags.category
    app.latest_seen_version = review.version
    db.commit()
    db.refresh(review)
    return to_public(review)


@router.get("/apps/{app_key}/reviews", response_model=list[ReviewPublic])
def list_reviews(
    app_key: str,
    version: str | None = None,
    package_arch: str | None = None,
    client_arch: str | None = None,
    distro: str | None = None,
    origin: str | None = None,
    category: str | None = None,
    rating: int | None = Query(default=None, ge=1, le=5),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[ReviewPublic]:
    app = db.scalar(select(StoreApp).where(StoreApp.app_key == app_key))
    if app is None:
        return []
    stmt = select(Review).where(Review.app_id == app.id).order_by(Review.updated_at.desc())
    filters = {
        Review.version: version,
        Review.package_arch: package_arch,
        Review.client_arch: client_arch,
        Review.distro: distro,
        Review.origin: origin,
        Review.category: category,
        Review.rating: rating,
    }
    for column, value in filters.items():
        if value is not None:
            stmt = stmt.where(column == value)
    reviews = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return [to_public(review) for review in reviews]


@router.get("/apps/{app_key}/rating-summary", response_model=RatingSummary)
def rating_summary(app_key: str, db: Session = Depends(get_db)) -> RatingSummary:
    app = db.scalar(select(StoreApp).where(StoreApp.app_key == app_key))
    if app is None:
        return RatingSummary(average_rating=0.0, review_count=0, star_counts={star: 0 for star in range(1, 6)})
    rows = db.execute(select(Review.rating, func.count(Review.id)).where(Review.app_id == app.id).group_by(Review.rating)).all()
    star_counts = {star: 0 for star in range(1, 6)}
    total = 0
    count = 0
    for rating, rating_count in rows:
        star_counts[int(rating)] = int(rating_count)
        total += int(rating) * int(rating_count)
        count += int(rating_count)
    average = round(total / count, 2) if count else 0.0
    return RatingSummary(average_rating=average, review_count=count, star_counts=star_counts)
```

- [ ] **Step 5: Include routes**

Modify `app/api/router.py` to include:

```python
from app.api.routes import auth, reviews

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(reviews.router)
```

- [ ] **Step 6: Run review tests and verify pass**

Run: `pytest tests/test_reviews.py -v`

Expected: PASS.

- [ ] **Step 7: Commit reviews**

Run:

```bash
git add app tests/test_reviews.py
git commit -m "feat: add app reviews and ratings"
```

Expected: commit succeeds.

## Task 6: Implement App-List Sync

**Files:**
- Create: `app/schemas/app_list.py`
- Create: `app/api/routes/app_lists.py`
- Modify: `app/api/router.py`
- Test: `tests/test_app_lists.py`

- [ ] **Step 1: Write failing app-list tests**

Create `tests/test_app_lists.py` with:

```python
from app.core.security import create_access_token
from app.models.user import User


def seed_user(db_session):
    user = User(flarum_user_id="123", username="momen", display_name="Momen", avatar_url="")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def test_put_and_get_default_app_list(client, db_session):
    user = seed_user(db_session)
    response = client.put(
        "/me/app-list",
        headers=auth_headers(user),
        json={
            "client_arch": "amd64",
            "distro": "deepin 25",
            "items": [
                {
                    "pkgname": "spark-notes",
                    "origin": "spark",
                    "category": "office",
                    "version": "1.0.0",
                    "package_arch": "amd64",
                    "app_name": "Spark Notes",
                    "icon_url": "https://example.com/icon.png",
                },
                {
                    "pkgname": "wps",
                    "origin": "apm",
                    "category": "office",
                    "version": "2.0.0",
                    "package_arch": "amd64",
                    "app_name": "WPS",
                    "icon_url": "",
                },
            ],
        },
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 2

    fetched = client.get("/me/app-list", headers=auth_headers(user))

    assert fetched.status_code == 200
    assert fetched.json()["client_arch"] == "amd64"
    assert [item["pkgname"] for item in fetched.json()["items"]] == ["spark-notes", "wps"]


def test_put_default_app_list_replaces_previous_items(client, db_session):
    user = seed_user(db_session)
    headers = auth_headers(user)
    first_payload = {
        "client_arch": "amd64",
        "distro": "deepin 25",
        "items": [
            {"pkgname": "one", "origin": "spark", "category": "tools", "version": "1", "package_arch": "amd64", "app_name": "One", "icon_url": ""},
            {"pkgname": "two", "origin": "apm", "category": "tools", "version": "1", "package_arch": "amd64", "app_name": "Two", "icon_url": ""},
        ],
    }
    second_payload = {
        "client_arch": "amd64",
        "distro": "deepin 25",
        "items": [
            {"pkgname": "three", "origin": "spark", "category": "tools", "version": "1", "package_arch": "amd64", "app_name": "Three", "icon_url": ""},
        ],
    }

    assert client.put("/me/app-list", headers=headers, json=first_payload).status_code == 200
    assert client.put("/me/app-list", headers=headers, json=second_payload).status_code == 200
    fetched = client.get("/me/app-list", headers=headers)

    assert [item["pkgname"] for item in fetched.json()["items"]] == ["three"]
```

- [ ] **Step 2: Run app-list tests and verify failure**

Run: `pytest tests/test_app_lists.py -v`

Expected: FAIL with `404 Not Found` for `/me/app-list`.

- [ ] **Step 3: Add app-list schemas**

Create `app/schemas/app_list.py` with:

```python
from datetime import datetime

from pydantic import BaseModel, Field


class AppListItemIn(BaseModel):
    pkgname: str = Field(min_length=1, max_length=255)
    origin: str = Field(min_length=1, max_length=16)
    category: str = Field(min_length=1, max_length=128)
    version: str = Field(default="", max_length=255)
    package_arch: str = Field(default="unknown", max_length=64)
    app_name: str = Field(default="", max_length=255)
    icon_url: str = Field(default="", max_length=1024)


class AppListPut(BaseModel):
    client_arch: str = Field(default="unknown", max_length=64)
    distro: str = Field(default="unknown", max_length=255)
    items: list[AppListItemIn]


class AppListItemOut(AppListItemIn):
    id: int

    model_config = {"from_attributes": True}


class AppListOut(BaseModel):
    snapshot_name: str
    client_arch: str
    distro: str
    updated_at: datetime
    items: list[AppListItemOut]
```

- [ ] **Step 4: Add app-list routes**

Create `app/api/routes/app_lists.py` with:

```python
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.app_list import UserAppList, UserAppListItem
from app.models.user import User
from app.schemas.app_list import AppListOut, AppListPut

router = APIRouter(tags=["app-lists"])


def to_out(app_list: UserAppList) -> AppListOut:
    return AppListOut(
        snapshot_name=app_list.snapshot_name,
        client_arch=app_list.client_arch,
        distro=app_list.distro,
        updated_at=app_list.updated_at,
        items=list(app_list.items),
    )


@router.get("/me/app-list", response_model=AppListOut | None)
def get_app_list(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AppListOut | None:
    app_list = db.scalar(
        select(UserAppList).where(
            UserAppList.user_id == user.id,
            UserAppList.snapshot_name == "default",
        )
    )
    return to_out(app_list) if app_list else None


@router.put("/me/app-list", response_model=AppListOut)
def put_app_list(
    payload: AppListPut,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AppListOut:
    app_list = db.scalar(
        select(UserAppList).where(
            UserAppList.user_id == user.id,
            UserAppList.snapshot_name == "default",
        )
    )
    if app_list is None:
        app_list = UserAppList(user_id=user.id, snapshot_name="default")
        db.add(app_list)
        db.flush()

    app_list.client_arch = payload.client_arch
    app_list.distro = payload.distro
    app_list.items.clear()
    for item in payload.items:
        app_list.items.append(UserAppListItem(**item.model_dump()))
    db.commit()
    db.refresh(app_list)
    return to_out(app_list)
```

- [ ] **Step 5: Include routes**

Modify `app/api/router.py` to include:

```python
from app.api.routes import app_lists, auth, reviews

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(reviews.router)
api_router.include_router(app_lists.router)
```

- [ ] **Step 6: Run app-list tests and verify pass**

Run: `pytest tests/test_app_lists.py -v`

Expected: PASS.

- [ ] **Step 7: Commit app-list sync**

Run:

```bash
git add app tests/test_app_lists.py
git commit -m "feat: add app list sync api"
```

Expected: commit succeeds.

## Task 7: Final Backend Verification And Push

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document run commands**

Add this section to `README.md`:

```markdown
## Run

```bash
uvicorn app.main:app --reload
```

## Verify

```bash
pytest
alembic upgrade head
```

## API Groups

- `POST /auth/flarum`
- `GET /me`
- `GET /apps/{app_key}/rating-summary`
- `GET /apps/{app_key}/reviews`
- `POST /apps/{app_key}/reviews`
- `GET /me/app-list`
- `PUT /me/app-list`
```

- [ ] **Step 2: Run full backend tests**

Run: `pytest -v`

Expected: all tests PASS.

- [ ] **Step 3: Verify migration command**

Run: `alembic upgrade head`

Expected: command exits 0.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add README.md
git commit -m "docs: add backend run instructions"
```

Expected: commit succeeds if README changed.

- [ ] **Step 5: Push backend repository**

Run: `git push -u origin master`

Expected: push succeeds if credentials and remote permissions are available. If authentication fails, report the exact Git error and leave the local repository intact.

## Self-Review Checklist

Spec coverage:

- Flarum token validation: Task 4.
- Backend JWT: Task 4.
- Review/rating storage and filtering foundation: Task 5.
- Default app-list sync: Task 6.
- MySQL schema and migrations: Task 3.
- New Git repository and remote: Task 1.

Placeholder scan:

- The plan has no deferred implementation sections and no placeholder tasks.

Type consistency:

- User id is local integer `users.id` inside JWT `sub`.
- Flarum user id remains string `flarum_user_id`.
- App identity uses string `app_key` in all review routes.
