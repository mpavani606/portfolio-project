# Backend API contract

The full machine-readable contract, including all request and response schemas, is [openapi.yaml](./openapi.yaml). Base URL for local development: `http://localhost:3000`. JSON endpoints use the standard success/error envelope below. Unsafe requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a CSRF cookie and matching `x-csrf-token` header.

## B-2 system endpoints

| Method and path | Request | Success | Not-ready response |
|---|---|---|---|
| `GET /api/health` | No body | `200` with `{"success":true,"data":{"status":"ok"}}` | N/A (liveness does not check MongoDB) |
| `GET /api/ready` | No body | `200` with `{"success":true,"data":{"status":"ready"}}` when MongoDB is connected | `503` with `{"success":false,"error":{"code":"INTERNAL","message":"Service not ready"}}` |

The readiness response intentionally does not expose MongoDB connection details. Both routes are implemented in `server/src/app.ts`; Supertest coverage is in `server/src/tests/app.test.ts`.

## Common JSON envelopes

Successful responses:

```json
{
  "success": true,
  "data": {}
}
```

Paginated list responses additionally include `meta`:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "pages": 0 }
}
```

Errors use stable codes and validation errors can include field errors:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fields": { "email": ["Invalid email address"] }
  }
}
```

Other error codes are `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, and `INTERNAL`. Production errors do not include stack traces.

## Endpoint and method index

| Group | Methods and paths |
|---|---|
| System | `GET /api/health`; `GET /api/ready` |
| CSRF | `GET /api/auth/csrf` |
| Authentication | `POST /api/auth/register`, `/verify-email`, `/resend-verification`, `/login`, `/logout`, `/forgot-password`, `/reset-password`, `/change-password`; `GET /api/auth/me` |
| Workspace onboarding | `GET /api/onboarding/slug-available?slug=...`; `POST /api/onboarding/workspace` |
| Owner summary | `GET /api/owner/overview` |
| Owner profile | `GET, PUT /api/owner/profile`; `PATCH /api/owner/profile/publish` |
| Owner portfolio resources | For `projects`, `skills`, `achievements`, `career`, and `goals`: `GET, POST /api/owner/{resource}`; `GET, PATCH, DELETE /api/owner/{resource}/:id`; `PATCH /api/owner/{resource}/:id/publish` |
| Owner utilities | `PATCH /api/owner/projects/reorder`; `GET /api/owner/messages`; `PATCH, DELETE /api/owner/messages/:id`; `POST /api/owner/uploads/image` |
| Public portfolio | `GET /api/public/:slug/profile`, `/projects`, `/projects/:projectSlug`, `/skills`, `/achievements`, `/career`, `/goals`; `GET /api/public/assets/:key`; `POST /api/public/:slug/contact` |

## Request and response examples

Registration uses `POST /api/auth/register`:

```json
{
  "email": "developer@example.com",
  "password": "a-unique-password-of-12-chars"
}
```

It responds `202` with a generic message, regardless of account eligibility:

```json
{
  "success": true,
  "data": {
    "message": "If the address can be registered, verification instructions will be sent."
  }
}
```

Workspace creation uses `POST /api/onboarding/workspace`:

```json
{
  "slug": "developer-portfolio",
  "displayName": "Developer Portfolio"
}
```

The success response is `200`, with `data` containing `id`, `ownerId`, `slug`, `displayName`, and `status`. The server derives `ownerId` from the session; clients must not submit an owner or tenant identity.

Login uses `POST /api/auth/login` with `{ "email": "...", "password": "..." }`. Its `200` response has `data.user` (`id`, `email`, `role`, `isVerified`, `createdAt`) and `data.tenant` (the workspace DTO or `null`); the session is set as an HttpOnly cookie. The complete resource-specific JSON schemas and responses are in [openapi.yaml](./openapi.yaml).

## Run locally

From the repository root in PowerShell, with MongoDB running:

```powershell
Copy-Item .env.example .env
# Set SESSION_SECRET to a random value of at least 32 characters.
npm ci
npm run dev
```

The server validates its environment, connects MongoDB, and listens on `PORT` (default `3000`). Verify it with:

```powershell
curl.exe --fail-with-body http://localhost:3000/api/health
curl.exe --fail-with-body http://localhost:3000/api/ready
```

Readiness returns HTTP 503 until MongoDB is connected. Build and start the compiled server with `npm run build` followed by `npm start`.
