"""
Server entry point for supervisor.
This module imports the FastAPI app from app.main
"""
from app.main import app

__all__ = ["app"]
