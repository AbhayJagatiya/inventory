# Frontend Handoff: Module 01 – Application Foundation & Authentication
## PS000214 – Dead Stock Inventory Management System

**Target Recipient:** Backend Engineering Teammate  
**Prepared By:** Frontend Architect (Ninu Handoff)  
**Organization:** District Development Office – Gir Somnath, Veraval, Gujarat  
**Version:** 1.0.0  
**Phase:** Phase 1 – Foundation & Security

---

### 1. Module Overview
Module 01 encompasses the foundational authenticated shell, security context, token lifecycle management, responsive layout with collapsible navigation, public login screen, password recovery policy, user profile screen, and defensive route guards. It establishes the client-side single page application architecture integrated with FastAPI's JWT-based authentication.

---

### 2. Pages and Components

#### Pages:
1. `LoginPage` (`/login`): Clean government enterprise login interface.
2. `ForgotPasswordPage` (`/forgot-password`): Official policy screen directing users to contact System Admin.
3. `MyProfilePage` (`/profile`): User identity, assigned office scope, and credential update form.
4. `UnauthorizedPage` (`/unauthorized`): HTTP 403 access forbidden view.
5. `NotFoundPage` (`*`): HTTP 404 resource not found view.

#### Shared Components:
- `AppLayout`: Two-tier shell (Collapsible Sidebar, Header Navbar, Breadcrumbs, Content View).
- `Sidebar`: Role-filtered hierarchical navigation tree with office indicator badge.
- `Navbar`: Live notification counter, user profile dropdown, and logout trigger.
- `Breadcrumbs`: Path-aware navigation breadcrumbs with UUID detection.
- `ProtectedRoute`: Client-side route guard evaluating JWT presence and required permission codes.
- `PublicOnlyRoute`: Prevents authenticated users from accessing login screens.
- `Button`, `StatusBadge`, `Modal`, `ConfirmDialog`, `LoadingSkeleton`, `EmptyState`, `ErrorState`, `PageLoader`.

---

### 3. All Input Fields & 4. Field Data Types

#### A. Login Form (`/login`):
| Field Name | Type | UI Component | Required? | Validation Rules |
|:---|:---|:---|:---:|:---|
| `username` | String | Text Input with User Icon | **Yes** | Non-empty string, trimmed |
| `password` | String | Password Input with Show/Hide toggle | **Yes** | Non-empty string |

#### B. Change Password Form (`/profile`):
| Field Name | Type | UI Component | Required? | Validation Rules |
|:---|:---|:---|:---:|:---|
| `current_password` | String | Password Input | **Yes** | Non-empty string |
| `new_password` | String | Password Input | **Yes** | Minimum 8 characters |
| `confirm_password` | String | Password Input | **Yes** | Must match `new_password` exactly |

---

### 5. Required and Optional Fields
- All login and password-change fields are strictly **Required**.
- Optional fields: In user profile, `phone_number` and `email` are optional if created via system admin.

---

### 6. Validation Requirements
- Client-side validation is performed using **Zod** and **React Hook Form**.
- Form inputs preserve entered values upon validation failure.
- Form submissions are blocked while `isSubmitting = true` to prevent duplicate requests.
- Server-side validation errors (HTTP 422 with field-level issues) are captured and displayed directly inline next to the respective input.

---

### 7. Button Actions
- **Sign In Button (`LoginPage`):** Disables during execution, displays spinner, triggers `POST /api/v1/auth/login`. On success, writes tokens to local storage and navigates to role dashboard.
- **Toggle Password Visibility (`LoginPage`, `MyProfilePage`):** Toggles input type between `password` and `text`.
- **Sign Out Action (`Navbar` Profile Menu):** Calls `POST /api/v1/auth/logout`, purges access and refresh tokens, and resets auth context.
- **Update Password Button (`MyProfilePage`):** Triggers `POST /api/v1/auth/change-password`. On success, displays green toast and clears password form fields.

---

### 8. Search and Filter Requirements
- In Phase 1 shell, the navigation menu dynamically filters menu items based on the user's `permissions` array returned from `GET /api/v1/auth/me`.

---

### 9. API Endpoint Requirements & 10. HTTP Methods

