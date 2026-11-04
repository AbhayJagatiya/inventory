"""Authentication Pydantic Schemas"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.features.offices.schemas import OfficeOut
from app.features.users.schemas import UserOut


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class ForgotPasswordRequest(BaseModel):
    username_or_email: str = Field(..., min_length=1)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class UserProfileOut(BaseModel):
    user: UserOut
    office: OfficeOut
    roles: List[str]
    permissions: List[str]

    model_config = ConfigDict(from_attributes=True)

