---
name: python-development
description: >-
  Modern Python development, FastAPI, Pydantic v2, SQLAlchemy 2.0, pytest testing, async programming, and packaging.
  Use this skill when building Python backends, designing async APIs, configuring database ORMs, writing pytest suites,
  implementing type hints with mypy/ruff, or managing Python dependencies with uv/poetry.
---

# Modern Python Engineering Runbook

This skill establishes development standards, typing practices, async architecture, testing guidelines, and packaging conventions for Python 3.11+ applications.

---

## 1. Modern Python Idioms & Strict Typing

### A. Type Annotations & Pydantic v2
- Use Python 3.10+ native union operators (`int | None` instead of `Optional[int]`).
- Use `Pydantic v2` models for data validation, serialization, and settings management:

```python
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from datetime import datetime
from uuid import UUID, uuid4

class UserCreateDTO(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)

    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=100)
    is_active: bool = True

class UserResponseDTO(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime
```

---

## 2. High-Performance Web APIs with FastAPI

```python
from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

app = FastAPI(title="Production API", version="1.0.0")

@app.get(
    "/api/v1/items",
    response_model=list[ItemResponseDTO],
    status_code=status.HTTP_200_OK,
    tags=["Items"]
)
async def list_items(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[ItemResponseDTO]:
    service = ItemService(db)
    return await service.get_items(user_id=current_user.id, limit=limit, offset=offset)
```

---

## 3. SQLAlchemy 2.0 & Async Database Operations

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, func
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class OrderModel(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

# Async query execution pattern
async def get_order_by_id(session: AsyncSession, order_id: uuid.UUID) -> OrderModel | None:
    result = await session.execute(
        select(OrderModel).where(OrderModel.id == order_id)
    )
    return result.scalar_one_or_none()
```

---

## 4. Pytest & Asynchronous Testing

```python
import pytest
from httpx import AsyncClient
from uuid import uuid4

@pytest.fixture
def sample_payload():
    return {
        "email": f"test-{uuid4().hex[:6]}@example.com",
        "full_name": "Test User",
    }

@pytest.mark.asyncio
async def test_create_user_success(async_client: AsyncClient, sample_payload: dict):
    response = await async_client.post("/api/v1/users", json=sample_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == sample_payload["email"]
    assert "id" in data
```

---

## 5. Tooling & Linting Standards

- **Linter / Formatter**: Use `ruff` for ultra-fast linting and formatting:
  ```bash
  ruff check . --fix
  ruff format .
  ```
- **Type Checker**: Use `mypy` with strict configuration:
  ```bash
  mypy . --strict
  ```
- **Package Management**: Use `uv` or `poetry` for deterministic dependency resolution and lockfiles.

---

## 6. Python Engineering Quality Checklist

- [ ] All functions have complete type annotations.
- [ ] Pydantic models enforce strict schema validation.
- [ ] Database sessions handled via async context managers with automatic rollback on exception.
- [ ] All environment secrets loaded via `pydantic-settings` or `.env` files.
- [ ] Unit and integration test suites run cleanly with `pytest`.
