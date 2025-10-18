from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_employee_and_device_registration(client: AsyncClient) -> None:
    employee_payload = {
        "code": "EMP001",
        "first_name": "John",
        "last_name": "Doe",
        "department": "Engineering",
    }
    employee_resp = await client.post("/api/employees", json=employee_payload)
    assert employee_resp.status_code == 201, employee_resp.text
    data = employee_resp.json()
    assert data["code"] == employee_payload["code"]

    device_payload = {
        "name": "HQ Entry",
        "model": "X990",
        "serial_number": "SN123",
        "ip_address": "192.168.0.10",
    }
    device_resp = await client.post("/api/devices", json=device_payload)
    assert device_resp.status_code == 201, device_resp.text
    device_data = device_resp.json()
    assert device_data["serial_number"] == device_payload["serial_number"]


@pytest.mark.asyncio
async def test_log_ingestion_flow(client: AsyncClient) -> None:
    await client.post(
        "/api/employees",
        json={"code": "EMP123", "first_name": "Ava", "last_name": "Singh", "department": "HR"},
    )
    await client.post(
        "/api/devices",
        json={"name": "HQ Entry", "model": "X990", "serial_number": "SN001", "ip_address": "10.0.0.20"},
    )

    payload = {
        "employee_code": "EMP123",
        "device_serial": "SN001",
        "punched_at": datetime.now(timezone.utc).isoformat(),
        "direction": "in",
        "raw_payload": "sample",
        "external_id": 1,
    }
    resp = await client.post("/api/attendance/logs", json=payload)
    assert resp.status_code == 201, resp.text
    log_data = resp.json()
    assert log_data["employee"]["code"] == "EMP123"
    assert log_data["device"]["serial_number"] == "SN001"
    assert log_data["external_id"] == 1

    list_resp = await client.get("/api/attendance/logs")
    assert list_resp.status_code == 200
    payload = list_resp.json()
    assert payload["total"] == 1
    assert len(payload["items"]) == 1
    assert payload["items"][0]["external_id"] == 1


@pytest.mark.asyncio
async def test_duplicate_external_ids_are_ignored(client: AsyncClient) -> None:
    await client.post(
        "/api/employees",
        json={"code": "EMP555", "first_name": "Mia", "last_name": "Wong"},
    )
    await client.post(
        "/api/devices",
        json={"name": "HQ Entry", "model": "X990", "serial_number": "SN005", "ip_address": "10.0.0.50"},
    )

    payload = {
        "employee_code": "EMP555",
        "device_serial": "SN005",
        "punched_at": datetime.now(timezone.utc).isoformat(),
        "direction": "in",
        "raw_payload": "sample",
        "external_id": 99,
    }

    first = await client.post("/api/attendance/logs", json=payload)
    assert first.status_code == 201, first.text

    duplicate = await client.post("/api/attendance/logs", json=payload)
    assert duplicate.status_code == 201, duplicate.text

    list_resp = await client.get("/api/attendance/logs")
    assert list_resp.status_code == 200
    results = list_resp.json()
    assert results["total"] == 1
    assert results["items"][0]["external_id"] == 99


@pytest.mark.asyncio
async def test_dashboard_snapshot(client: AsyncClient) -> None:
    await client.post(
        "/api/employees",
        json={"code": "EMP321", "first_name": "Isha", "last_name": "Patel", "department": "Finance"},
    )
    await client.post(
        "/api/employees",
        json={"code": "EMP654", "first_name": "Leo", "last_name": "Martins", "department": "Sales"},
    )
    await client.post(
        "/api/devices",
        json={"name": "HQ Exit", "model": "K30", "serial_number": "SN777", "ip_address": "10.0.0.30"},
    )
    await client.post(
        "/api/devices",
        json={"name": "Factory Gate", "model": "X990", "serial_number": "SN778", "ip_address": "10.0.0.31"},
    )

    now = datetime.now(timezone.utc)
    for idx, emp_code in enumerate(["EMP321", "EMP654"], start=1):
        await client.post(
            "/api/attendance/logs",
            json={
                "employee_code": emp_code,
                "device_serial": "SN777",
                "punched_at": (now - timedelta(hours=idx)).isoformat(),
                "direction": "in",
                "raw_payload": f"payload-{idx}",
                "external_id": idx,
            },
        )

    dashboard_resp = await client.get("/api/dashboard")
    assert dashboard_resp.status_code == 200
    dashboard = dashboard_resp.json()
    metrics = dashboard["metrics"]
    assert metrics["total_employees"] >= 2
    assert metrics["total_devices"] >= 2
    assert metrics["total_logs"] >= 2
    assert metrics["logs_last_24h"] >= 2
    assert dashboard["recent_logs"]


