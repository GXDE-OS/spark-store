# Spark Backend Account Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `spark-unionid-server` with forum-level profile data, favorite folders/items, downloaded-app records, API docs, deployment docs, and verification.

**Architecture:** Keep the current FastAPI + SQLAlchemy stack. Add focused ORM models and route modules for favorites/downloaded records, keep existing auth and app-list behavior compatible, and expose only authenticated user-owned resources through `/me/*` endpoints.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.x, Alembic, PyMySQL/MySQL, Pydantic, httpx, pytest.

---

## File Structure

Backend repository: `/home/spark/Desktop/shenmo-spark-store/spark-store-backend`.

Modify:
- `app/models/user.py` - add forum level fields and relationships.
- `app/models/__init__.py` - keep unchanged unless the repository later starts importing models from the package root.
- `app/db/base.py` - import new models for metadata.
- `alembic/versions/0001_initial.py` - update initial schema with new columns/tables because the repo has not shipped production migrations yet.
- `app/services/flarum.py` - extract forum groups/level from Flarum actor payload.
- `app/schemas/auth.py` - return forum fields from `/auth/flarum` and `/me`.
- `app/api/routes/auth.py` - store forum fields during auth upsert.
- `app/api/router.py` - include new routes.
- `docs/api.md` - document new endpoints.
- `docs/deployment.md` - mention upgraded migration/deploy flow remains unchanged.

Create:
- `app/models/favorite.py` - favorite folder and item ORM models.
- `app/models/downloaded_app.py` - downloaded record ORM model.
- `app/schemas/favorite.py` - favorite request/response schemas.
- `app/schemas/downloaded_app.py` - downloaded app schemas.
- `app/api/routes/favorites.py` - favorite folder/item endpoints.
- `app/api/routes/downloaded_apps.py` - downloaded app endpoints.
- `tests/test_favorites.py` - favorite behavior tests.
- `tests/test_downloaded_apps.py` - downloaded record tests.

## Task 1: Add Account Data Models And Migration

**Files:**
- Modify: `app/models/user.py`
- Modify: `app/db/base.py`
- Modify: `alembic/versions/0001_initial.py`
- Create: `app/models/favorite.py`
- Create: `app/models/downloaded_app.py`
- Test: `tests/test_account_models.py`

- [ ] **Step 1: Write failing model tests**

Create `tests/test_account_models.py` with:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.downloaded_app import DownloadedApp
from app.models.favorite import FavoriteFolder, FavoriteItem
from app.models.user import User


def test_favorite_folder_cascades_items_and_enforces_user_scope():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(flarum_user_id="123", username="momen")
        folder = FavoriteFolder(user=user, name="默认收藏夹")
        folder.items.append(
            FavoriteItem(
                app_key="app:office:wps",
                pkgname="wps",
                name="WPS",
                category="office",
                icon_url="https://example.invalid/wps.png",
            )
        )
        session.add(folder)
        session.commit()

        assert session.query(FavoriteFolder).one().name == "默认收藏夹"
        assert session.query(FavoriteItem).one().app_key == "app:office:wps"

        session.delete(folder)
        session.commit()

        assert session.query(FavoriteItem).count() == 0


def test_downloaded_app_and_forum_level_persist():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(
            flarum_user_id="123",
            username="momen",
            forum_level="管理员",
            forum_groups='["管理员"]',
        )
        session.add(user)
        session.flush()

        session.add(
            DownloadedApp(
                user_id=user.id,
                app_key="app:office:wps",
                pkgname="wps",
                name="WPS",
                category="office",
                selected_origin="apm",
                version="1.0.0",
                package_arch="amd64",
            )
        )
        session.commit()

        stored_user = session.query(User).one()
        stored_download = session.query(DownloadedApp).one()
        assert stored_user.forum_level == "管理员"
        assert stored_user.forum_groups == '["管理员"]'
        assert stored_download.selected_origin == "apm"
```

- [ ] **Step 2: Run model tests and verify failure**

Run: `.venv/bin/pytest tests/test_account_models.py -v`

Expected: FAIL with `ModuleNotFoundError` for `app.models.downloaded_app` or `app.models.favorite`.

- [ ] **Step 3: Add favorite models**

Create `app/models/favorite.py` with:

```python
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FavoriteFolder(Base):
    __tablename__ = "favorite_folders"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_favorite_folders_user_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(128), default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="favorite_folders")
    items: Mapped[list["FavoriteItem"]] = relationship(
        back_populates="folder",
        cascade="all, delete-orphan",
    )


