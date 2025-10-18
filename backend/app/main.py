from __future__ import annotations

import asyncio
import asyncio
from contextlib import asynccontextmanager, suppress
from typing import AsyncGenerator

from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import api, ingestion
from .config import get_settings
from .db import AsyncSessionLocal, Base, engine


def _run_migrations() -> None:
    config = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(config, "head")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    if settings.auto_run_migrations:
        await asyncio.to_thread(_run_migrations)
    else:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    task: asyncio.Task | None = None

    if settings.ingestion_enabled:
        task = asyncio.create_task(
            ingestion.run_scheduler(AsyncSessionLocal, settings)
        )

    try:
        yield
    finally:
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.include_router(api.router, prefix="/api")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