@pytest.mark.asyncio
async def test_shift_assignment_and_daily_summary(client: AsyncClient) -> None:
    employee_payload = {
        "code": "EMP900",
        "first_name": "Noah",
        "last_name": "Fernandez",
        "department": "Operations",
    }
    employee_resp = await client.post("/api/employees", json=employee_payload)
    assert employee_resp.status_code == 201, employee_resp.text

    device_payload = {
        "name": "Main Gate",
        "model": "X990",
        "serial_number": "DEV900",
        "ip_address": "10.10.0.1",
    }
    device_resp = await client.post("/api/devices", json=device_payload)
    assert device_resp.status_code == 201, device_resp.text

    shift_payload = {
        "name": "General Shift",
        "start_time": "08:00:00",
        "end_time": "17:00:00",
        "grace_minutes": 10,
    }
    shift_resp = await client.post("/api/shifts", json=shift_payload)
    assert shift_resp.status_code == 201, shift_resp.text
    shift_id = shift_resp.json()["id"]

    assignment_payload = {
        "shift_id": shift_id,
        "effective_from": "2024-01-02",
    }
    assignment_resp = await client.post(
        f"/api/employees/{employee_payload['code']}/shift", json=assignment_payload
    )
    assert assignment_resp.status_code == 201, assignment_resp.text
    assignment_data = assignment_resp.json()
    assert assignment_data["shift"]["name"] == shift_payload["name"]

    work_day = datetime(2024, 1, 2, tzinfo=timezone.utc)
    punches = [
        {
            "employee_code": employee_payload["code"],
            "device_serial": device_payload["serial_number"],
            "punched_at": (work_day + timedelta(hours=8, minutes=5)).isoformat(),
            "direction": "IN",
            "raw_payload": "entry",
        },
        {
            "employee_code": employee_payload["code"],
            "device_serial": device_payload["serial_number"],
            "punched_at": (work_day + timedelta(hours=17)).isoformat(),
            "direction": "OUT",
            "raw_payload": "exit",
        },
    ]

    for payload in punches:
        resp = await client.post("/api/attendance/logs", json=payload)
        assert resp.status_code == 201, resp.text

    summary_resp = await client.get("/api/attendance/summaries", params={"day": "2024-01-02"})
    assert summary_resp.status_code == 200, summary_resp.text
    summaries = summary_resp.json()

    employee_summary = next(item for item in summaries if item["employee"]["code"] == employee_payload["code"])
    assert employee_summary["status"] in {"present", "late"}
    assert employee_summary["total_minutes"] >= 500
    assert employee_summary["shift"]["name"] == shift_payload["name"]


@pytest.mark.asyncio
async def test_admin_user_management(client: AsyncClient) -> None:
    create_resp = await client.post(
        "/api/users",
        json={
            "email": "ops@example.com",
            "full_name": "Ops User",
            "password": "initialpass",
            "role": "manager",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    user_id = create_resp.json()["id"]

    update_resp = await client.patch(
        f"/api/users/{user_id}",
        json={"full_name": "Operations Manager", "role": "admin"},
    )
    assert update_resp.status_code == 200, update_resp.text
    updated = update_resp.json()
    assert updated["full_name"] == "Operations Manager"
    assert updated["role"] == "admin"

    password_resp = await client.post(
        f"/api/users/{user_id}/password",
        json={"password": "newpass123"},
    )
    assert password_resp.status_code == 204, password_resp.text

    delete_resp = await client.delete(f"/api/users/{user_id}")
    assert delete_resp.status_code == 204, delete_resp.text


@pytest.mark.asyncio
async def test_admin_system_config_and_sql_console(client: AsyncClient) -> None:
    config_resp = await client.get("/api/admin/system/config")
    assert config_resp.status_code == 200, config_resp.text
    config = config_resp.json()
    assert "ingestion_enabled" in config

    update_resp = await client.patch(
        "/api/admin/system/config",
        json={"ingestion_enabled": True, "ingestion_poll_interval_seconds": 90},
    )
    assert update_resp.status_code == 200, update_resp.text
    updated_config = update_resp.json()
    assert updated_config["ingestion_enabled"] is True
    assert updated_config["ingestion_poll_interval_seconds"] == 90

    sql_resp = await client.post(
        "/api/admin/sql",
        json={"statement": "SELECT email, role FROM users ORDER BY email"},
    )
    assert sql_resp.status_code == 200, sql_resp.text
    sql_data = sql_resp.json()
    assert sql_data["columns"] == ["email", "role"]
    assert any(row[0] == "admin@example.com" for row in sql_data["rows"])

    non_select_resp = await client.post(
        "/api/admin/sql",
        json={"statement": "DELETE FROM users"},
    )
    assert non_select_resp.status_code == 400
