from __future__ import annotations

from datetime import timedelta
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt

from sqlalchemy.ext.asyncio import AsyncSession

from . import crud, schemas
from .config import get_settings
from .db import get_session
from .enums import UserRole
from .security import create_access_token, verify_password


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


async def authenticate_user(session: AsyncSession, email: str, password: str):
    user = await crud.get_user_by_email(session, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_session)
):
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.token_algorithm])
        token_data = schemas.TokenPayload(**payload)
    except (JWTError, ValueError):
        raise credentials_exception

    user = await crud.get_user_by_email(session, token_data.sub)
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return user


async def get_current_active_user(user=Depends(get_current_user)):
    return user


def require_roles(*roles: UserRole | str) -> Callable:
    allowed = {role.value if isinstance(role, UserRole) else str(role) for role in roles}

    async def dependency(user=Depends(get_current_active_user)):
        role_value = user.role.value if hasattr(user.role, "value") else user.role
        if allowed and role_value not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return dependency


async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm,
    session: AsyncSession,
):
    user = await authenticate_user(session, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    expires = timedelta(minutes=get_settings().access_token_expire_minutes)
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    token = create_access_token({"sub": user.email, "role": role_value}, expires)
    return schemas.TokenResponse(access_token=token)
