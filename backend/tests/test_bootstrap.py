import pytest
from httpx import AsyncClient


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