class FavoriteItem(Base):
    __tablename__ = "favorite_items"
    __table_args__ = (
        UniqueConstraint("folder_id", "app_key", name="uq_favorite_items_folder_app"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    folder_id: Mapped[int] = mapped_column(ForeignKey("favorite_folders.id"), index=True)
    app_key: Mapped[str] = mapped_column(String(512), index=True)
    pkgname: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255), default="", server_default="")
    category: Mapped[str] = mapped_column(String(128), default="", server_default="")
    icon_url: Mapped[str] = mapped_column(String(1024), default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    folder: Mapped[FavoriteFolder] = relationship(back_populates="items")
```

- [ ] **Step 4: Add downloaded app model**

Create `app/models/downloaded_app.py` with:

```python
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DownloadedApp(Base):
    __tablename__ = "downloaded_apps"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    app_key: Mapped[str] = mapped_column(String(512), index=True)
    pkgname: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255), default="", server_default="")
    category: Mapped[str] = mapped_column(String(128), default="", server_default="")
    selected_origin: Mapped[str] = mapped_column(String(16), default="", server_default="")
    version: Mapped[str] = mapped_column(String(255), default="", server_default="")
    package_arch: Mapped[str] = mapped_column(String(64), default="", server_default="")
    downloaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    user: Mapped["User"] = relationship(back_populates="downloaded_apps")
```

- [ ] **Step 5: Update user model relationships and forum fields**

Modify `app/models/user.py` to include:

```python
from app.models.downloaded_app import DownloadedApp  # only under TYPE_CHECKING
from app.models.favorite import FavoriteFolder  # only under TYPE_CHECKING
```

Inside the `User` class after `avatar_url`:

```python
    forum_level: Mapped[str] = mapped_column(String(128), default="论坛用户", server_default="论坛用户")
    forum_groups: Mapped[str] = mapped_column(String(1024), default="[]", server_default="[]")
