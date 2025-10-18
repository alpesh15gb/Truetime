from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    VIEWER = "viewer"

    @classmethod
    def from_str(cls, value: str) -> "UserRole":
        try:
            return cls(value)
        except ValueError as exc:
            raise ValueError(f"Unsupported role: {value}") from exc
