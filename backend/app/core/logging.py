"""Core Logging and Request Correlation Middleware

Sets up structured logging and attaches correlation request IDs.
"""

import logging
import sys
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings


def setup_logging():
    """Configures structured console logging."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )


class RequestCorrelationMiddleware(BaseHTTPMiddleware):
    """Middleware that injects a unique X-Request-ID into request state and response headers."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = f"req-{uuid.uuid4().hex[:12]}"

        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

