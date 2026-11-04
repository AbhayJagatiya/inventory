"""Core Application Exceptions and Error Handlers

Implements standardized error hierarchy conforming to docs/api-contract.md.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppException(Exception):
    """Base application exception with error code, message, and field details."""

    def __init__(
        self,
        message: str,
        code: str = "BAD_REQUEST",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[List[Dict[str, Any]]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", code: str = "NOT_FOUND", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message=message, code=code, status_code=status.HTTP_404_NOT_FOUND, details=details)


class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict or duplicate", code: str = "CONFLICT", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message=message, code=code, status_code=status.HTTP_409_CONFLICT, details=details)


class PermissionDeniedError(AppException):
    def __init__(self, message: str = "Insufficient permissions", code: str = "INSUFFICIENT_PERMISSIONS", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message=message, code=code, status_code=status.HTTP_403_FORBIDDEN, details=details)


class OfficeAccessDeniedError(AppException):
    def __init__(self, message: str = "Access to records outside assigned office is prohibited", code: str = "OFFICE_ACCESS_DENIED", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message=message, code=code, status_code=status.HTTP_403_FORBIDDEN, details=details)


class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication required or invalid credentials", code: str = "UNAUTHORIZED", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message=message, code=code, status_code=status.HTTP_401_UNAUTHORIZED, details=details)


class InsufficientStockError(AppException):
    def __init__(self, message: str = "Requested issue quantity exceeds available store balance", code: str = "INSUFFICIENT_STOCK", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message=message, code=code, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, details=details)


class ImmutableRecordError(AppException):
    def __init__(self, message: str = "Posted transaction records are immutable and cannot be modified or deleted", code: str = "IMMUTABLE_RECORD", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message=message, code=code, status_code=status.HTTP_409_CONFLICT, details=details)


class ValidationError(AppException):
    def __init__(self, message: str = "Validation failed", code: str = "VALIDATION_ERROR", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message=message, code=code, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, details=details)


def format_error_response(code: str, message: str, details: List[Dict[str, Any]], request_id: str) -> Dict[str, Any]:
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
        "meta": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
        },
    }


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "req-unknown")
    return JSONResponse(
        status_code=exc.status_code,
        content=format_error_response(
            code=exc.code,
            message=exc.message,
            details=exc.details,
            request_id=request_id,
        ),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "req-unknown")
    details = []
    for err in exc.errors():
        loc = err.get("loc", [])
        field_name = ".".join(str(item) for item in loc if item not in ("body", "query", "path"))
        details.append({
            "field": field_name or "body",
            "issue": err.get("msg", "Invalid value"),
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=format_error_response(
            code="VALIDATION_ERROR",
            message="Request body or query parameter validation failed",
            details=details,
            request_id=request_id,
        ),
    )


async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "req-unknown")
    code_map = {
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        429: "RATE_LIMIT_EXCEEDED",
        500: "INTERNAL_SERVER_ERROR",
    }
    code = code_map.get(exc.status_code, "HTTP_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content=format_error_response(
            code=code,
            message=str(exc.detail),
            details=[],
            request_id=request_id,
        ),
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "req-unknown")
    # Log securely without leaking internal traceback to client
    import logging
    logger = logging.getLogger("app.core.exceptions")
    logger.exception(f"Unhandled exception on request {request_id}: {exc}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=format_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred. Please contact the system administrator.",
            details=[],
            request_id=request_id,
        ),
    )

