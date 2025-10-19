import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app import db as db_module
from app import models
from app.config import Settings
from app.db import Base, get_session
from app.main import create_app
from app.security import verify_password


@pytest.mark.asyncio
async def test_initial_admin_bootstrap_flow(bootstrap_client: AsyncClient) -> None:
    status_resp = await bootstrap_client.get("/api/auth/setup-status")
    assert status_resp.status_code == 200
    assert status_resp.json()["has_users"] is False

    payload = {
        "email": "owner@example.com",
        "full_name": "Owner",
        "password": "bootstrap-secret",
    }
    create_resp = await bootstrap_client.post("/api/auth/initial-admin", json=payload)
    assert create_resp.status_code == 201, create_resp.text
    token = create_resp.json()["access_token"]
    assert token

    # Second attempt should be rejected once an admin exists
    second_resp = await bootstrap_client.post("/api/auth/initial-admin", json=payload)
    assert second_resp.status_code == 409

    bootstrap_client.headers.update({"Authorization": f"Bearer {token}"})
    me_resp = await bootstrap_client.get("/api/users/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["role"] == "admin"

    status_after = await bootstrap_client.get("/api/auth/setup-status")
    assert status_after.status_code == 200
    assert status_after.json()["has_users"] is True


@pytest.mark.asyncio
async def test_initial_admin_accepts_form_payload(bootstrap_client: AsyncClient) -> None:
    payload = {
        "email": "bootstrap@example.com",
        "full_name": "Bootstrap Admin",
        "password": "form-secret",
    }

    response = await bootstrap_client.post(
        "/api/auth/initial-admin",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_default_admin_seed(monkeypatch) -> None:
    test_database_url = "sqlite+aiosqlite:///:memory:"
    async_engine = create_async_engine(test_database_url, echo=False)
    async_session = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_session():
        async with async_session() as session:
            yield session

    def override_settings() -> Settings:
        return Settings(
            database_url=test_database_url,
            app_name="Truetime Test API",
            default_admin_email="seed@example.com",
            default_admin_password="SeedSecret123!",
            auto_run_migrations=False,
        )

    monkeypatch.setattr("app.config.get_settings", override_settings)
    monkeypatch.setattr(db_module, "engine", async_engine)
    monkeypatch.setattr(db_module, "AsyncSessionLocal", async_session)

    from app import auth as auth_module
    from app import main as main_module
    from app import security as security_module

    monkeypatch.setattr(main_module, "engine", async_engine)
    monkeypatch.setattr(main_module, "AsyncSessionLocal", async_session)
    monkeypatch.setattr(main_module, "get_settings", override_settings)
    monkeypatch.setattr(auth_module, "get_settings", override_settings)
    monkeypatch.setattr(security_module, "get_settings", override_settings)

    app = create_app()
    app.dependency_overrides[get_session] = override_get_session

    async with app.router.lifespan_context(app):
        async with async_session() as session:
            result = await session.execute(select(models.User.email, models.User.hashed_password))
            rows = result.all()
            assert rows
            assert rows[0].email == "seed@example.com"
            assert verify_password("SeedSecret123!", rows[0].hashed_password)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.post(
                "/api/auth/token",
                data={"username": "seed@example.com", "password": "SeedSecret123!"},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            assert resp.status_code == 200, resp.text
            assert resp.json()["access_token"]

    app.dependency_overrides.clear()
    await async_engine.dispose()
