from __future__ import annotations

import sys
from collections.abc import AsyncGenerator
from pathlib import Path

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import db as db_module  # noqa: E402
from app import models  # noqa: E402
from app.config import Settings  # noqa: E402
from app.db import Base, get_session  # noqa: E402
from app.main import create_app  # noqa: E402
from app.security import get_password_hash  # noqa: E402


@pytest_asyncio.fixture
async def test_app(monkeypatch) -> AsyncGenerator[FastAPI, None]:
    test_database_url = "sqlite+aiosqlite:///:memory:"

    async_engine = create_async_engine(test_database_url, echo=False)
    async_session = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with async_session() as session:
            yield session

    def override_settings() -> Settings:
        return Settings(database_url=test_database_url, app_name="Truetime Test API")

    monkeypatch.setattr("app.config.get_settings", override_settings)
    monkeypatch.setattr(db_module, "engine", async_engine)
    monkeypatch.setattr(db_module, "AsyncSessionLocal", async_session)

    from app import main as main_module  # Imported after monkeypatching config

    monkeypatch.setattr(main_module, "engine", async_engine)

    app = create_app()
    app.dependency_overrides[get_session] = override_get_session

    async with async_session() as session:
        admin = models.User(
            email="admin@example.com",
            full_name="Admin",
            hashed_password=get_password_hash("secret"),
            role=models.UserRoleEnum.ADMIN,
        )
        session.add(admin)
        await session.commit()

    yield app

    app.dependency_overrides.clear()
    await async_engine.dispose()


@pytest_asyncio.fixture
async def client(test_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/api/auth/token",
            data={"username": "admin@example.com", "password": "secret"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        token = resp.json()["access_token"]
        client.headers.update({"Authorization": f"Bearer {token}"})
        yield client
