from __future__ import annotations

import argparse
import asyncio
from getpass import getpass

from . import crud, schemas
from .db import AsyncSessionLocal
from .enums import UserRole


async def _create_user(args: argparse.Namespace) -> None:
    async with AsyncSessionLocal() as session:
        existing = await crud.get_user_by_email(session, args.email)
        if existing:
            raise SystemExit("User with this email already exists")

        payload = schemas.UserCreate(
            email=args.email,
            full_name=args.full_name,
            password=args.password,
            role=UserRole.from_str(args.role),
        )
        user = await crud.create_user(session, payload)
        role_value = user.role.value if hasattr(user.role, "value") else user.role
        print(f"Created user {user.email} with role {role_value}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Truetime CLI utilities")
    subparsers = parser.add_subparsers(dest="command")

    create_user_parser = subparsers.add_parser("create-user", help="Create a new application user")
    create_user_parser.add_argument("--email", required=True, help="User email address")
    create_user_parser.add_argument("--full-name", required=True, help="Full name")
    create_user_parser.add_argument(
        "--role",
        choices=[role.value for role in UserRole],
        default=UserRole.ADMIN.value,
        help="Role for the user (default: admin)",
    )
    create_user_parser.add_argument("--password", help="Password (will prompt if omitted)")

    args = parser.parse_args()

    if args.command == "create-user":
        if not args.password:
            args.password = getpass("Password: ")
        asyncio.run(_create_user(args))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
