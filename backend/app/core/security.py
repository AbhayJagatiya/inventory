"""Security, Password Hashing and JWT Token Management

Implements Argon2 password hashing and PyJWT token generation/verification.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Set
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.core.config import settings
from app.core.exceptions import AuthenticationError, ValidationError

# Initialize Argon2 Password Hasher
ph = PasswordHasher()

# In-memory revoked token identifiers (JTI or token strings)
_revoked_tokens: Set[str] = set()


def hash_password(password: str) -> str:
    """Hashes a plaintext password using Argon2."""
    if not password:
        raise ValidationError("Password cannot be empty")
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against an Argon2 hash (with bcrypt fallback)."""
    if not hashed_password:
        return False
    # If Argon2 hash
    if hashed_password.startswith("$argon2"):
        try:
            return ph.verify(hashed_password, plain_password)
        except VerifyMismatchError:
            return False
        except Exception:
            return False
    # Bcrypt fallback
    if hashed_password.startswith("$2a$") or hashed_password.startswith("$2b$") or hashed_password.startswith("$2y$"):
        import bcrypt
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except Exception:
            return False
    return False


def validate_password_strength(password: str) -> None:
    """Validates that a password satisfies minimum complexity requirements."""
    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters long")
    if not any(char.isdigit() for char in password):
        raise ValidationError("Password must contain at least one numeric digit")
    if not any(char.isalpha() for char in password):
        raise ValidationError("Password must contain at least one alphabetic character")


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access",
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT refresh token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.JWT_REFRESH_TOKEN_DAYS)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "refresh",
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decodes and validates a JWT token."""
    if is_token_revoked(token):
        raise AuthenticationError("Token has been revoked", code="TOKEN_REVOKED")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired", code="TOKEN_EXPIRED")
    except jwt.InvalidTokenError:
        raise AuthenticationError("Invalid or corrupted token", code="INVALID_TOKEN")


def revoke_token(token: str) -> None:
    """Adds a token to the revoked token blacklist."""
    _revoked_tokens.add(token)


def is_token_revoked(token: str) -> bool:
    """Checks if a token has been revoked."""
    return token in _revoked_tokens