```

Inside the `User` class after `app_lists`:

```python
    favorite_folders: Mapped[list["FavoriteFolder"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    downloaded_apps: Mapped[list["DownloadedApp"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
```

- [ ] **Step 6: Import new models in base metadata**

Modify `app/db/base.py` to import:

```python
from app.models.downloaded_app import DownloadedApp  # noqa: E402,F401
from app.models.favorite import FavoriteFolder, FavoriteItem  # noqa: E402,F401
```

- [ ] **Step 7: Update initial migration**

Modify `alembic/versions/0001_initial.py`:

1. Add `forum_level` and `forum_groups` columns to `users` after `avatar_url`.
2. Create `favorite_folders`, `favorite_items`, and `downloaded_apps` tables after `users` and before dependent reads are needed.
3. Add indexes and unique constraints matching the models.
4. Drop those tables in `downgrade()` before dropping `users`.

Use these column definitions:

```python
sa.Column("forum_level", sa.String(length=128), server_default="论坛用户", nullable=False),
sa.Column("forum_groups", sa.String(length=1024), server_default="[]", nullable=False),
```

Use these table definitions:

```python
op.create_table(
    "favorite_folders",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("user_id", sa.Integer(), nullable=False),
    sa.Column("name", sa.String(length=128), server_default="", nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=utc_now, nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=utc_now, nullable=False),
    sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("user_id", "name", name="uq_favorite_folders_user_name"),
)
op.create_index(op.f("ix_favorite_folders_user_id"), "favorite_folders", ["user_id"], unique=False)

op.create_table(
    "favorite_items",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("folder_id", sa.Integer(), nullable=False),
    sa.Column("app_key", sa.String(length=512), nullable=False),
    sa.Column("pkgname", sa.String(length=255), nullable=False),
    sa.Column("name", sa.String(length=255), server_default="", nullable=False),
    sa.Column("category", sa.String(length=128), server_default="", nullable=False),
    sa.Column("icon_url", sa.String(length=1024), server_default="", nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=utc_now, nullable=False),
    sa.ForeignKeyConstraint(["folder_id"], ["favorite_folders.id"]),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("folder_id", "app_key", name="uq_favorite_items_folder_app"),
)
op.create_index(op.f("ix_favorite_items_app_key"), "favorite_items", ["app_key"], unique=False)
op.create_index(op.f("ix_favorite_items_folder_id"), "favorite_items", ["folder_id"], unique=False)
op.create_index(op.f("ix_favorite_items_pkgname"), "favorite_items", ["pkgname"], unique=False)

op.create_table(
    "downloaded_apps",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("user_id", sa.Integer(), nullable=False),
    sa.Column("app_key", sa.String(length=512), nullable=False),
    sa.Column("pkgname", sa.String(length=255), nullable=False),
    sa.Column("name", sa.String(length=255), server_default="", nullable=False),
    sa.Column("category", sa.String(length=128), server_default="", nullable=False),
    sa.Column("selected_origin", sa.String(length=16), server_default="", nullable=False),
    sa.Column("version", sa.String(length=255), server_default="", nullable=False),
    sa.Column("package_arch", sa.String(length=64), server_default="", nullable=False),
    sa.Column("downloaded_at", sa.DateTime(timezone=True), server_default=utc_now, nullable=False),
    sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    sa.PrimaryKeyConstraint("id"),
)
op.create_index(op.f("ix_downloaded_apps_app_key"), "downloaded_apps", ["app_key"], unique=False)
op.create_index(op.f("ix_downloaded_apps_downloaded_at"), "downloaded_apps", ["downloaded_at"], unique=False)
op.create_index(op.f("ix_downloaded_apps_pkgname"), "downloaded_apps", ["pkgname"], unique=False)
op.create_index(op.f("ix_downloaded_apps_user_id"), "downloaded_apps", ["user_id"], unique=False)
```

- [ ] **Step 8: Run model tests and migration verification**

Run:

```bash
.venv/bin/pytest tests/test_account_models.py -v
DATABASE_URL="sqlite:////tmp/opencode/spark-backend-account-models.sqlite3" .venv/bin/alembic upgrade head
```

Expected: model tests PASS and Alembic exits 0.

- [ ] **Step 9: Run full backend tests**

Run: `.venv/bin/pytest -v`

Expected: all tests PASS.

- [ ] **Step 10: Commit account models**

Run:

```bash
git add app/models app/db/base.py alembic/versions/0001_initial.py tests/test_account_models.py
git commit -m "feat(account): add collection data models"
```

Expected: commit succeeds.

## Task 2: Add Forum Level To Auth Profile

**Files:**
- Modify: `app/services/flarum.py`
- Modify: `app/schemas/auth.py`
- Modify: `app/api/routes/auth.py`
- Test: `tests/test_auth.py`
- Test: `tests/test_flarum_service.py`

- [ ] **Step 1: Add failing Flarum group extraction tests**

Append to `tests/test_flarum_service.py`:

```python
@pytest.mark.anyio
async def test_fetch_flarum_profile_maps_forum_groups(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api"
        assert request.headers["Authorization"] == "Token forum-token"
        return httpx.Response(
            200,
            json={
                "data": {
                    "relationships": {
                        "actor": {"data": {"type": "users", "id": "123"}}
                    }
                },
                "included": [
                    {
                        "type": "users",
                        "id": "123",
                        "attributes": {
                            "username": "momen",
                            "displayName": "Momen",
                            "avatarUrl": "https://bbs.spark-app.store/avatar.png",
                        },
                        "relationships": {
                            "groups": {
                                "data": [{"type": "groups", "id": "1"}]
                            }
                        },
                    },
                    {
                        "type": "groups",
                        "id": "1",
                        "attributes": {"nameSingular": "管理员"},
                    },
                ],
            },
        )

    mock_async_client(monkeypatch, handler)

    profile = await fetch_flarum_profile("forum-token", "123")

    assert profile["forum_level"] == "管理员"
    assert profile["forum_groups"] == '["管理员"]'


@pytest.mark.anyio
async def test_fetch_flarum_profile_falls_back_to_forum_user_level(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api"
        return httpx.Response(
            200,
            json={
                "data": {
                    "relationships": {
                        "actor": {"data": {"type": "users", "id": "123"}}
                    }
                },
                "included": [
                    {
                        "type": "users",
                        "id": "123",
                        "attributes": {
                            "username": "momen",
                            "displayName": "Momen",
                            "avatarUrl": "https://bbs.spark-app.store/avatar.png",
                        },
                    }
                ],
            },
        )

    mock_async_client(monkeypatch, handler)

    profile = await fetch_flarum_profile("forum-token", "123")

    assert profile["forum_level"] == "论坛用户"
    assert profile["forum_groups"] == "[]"
```

- [ ] **Step 2: Add failing auth response test**

Append to `tests/test_auth.py`:

```python
def test_auth_flarum_returns_forum_level(client, monkeypatch):
    async def fake_fetch_profile(token: str, user_id: str):
        return {
            "flarum_user_id": user_id,
            "username": "momen",
            "display_name": "Momen",
            "avatar_url": "https://bbs.spark-app.store/avatar.png",
            "forum_level": "管理员",
            "forum_groups": '["管理员"]',
        }

    monkeypatch.setattr("app.api.routes.auth.fetch_flarum_profile", fake_fetch_profile)

    response = client.post(
        "/auth/flarum",
        json={"flarum_user_id": "123", "flarum_token": "forum-token"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["forum_level"] == "管理员"
    assert response.json()["user"]["forum_groups"] == '["管理员"]'
```

- [ ] **Step 3: Run auth tests and verify failure**

Run: `.venv/bin/pytest tests/test_auth.py tests/test_flarum_service.py -v`

Expected: FAIL because `forum_level` and `forum_groups` are not returned/mapped.

- [ ] **Step 4: Extend auth schema**

Modify `app/schemas/auth.py` `UserPublic`:

```python
class UserPublic(BaseModel):
    id: int
    flarum_user_id: str
    username: str
    display_name: str
    avatar_url: str
    forum_level: str
    forum_groups: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 5: Store forum fields during auth**

Modify `app/api/routes/auth.py` after avatar assignment:

```python
    user.forum_level = profile.get("forum_level", "论坛用户")
    user.forum_groups = profile.get("forum_groups", "[]")
```

- [ ] **Step 6: Extract groups in Flarum service**

Modify `app/services/flarum.py` to:

1. Return user resource and attributes from `_find_included_user` instead of only attributes.
2. Extract group names from included `groups` resources referenced by user relationships.
3. Return fallback `forum_level: "论坛用户"` and `forum_groups: "[]"` when no groups are present.

Add helper:

```python
import json


def _extract_group_names(user_resource: dict, included: list[dict]) -> list[str]:
    relationships = user_resource.get("relationships", {})
    groups = relationships.get("groups", {}) if isinstance(relationships, dict) else {}
    group_refs = groups.get("data", []) if isinstance(groups, dict) else []
    if not isinstance(group_refs, list):
        return []

    wanted_ids = {
        str(ref.get("id"))
        for ref in group_refs
        if isinstance(ref, dict) and ref.get("type") == "groups" and ref.get("id") is not None
    }
    names: list[str] = []
    for resource in included:
        if not isinstance(resource, dict):
            raise ValueError("malformed Flarum forum payload")
        if resource.get("type") != "groups" or str(resource.get("id")) not in wanted_ids:
            continue
        attrs = resource.get("attributes", {})
        if not isinstance(attrs, dict):
            raise ValueError("malformed Flarum forum payload")
        name = attrs.get("nameSingular") or attrs.get("namePlural") or attrs.get("name")
        if isinstance(name, str) and name:
            names.append(name)
    return names
```

The final return dict from `fetch_flarum_profile` must include:

```python
"forum_level": group_names[0] if group_names else "论坛用户",
"forum_groups": json.dumps(group_names, ensure_ascii=False),
```

- [ ] **Step 7: Run auth tests**

Run: `.venv/bin/pytest tests/test_auth.py tests/test_flarum_service.py -v`

Expected: PASS.

- [ ] **Step 8: Run full backend tests**

Run: `.venv/bin/pytest -v`

Expected: all tests PASS.

- [ ] **Step 9: Commit forum profile extension**

Run:

```bash
git add app/services/flarum.py app/schemas/auth.py app/api/routes/auth.py tests/test_auth.py tests/test_flarum_service.py
git commit -m "feat(account): expose forum level"
```

Expected: commit succeeds.

## Task 3: Add Favorite Folder API

**Files:**
- Create: `app/schemas/favorite.py`
- Create: `app/api/routes/favorites.py`
- Modify: `app/api/router.py`
- Test: `tests/test_favorites.py`

- [ ] **Step 1: Write failing favorite API tests**

Create `tests/test_favorites.py` with:

```python
from app.core.security import create_access_token
from app.models.user import User


def seed_user(db_session, flarum_user_id="123"):
    user = User(flarum_user_id=flarum_user_id, username=f"user-{flarum_user_id}")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def test_create_list_rename_and_delete_favorite_folder(client, db_session):
    user = seed_user(db_session)
    headers = auth_headers(user)

    created = client.post("/me/favorite-folders", headers=headers, json={"name": "办公"})
    assert created.status_code == 200
    folder_id = created.json()["id"]
    assert created.json()["name"] == "办公"
    assert created.json()["item_count"] == 0

    listed = client.get("/me/favorite-folders", headers=headers)
    assert [folder["name"] for folder in listed.json()] == ["办公"]

    renamed = client.patch(
        f"/me/favorite-folders/{folder_id}",
        headers=headers,
        json={"name": "生产力"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "生产力"

    deleted = client.delete(f"/me/favorite-folders/{folder_id}", headers=headers)
    assert deleted.status_code == 204
    assert client.get("/me/favorite-folders", headers=headers).json() == []


def test_default_folder_created_when_adding_first_favorite(client, db_session):
    user = seed_user(db_session)
    headers = auth_headers(user)

    response = client.post(
        "/me/favorite-folders/default/items",
        headers=headers,
        json={
            "app_key": "app:office:wps",
            "pkgname": "wps",
            "name": "WPS",
            "category": "office",
            "icon_url": "https://example.invalid/wps.png",
        },
    )

    assert response.status_code == 200
    assert response.json()["app_key"] == "app:office:wps"
    folders = client.get("/me/favorite-folders", headers=headers).json()
    assert folders[0]["name"] == "默认收藏夹"
    assert folders[0]["item_count"] == 1


def test_favorite_folders_are_isolated_by_user(client, db_session):
    user_one = seed_user(db_session, "1")
    user_two = seed_user(db_session, "2")

    assert client.post("/me/favorite-folders", headers=auth_headers(user_one), json={"name": "A"}).status_code == 200
    assert client.get("/me/favorite-folders", headers=auth_headers(user_two)).json() == []
```

- [ ] **Step 2: Run favorite tests and verify failure**

Run: `.venv/bin/pytest tests/test_favorites.py -v`

Expected: FAIL with 404 for favorite endpoints or missing schemas.

- [ ] **Step 3: Add favorite schemas**

Create `app/schemas/favorite.py` with:

```python
from datetime import datetime

from pydantic import BaseModel, Field


class FavoriteFolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)

    model_config = {"extra": "forbid"}


class FavoriteFolderUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128)

    model_config = {"extra": "forbid"}


class FavoriteFolderPublic(BaseModel):
    id: int
    name: str
    item_count: int
    created_at: datetime
    updated_at: datetime


class FavoriteItemCreate(BaseModel):
    app_key: str = Field(min_length=1, max_length=512)
    pkgname: str = Field(min_length=1, max_length=255)
    name: str = Field(default="", max_length=255)
    category: str = Field(min_length=1, max_length=128)
    icon_url: str = Field(default="", max_length=1024)

    model_config = {"extra": "forbid"}


class FavoriteItemPublic(BaseModel):
    id: int
    app_key: str
    pkgname: str
    name: str
    category: str
    icon_url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FavoriteBulkDelete(BaseModel):
    item_ids: list[int]

    model_config = {"extra": "forbid"}
```

- [ ] **Step 4: Add favorite routes**

Create `app/api/routes/favorites.py` with:

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.favorite import FavoriteFolder, FavoriteItem
from app.models.user import User
from app.schemas.favorite import (
    FavoriteBulkDelete,
    FavoriteFolderCreate,
    FavoriteFolderPublic,
    FavoriteFolderUpdate,
    FavoriteItemCreate,
    FavoriteItemPublic,
)

router = APIRouter()
DEFAULT_FOLDER_NAME = "默认收藏夹"


def folder_to_public(folder: FavoriteFolder) -> FavoriteFolderPublic:
    return FavoriteFolderPublic(
        id=folder.id,
        name=folder.name,
        item_count=len(folder.items),
        created_at=folder.created_at,
        updated_at=folder.updated_at,
    )


def get_user_folder(db: Session, user_id: int, folder_id: int) -> FavoriteFolder:
    folder = db.scalar(
        select(FavoriteFolder)
        .options(selectinload(FavoriteFolder.items))
        .where(FavoriteFolder.id == folder_id, FavoriteFolder.user_id == user_id)
    )
    if folder is None:
        raise HTTPException(status_code=404, detail="Favorite folder not found")
    return folder


def get_or_create_default_folder(db: Session, user_id: int) -> FavoriteFolder:
    folder = db.scalar(
        select(FavoriteFolder)
        .options(selectinload(FavoriteFolder.items))
        .where(FavoriteFolder.user_id == user_id, FavoriteFolder.name == DEFAULT_FOLDER_NAME)
    )
    if folder is not None:
        return folder
    folder = FavoriteFolder(user_id=user_id, name=DEFAULT_FOLDER_NAME)
    db.add(folder)
    db.flush()
    return folder


@router.get("/me/favorite-folders", response_model=list[FavoriteFolderPublic])
def list_favorite_folders(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[FavoriteFolderPublic]:
    folders = db.scalars(
        select(FavoriteFolder)
        .options(selectinload(FavoriteFolder.items))
        .where(FavoriteFolder.user_id == current_user.id)
        .order_by(FavoriteFolder.updated_at.desc(), FavoriteFolder.id.desc())
    ).all()
    return [folder_to_public(folder) for folder in folders]


@router.post("/me/favorite-folders", response_model=FavoriteFolderPublic)
def create_favorite_folder(
    payload: FavoriteFolderCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FavoriteFolderPublic:
    exists = db.scalar(
        select(FavoriteFolder.id).where(
            FavoriteFolder.user_id == current_user.id,
            FavoriteFolder.name == payload.name.strip(),
        )
    )
    if exists is not None:
        raise HTTPException(status_code=409, detail="Favorite folder already exists")
    folder = FavoriteFolder(user_id=current_user.id, name=payload.name.strip())
    db.add(folder)
    db.commit()
    db.refresh(folder)
    folder.items = []
    return folder_to_public(folder)


@router.patch("/me/favorite-folders/{folder_id}", response_model=FavoriteFolderPublic)
def rename_favorite_folder(
    folder_id: int,
    payload: FavoriteFolderUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FavoriteFolderPublic:
    folder = get_user_folder(db, current_user.id, folder_id)
    folder.name = payload.name.strip()
    db.commit()
    stored = get_user_folder(db, current_user.id, folder_id)
    return folder_to_public(stored)


@router.delete("/me/favorite-folders/{folder_id}", status_code=204)
def delete_favorite_folder(
    folder_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    folder = get_user_folder(db, current_user.id, folder_id)
    db.delete(folder)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/favorite-folders/{folder_id}/items", response_model=list[FavoriteItemPublic])
def list_favorite_items(
    folder_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[FavoriteItem]:
    folder = get_user_folder(db, current_user.id, folder_id)
    return sorted(folder.items, key=lambda item: item.id)


@router.post("/me/favorite-folders/{folder_id}/items", response_model=FavoriteItemPublic)
def add_favorite_item(
    folder_id: int | str,
    payload: FavoriteItemCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FavoriteItem:
    folder = (
        get_or_create_default_folder(db, current_user.id)
        if folder_id == "default"
        else get_user_folder(db, current_user.id, int(folder_id))
    )
    item = db.scalar(
        select(FavoriteItem).where(
            FavoriteItem.folder_id == folder.id,
            FavoriteItem.app_key == payload.app_key,
        )
    )
    if item is None:
        item = FavoriteItem(folder_id=folder.id, **payload.model_dump())
        db.add(item)
    else:
        item.pkgname = payload.pkgname
        item.name = payload.name
        item.category = payload.category
        item.icon_url = payload.icon_url
    db.commit()
    db.refresh(item)
    return item


@router.delete("/me/favorite-folders/{folder_id}/items/{item_id}", status_code=204)
def delete_favorite_item(
    folder_id: int,
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    get_user_folder(db, current_user.id, folder_id)
    item = db.get(FavoriteItem, item_id)
    if item is None or item.folder_id != folder_id:
        raise HTTPException(status_code=404, detail="Favorite item not found")
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/me/favorite-folders/{folder_id}/items/bulk-delete")
def bulk_delete_favorite_items(
    folder_id: int,
    payload: FavoriteBulkDelete,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, int]:
    get_user_folder(db, current_user.id, folder_id)
    items = db.scalars(
        select(FavoriteItem).where(
            FavoriteItem.folder_id == folder_id,
            FavoriteItem.id.in_(payload.item_ids),
        )
    ).all()
    deleted_count = len(items)
    for item in items:
        db.delete(item)
    db.commit()
    return {"deleted_count": deleted_count}
```

- [ ] **Step 5: Include favorite router**

Modify `app/api/router.py`:

```python
from app.api.routes.favorites import router as favorites_router

api_router.include_router(favorites_router)
```

- [ ] **Step 6: Run favorite tests**

Run: `.venv/bin/pytest tests/test_favorites.py -v`

Expected: PASS.

- [ ] **Step 7: Run full backend tests**

Run: `.venv/bin/pytest -v`

Expected: all tests PASS.

- [ ] **Step 8: Commit favorite API**

Run:

```bash
git add app/schemas/favorite.py app/api/routes/favorites.py app/api/router.py tests/test_favorites.py
git commit -m "feat(account): add favorite folders api"
```

Expected: commit succeeds.

## Task 4: Add Downloaded Apps API

**Files:**
- Create: `app/schemas/downloaded_app.py`
- Create: `app/api/routes/downloaded_apps.py`
- Modify: `app/api/router.py`
- Test: `tests/test_downloaded_apps.py`

- [ ] **Step 1: Write failing downloaded app API tests**

Create `tests/test_downloaded_apps.py` with:

```python
from app.core.security import create_access_token
from app.models.user import User


def seed_user(db_session, flarum_user_id="123"):
    user = User(flarum_user_id=flarum_user_id, username=f"user-{flarum_user_id}")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def test_create_and_list_downloaded_apps(client, db_session):
    user = seed_user(db_session)
    headers = auth_headers(user)

    created = client.post(
        "/me/downloaded-apps",
        headers=headers,
        json={
            "app_key": "app:office:wps",
            "pkgname": "wps",
            "name": "WPS",
            "category": "office",
            "selected_origin": "apm",
            "version": "1.0.0",
            "package_arch": "amd64",
        },
    )

    assert created.status_code == 200
    assert created.json()["selected_origin"] == "apm"

    listed = client.get("/me/downloaded-apps", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["items"][0]["pkgname"] == "wps"
    assert listed.json()["total"] == 1


def test_downloaded_apps_are_isolated_by_user(client, db_session):
    user_one = seed_user(db_session, "1")
    user_two = seed_user(db_session, "2")
    response = client.post(
        "/me/downloaded-apps",
        headers=auth_headers(user_one),
        json={
            "app_key": "app:office:wps",
            "pkgname": "wps",
            "name": "WPS",
            "category": "office",
            "selected_origin": "apm",
            "version": "1.0.0",
            "package_arch": "amd64",
        },
    )
    assert response.status_code == 200

    listed = client.get("/me/downloaded-apps", headers=auth_headers(user_two))
    assert listed.json()["items"] == []
    assert listed.json()["total"] == 0
```

- [ ] **Step 2: Run downloaded app tests and verify failure**

Run: `.venv/bin/pytest tests/test_downloaded_apps.py -v`

Expected: FAIL with 404 for `/me/downloaded-apps`.

- [ ] **Step 3: Add downloaded app schemas**

Create `app/schemas/downloaded_app.py` with:

```python
from datetime import datetime

from pydantic import BaseModel, Field


class DownloadedAppCreate(BaseModel):
    app_key: str = Field(min_length=1, max_length=512)
    pkgname: str = Field(min_length=1, max_length=255)
    name: str = Field(default="", max_length=255)
    category: str = Field(min_length=1, max_length=128)
    selected_origin: str = Field(min_length=1, max_length=16)
    version: str = Field(default="", max_length=255)
    package_arch: str = Field(default="", max_length=64)

    model_config = {"extra": "forbid"}


class DownloadedAppPublic(BaseModel):
    id: int
    app_key: str
    pkgname: str
    name: str
    category: str
    selected_origin: str
    version: str
    package_arch: str
    downloaded_at: datetime

    model_config = {"from_attributes": True}


class DownloadedAppList(BaseModel):
    items: list[DownloadedAppPublic]
    total: int
    page: int
    page_size: int
```

- [ ] **Step 4: Add downloaded app routes**

Create `app/api/routes/downloaded_apps.py` with:

```python
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.downloaded_app import DownloadedApp
from app.models.user import User
from app.schemas.downloaded_app import DownloadedAppCreate, DownloadedAppList, DownloadedAppPublic

router = APIRouter()


@router.post("/me/downloaded-apps", response_model=DownloadedAppPublic)
def create_downloaded_app(
    payload: DownloadedAppCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DownloadedApp:
    record = DownloadedApp(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/me/downloaded-apps", response_model=DownloadedAppList)
def list_downloaded_apps(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> DownloadedAppList:
    total = db.scalar(
        select(func.count(DownloadedApp.id)).where(DownloadedApp.user_id == current_user.id)
    ) or 0
    items = db.scalars(
        select(DownloadedApp)
        .where(DownloadedApp.user_id == current_user.id)
        .order_by(DownloadedApp.downloaded_at.desc(), DownloadedApp.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return DownloadedAppList(items=list(items), total=total, page=page, page_size=page_size)
```

- [ ] **Step 5: Include downloaded app router**

Modify `app/api/router.py`:

```python
from app.api.routes.downloaded_apps import router as downloaded_apps_router

api_router.include_router(downloaded_apps_router)
```

- [ ] **Step 6: Run downloaded app tests**

Run: `.venv/bin/pytest tests/test_downloaded_apps.py -v`

Expected: PASS.

- [ ] **Step 7: Run full backend tests**

Run: `.venv/bin/pytest -v`

Expected: all tests PASS.

- [ ] **Step 8: Commit downloaded app API**

Run:

```bash
git add app/schemas/downloaded_app.py app/api/routes/downloaded_apps.py app/api/router.py tests/test_downloaded_apps.py
git commit -m "feat(account): add downloaded apps api"
```

Expected: commit succeeds.

## Task 5: Update Backend API And Deployment Docs

**Files:**
- Modify: `docs/api.md`
- Modify: `docs/deployment.md`
- Modify: `README.md`

- [ ] **Step 1: Document user profile fields**

Modify `docs/api.md` auth response examples so `user` includes:

```json
{
  "forum_level": "管理员",
  "forum_groups": "[\"管理员\"]"
}
```

Include text: `forum_level` falls back to `论坛用户` when Flarum group data is unavailable.

- [ ] **Step 2: Document favorite endpoints**

Append to `docs/api.md`:

```markdown
## Favorites

All favorite endpoints require bearer JWT. Favorites store app-level identities in the format `app:{category}:{pkgname}` and do not permanently bind to Spark or APM.

### `GET /me/favorite-folders`

Returns folders with `item_count`.

### `POST /me/favorite-folders`

Request: `{ "name": "办公" }`.

### `PATCH /me/favorite-folders/{folder_id}`

Request: `{ "name": "生产力" }`.

### `DELETE /me/favorite-folders/{folder_id}`

Deletes a folder and its items.

### `GET /me/favorite-folders/{folder_id}/items`

Returns favorite items.

### `POST /me/favorite-folders/{folder_id}/items`

Use `folder_id` or `default`. `default` creates `默认收藏夹` when needed.

Request:
```json
{
  "app_key": "app:office:wps",
  "pkgname": "wps",
  "name": "WPS",
  "category": "office",
  "icon_url": "https://example.invalid/wps.png"
}
```

### `DELETE /me/favorite-folders/{folder_id}/items/{item_id}`

Removes one item.

### `POST /me/favorite-folders/{folder_id}/items/bulk-delete`

Request: `{ "item_ids": [1, 2, 3] }`.
```
```

- [ ] **Step 3: Document downloaded endpoints**

Append to `docs/api.md`:

```markdown
## Downloaded Apps

All downloaded-app endpoints require bearer JWT.

### `GET /me/downloaded-apps`

Query parameters: `page`, `page_size`.

### `POST /me/downloaded-apps`

Request:
```json
{
  "app_key": "app:office:wps",
  "pkgname": "wps",
  "name": "WPS",
  "category": "office",
  "selected_origin": "apm",
  "version": "1.0.0",
  "package_arch": "amd64"
}
```
```
```

- [ ] **Step 4: Update deployment guide**

Modify `docs/deployment.md` upgrade section to mention that deployments must run Alembic after pulling because account collection tables are included in the initial schema for fresh installs.

- [ ] **Step 5: Run docs-adjacent verification**

Run:

```bash
.venv/bin/pytest -v
DATABASE_URL="sqlite:////tmp/opencode/spark-backend-account-docs.sqlite3" .venv/bin/alembic upgrade head
```

Expected: tests PASS and Alembic exits 0.

- [ ] **Step 6: Commit docs**

Run:

```bash
git add docs/api.md docs/deployment.md README.md
git commit -m "docs(account): document collection endpoints"
```

Expected: commit succeeds if files changed.

## Task 6: Final Backend Verification And Push

**Files:**
- Verify only.

- [ ] **Step 1: Run full backend tests**

Run: `.venv/bin/pytest -v`

Expected: all tests PASS.

- [ ] **Step 2: Verify migration on a fresh database URL**

Run:

```bash
DATABASE_URL="sqlite:////tmp/opencode/spark-backend-account-final.sqlite3" .venv/bin/alembic upgrade head
```

Expected: command exits 0.

- [ ] **Step 3: Check git status**

Run: `git status --short --branch`

Expected: branch is clean and ahead of `origin/master` by the new backend commits.

- [ ] **Step 4: Push backend**

Run: `git push origin master`

Expected: push succeeds to `https://gitee.com/erotica-rbqs/spark-unionid-server`. If authentication fails, report exact error and leave local repo intact.

## Self-Review Checklist

Spec coverage:

- Forum level data: Task 2.
- Favorite folders/items and default folder: Tasks 1 and 3.
- Downloaded records: Tasks 1 and 4.
- API/deployment docs: Task 5.
- Final backend verification and push: Task 6.

Placeholder scan:

- No placeholder sections remain. Tests, request payloads, and implementation snippets are concrete.

Type consistency:

- Favorite app key uses `app:{category}:{pkgname}`.
- Backend field names remain snake_case.
- `forum_groups` is a JSON-encoded string to keep the existing response schema simple.
