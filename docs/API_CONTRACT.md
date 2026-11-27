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
| Owner timelines and releases | `GET, POST /api/owner/projects/:projectId/{milestones,releases}`; `GET, PATCH, DELETE /api/owner/projects/:projectId/{milestones,releases}/:id`; `PATCH /api/owner/projects/:projectId/milestones/reorder` |
| Owner badges | `GET /api/owner/badges`; `POST /api/owner/badges/definitions`; `POST /api/owner/badges/award`; `POST /api/owner/badges/:id/revoke` |
| Public portfolio | `GET /api/public/:slug/profile`, `/projects`, `/projects/:projectSlug`, `/projects/:projectSlug/timeline`, `/projects/:projectSlug/releases`, `/badges`, `/badges/:badgePublicId`, `/skills`, `/achievements`, `/career`, `/goals`; `GET /api/public/assets/:key`; `POST /api/public/:slug/contact` |

## Image upload response

`POST /api/owner/uploads/image` accepts multipart field `image`. On success (`201`), `data.assetId` is the persisted MongoDB Asset `_id` encoded as a string. Existing fields remain: `key`, `url`, `width`, and `height`.

```json
{
  "success": true,
  "data": {
    "assetId": "64f000000000000000000001",
    "key": "64f000000000000000000002-12345678-1234-4234-8234-123456789012.webp",
    "url": "http://localhost:3000/api/public/assets/64f000000000000000000002-12345678-1234-4234-8234-123456789012.webp",
    "width": 640,
    "height": 480
  }
}
```

The shared response contract is `imageUploadResponseSchema` in `shared/portfolio.ts`; the API's request and response shape is also specified in [openapi.yaml](./openapi.yaml).

## B-5 timelines, releases, and badges

Project milestones are managed with `POST`, `GET`, `PATCH`, and `DELETE` under `/api/owner/projects/:projectId/milestones`; reorder with `PATCH .../milestones/reorder` and `{ "milestones": [{ "id": "<id>", "sortOrder": 1 }] }`. Completed/cancelled stages require `completedAt`; it cannot be earlier than `startedAt`. Public timelines include only public milestones on published projects and omit owner notes.

Project releases use the matching CRUD routes under `/api/owner/projects/:projectId/releases`. Submit a release such as:

```json
{
  "version": "1.0.0",
  "releaseDate": "2026-11-26",
  "summary": "First stable release",
  "changes": [{ "type": "added", "text": "Initial public release" }],
  "links": [{ "label": "Release notes", "url": "https://example.com/releases/1.0.0" }],
  "assets": [],
  "visibility": "public"
}
```

Duplicate versions return `409 CONFLICT` with a `version` field error. Owner and public lists sort by descending `releaseDate`, then descending `version`; the public route excludes private releases and unpublished projects. Per user confirmation, this fixed chronological order takes precedence over manual release reordering, so only milestones have a reorder endpoint. Release asset IDs must refer to assets in the same workspace.

`GET /api/owner/badges` returns current workspace awards and active platform/workspace definitions. Define a workspace badge with `POST /api/owner/badges/definitions`, award it with `POST /api/owner/badges/award` (the request must include `evidenceUrl` or `evidenceNote`), and revoke an award with `POST /api/owner/badges/:id/revoke` and `{ "reason": "..." }`. Public badge list/detail endpoints include only active definitions and public awards that have not been revoked.

Example manual award:

```json
{
  "definitionId": "64f000000000000000000001",
  "evidenceNote": "Reviewed the linked project contribution.",
  "visibility": "public"
}
```

The resulting badge DTO has a random `publicId`, `issuedAt`, and a server-assigned `verificationStatus`; clients cannot assign `issuer_verified`.

Run `npm run seed:badges` to idempotently insert six platform-wide badge definitions. Automatic awards run only when an explicit supported criteria rule is configured, count published/public evidence only, and are idempotent per workspace/definition. They are labelled `owner_awarded` or `evidence_provided`, never `issuer_verified`; that status cannot be set by badge-definition or award input.
The seeded Open-Source Contributor badge is manual and requires reviewed contribution evidence; adding a repository URL alone does not award it.

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
