# QM Portfolio

QM Portfolio is a multilingual student and professional portfolio platform. The backend uses Node.js, Express, TypeScript, MongoDB, and Mongoose.

See [the project blueprint](docs/BLUEPRINT.md), [implementation status](docs/IMPLEMENTATION_STATUS.md), [backend architecture](docs/ARCHITECTURE_BACKEND.md), [human-readable API contract](docs/API_CONTRACT.md), and [OpenAPI contract](docs/openapi.yaml) for scope and implementation details.

## Running locally

Requirements: Node.js 20+, MongoDB 7+, and PowerShell (commands below assume the repository root).

```powershell
Copy-Item .env.example .env
# Set SESSION_SECRET to a random value of at least 32 characters.
npm ci
npm run dev
```

The API listens at `http://localhost:3000` by default. Liveness is `GET /api/health`; readiness is `GET /api/ready` and remains unavailable until MongoDB connects. Set `MONGODB_URI` to a local MongoDB database and `CLIENT_ORIGIN` to the exact frontend origin.

The system probes take no request body. `GET /api/health` returns `200 {"success":true,"data":{"status":"ok"}}`. `GET /api/ready` returns `200 {"success":true,"data":{"status":"ready"}}` when MongoDB is connected, or a detail-free `503 {"success":false,"error":{"code":"INTERNAL","message":"Service not ready"}}`. See [the API contract](docs/API_CONTRACT.md) for methods, JSON examples, and [the OpenAPI schema](docs/openapi.yaml) for every route's request and response definitions.

## Frontend client

The React/Vite client lives in `frontend/`. It uses the same-origin `/api` path in browser code; Vite proxies that path to the API at `http://localhost:3000` during development. No API URL secret or private environment variable is exposed to the client.

Run the backend first using the instructions above. In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. The development-only `/status` route calls the real `GET /api/ready` endpoint and shows a detail-safe readiness state. Unknown paths show the 404 page.

Frontend checks, from `frontend/`:

```powershell
npm run lint
npm run format
npm run typecheck
npm test
npm run build
```

The GitHub Actions workflow runs these client checks from `frontend/` when frontend files change.

## Authentication and workspace flow

1. `GET /api/auth/csrf` sets a readable `qm_csrf` cookie and returns its token.
2. Send that token in the `x-csrf-token` header, along with cookies, on every unsafe request (`POST`, `PUT`, `PATCH`, or `DELETE`).
3. `POST /api/auth/register` creates a regular user and sends a verification link. Public signup cannot choose a role. In development without SMTP, the verification and password-reset links are written to the server log; use the token from that link with `POST /api/auth/verify-email` or `POST /api/auth/reset-password`.
4. `POST /api/auth/login` sets the `qm_session` cookie. It is HttpOnly, SameSite=Lax, scoped to `/api`, Secure in production, and backed by a random token stored only as a hash. `GET /api/auth/me` returns a whitelisted user and optional workspace DTO.
5. After verification and login, use `GET /api/onboarding/slug-available` and `POST /api/onboarding/workspace` to create the account's single workspace. Reserved slugs are not available.
6. `POST /api/auth/logout` clears the current session. Password reset and password change revoke all existing sessions.

Configure all five `SMTP_*` settings in `.env` to send verification and reset messages through SMTP. They must be set together. Never use development link logging in production.

## Portfolio CMS and public API

After creating a workspace, the verified owner can manage a profile and projects, skills, achievements, career entries, and goals under `/api/owner`. These endpoints read tenant identity only from the server session. Resource lists support `page`, `limit`, `q`, `status`, and allowlisted `sort` values. Publish an individual resource with `PATCH /api/owner/<resource>/:id/publish`; publish the profile with `PATCH /api/owner/profile/publish`. Draft items are excluded from public results.

Public portfolios are available at `/api/public/:slug/{profile,projects,skills,achievements,career,goals}`; individual projects use `/api/public/:slug/projects/:projectSlug`. Only published profiles/items are returned, and achievements must also have public visibility. Public response DTOs whitelist fields and honor the profile's public email/location settings. A public contact form is available at `/api/public/:slug/contact`; it is length-validated, honeypot-protected, rate-limited, and requires the CSRF double-submit header. Messages are only available in the workspace owner's inbox.

`POST /api/owner/uploads/image` accepts one JPEG, PNG, or WebP image up to 5 MB. The server verifies its extension, MIME type, and signature, strips metadata by converting it to WebP, and assigns the storage key. Do not send a client-chosen URL. Local development uses `UPLOAD_DIR`; production requires `ASSET_STORAGE_PROVIDER=s3`, `AWS_REGION`, `S3_BUCKET`, and an HTTPS `PUBLIC_API_ORIGIN`. Use a private S3 bucket and the AWS default credential chain. Asset bytes are served through the API only while referenced by published content, including for S3.

Demo content is opt-in and must use an existing, empty workspace whose slug begins `demo-test-`. Set `DEMO_TENANT_SLUG` in `.env`, then run:

```powershell
npm run seed:demo
npm run seed:demo:clear
```

The seed creates explicitly labelled `DEMO` draft content, refuses production and non-empty workspaces, and records the exact inserted IDs for cleanup. Cleanup leaves unrelated workspace content in place.

### Initial superadmin

The initial platform administrator can be seeded once. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env` (minimum 12 characters; both settings are required), then run:

```powershell
npm run seed:admin
```

The seed command refuses to create another superadmin. Do not put credentials in source control or command history; remove seed credentials from the environment after bootstrap. Public registration cannot create privileged accounts.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

The test suite requires a reachable MongoDB instance and uses a separate test database name.