| Operation | HTTP Method | Route | Authorization Header |
|:---|:---:|:---|:---:|
| User Login | `POST` | `/api/v1/auth/login` | None |
| User Logout | `POST` | `/api/v1/auth/logout` | `Bearer <access_token>` |
| Token Refresh | `POST` | `/api/v1/auth/refresh` | None |
| Current Profile | `GET` | `/api/v1/auth/me` | `Bearer <access_token>` |
| Change Password | `POST` | `/api/v1/auth/change-password` | `Bearer <access_token>` |

---

### 11. Request JSON Examples

#### `POST /api/v1/auth/login`:
```json
{
  "username": "admin",
  "password": "Password123!"
}
```

#### `POST /api/v1/auth/refresh`:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `POST /api/v1/auth/change-password`:
```json
{
  "current_password": "CurrentPassword123!",
  "new_password": "NewSecurePassword456!",
  "confirm_password": "NewSecurePassword456!"
}
```

---

### 12. Expected Response JSON Examples

#### `POST /api/v1/auth/login` (HTTP 200):
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "username": "admin",
      "full_name": "DDO Store Administrator",
      "designation": "System Administrator",
      "role": {
        "id": "rol-001",
        "name": "SYSTEM_ADMIN"
      },
      "office": {
        "id": "off-001",
        "code": "OFF-GS-VRV-001",
        "name": "Veraval Store Office"
      },
      "permissions": [
        "dashboard:admin_view",
        "inventory:view",
        "inventory:create",
        "classify:view",
        "classify:run",
        "users:view",
        "audit:view"
      ]
    }
  },
  "message": "Login successful",
  "meta": {
    "timestamp": "2026-11-04T00:00:00Z",
    "request_id": "req-001"
  }
}
```

#### `GET /api/v1/auth/me` (HTTP 200):
```json
{
  "success": true,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "username": "admin",
    "full_name": "DDO Store Administrator",
    "designation": "System Administrator",
    "role": {
      "id": "rol-001",
      "name": "SYSTEM_ADMIN"
    },
    "office": {
      "id": "off-001",
      "code": "OFF-GS-VRV-001",
      "name": "Veraval Store Office"
    },
    "permissions": [
      "dashboard:admin_view",
      "inventory:view",
      "inventory:create",
      "users:view"
    ]
  }
}
```

---

### 13. Required Master Data
- Initial operational Office: Veraval (`OFF-GS-VRV-001`).
- Roles seeded: `SYSTEM_ADMIN`, `STORE_OFFICER`, `STORE_STAFF`.

---

### 14. Status and Enum Values
- **Roles:** `SYSTEM_ADMIN`, `STORE_OFFICER`, `STORE_STAFF`.
- **Account Statuses:** `ACTIVE`, `INACTIVE`, `LOCKED`, `PASSWORD_RESET_REQUIRED`.

---

### 15. Error Handling
- **HTTP 401 Unauthorized:**
  - On `/auth/login`: Displays "Invalid username or password".
  - On protected routes: Interceptor invokes `POST /auth/refresh`. If refresh fails, purges tokens and redirects to `/login?expired=1`.
- **HTTP 403 Forbidden:**
  - User is informed via red toast: *"You do not have permission to perform this action."* Protected pages render `UnauthorizedPage`.
- **HTTP 422 Unprocessable Entity:**
  - Validation errors parsed from `error.details` array and displayed under the respective input.
- **HTTP 500 Server Error:**
  - Displays generic safe toast: *"A server error occurred. Please try again or contact support."* (no stack traces exposed).

---

### 16. Backend Dependencies
- FastAPI `OAuth2PasswordBearer` or JSON login endpoint returning signed JWT with standard claims.
- Argon2 or BCrypt password hashing.
- Role-based permissions populated in `/auth/me` payload.

---

### 17. Testing Checklist
- [x] Client renders login form with accessible contrast and valid labels.
- [x] Client validates empty inputs before sending network request.
- [x] Client handles successful token receipt and sets `Authorization: Bearer <token>`.
- [x] Unauthenticated direct navigation to `/dashboard` redirects to `/login`.
- [x] Authenticated user navigating to `/login` is redirected to `/dashboard`.
- [x] Logout purges tokens and invalidates session.
- [x] Profile page correctly displays assigned office name and granted permissions list.

