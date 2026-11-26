# QM Portfolio --- Implementation Status

Audit date: 2026-11-26. This status reflects the verified backend foundation, auth/workspace slice, and portfolio CMS/public API recorded in [ARCHITECTURE_BACKEND.md](ARCHITECTURE_BACKEND.md) and [API_CONTRACT.md](API_CONTRACT.md). Frontend work and the remaining product features are not started.

| Phase | Backend | Frontend | Evidence / scope |
|---:|---|---|---|
| 0 | Verified | Not started | Backend repository audit documented; npm checks recorded. |
| 1 | Verified | Not started | B-2 backend foundation is implemented and verified: app/server split, MongoDB connection, `/api/health`, `/api/ready`, middleware, OpenAPI/API contract, tests, and CI. |
| 2 | Verified | Not started | User, Tenant, and Session models; public registration with verification; workspace onboarding; tenant isolation. Public signup scope approved and blueprint updated. |
| 3 | Verified | Not started | Profile, projects, skills, achievements, career, goals, owner CMS, uploads, publish controls, public APIs, contact inbox, and DEMO seed/cleanup. |
| 4 | Not started | Not started | Admin account management/tools, including generated R1 IDs and initial credentials for administrator-provisioned accounts. |
| 5 | Not started | Not started | Frontend profile management and dashboard. |
| 6 | Not started | Not started | Frontend education management (backend uses CareerEntry with kind `education`). |
| 7 | Not started | Not started | Frontend project management. |
| 8 | Not started | Not started | Frontend professional-link management. |
| 9 | Not started | Not started | PDF upload workflow; backend image upload is implemented in Phase 3. |
| 10 | Not started | Not started | Frontend public portfolio and publishing controls; confirmed badge/coding-profile pages and canonical passport URL are future scope. |
| 11 | Not started | Not started | Three-language interface/content support. |
| 12 | Not started | Not started | Release 2 portfolio enhancements. |
| 13 | Not started | Not started | Certificate verification. |
| 14 | Not started | Not started | Release 3 AI suggestions. |
| 15 | Not started | Not started | Collaboration, feedback, reports, PDF export; confirmed dashboard messages, settings, and audit logs are future scope. |
| 16 | Not started | Not started | Security, migration, deployment, full verification. |

The blueprint defines three releases but no numbered 0–16 phase plan. The numbered sequence above is a proposed implementation breakdown, not an existing project plan. Backend Phases 0–3 are implemented; frontend work and remaining product features are not implemented.

## Phase 1 verification record

| Check | Command | Result |
|---|---|---|
| Install | `npm ci --no-audit --no-fund` | Exit 0; 297 packages installed from the lockfile. |
| Lint | `npm run lint` | Passed; exit 0. |
| Typecheck | `npm run typecheck` | Passed; exit 0. |
| Test | `npm test` | Passed; 1 file and 7 tests. |
| Build | `npm run build` | Passed; exit 0. |
| Smoke | `npm start` after build; `curl.exe --fail-with-body --silent --show-error` against `/api/health` and `/api/ready` | Server connected to MongoDB and listened on port 3000; both probes returned HTTP 200. |

When MongoDB is disconnected, Supertest verifies `/api/ready` returns HTTP 503 with no connection details. The already-running shared MongoDB service was not stopped for the smoke test. See [ARCHITECTURE_BACKEND.md](ARCHITECTURE_BACKEND.md) for exact commands, route/model inventory, and confirmed scope additions.

## B-2 completion record (Phase 1)

**Status: Implemented and verified.** The app is importable without listening (`server/src/app.ts`); the server entry point connects to MongoDB, listens, and handles graceful shutdown (`server/src/server.ts`). Both system endpoints are mounted in `app.ts`.

| Method and route | Request | Verified response |
|---|---|---|
| `GET /api/health` | No body | HTTP 200: `{"success":true,"data":{"status":"ok"}}` |
| `GET /api/ready` | No body | HTTP 200 with `{"success":true,"data":{"status":"ready"}}` when MongoDB is connected. |
| `GET /api/ready` (MongoDB disconnected) | No body | HTTP 503: `{"success":false,"error":{"code":"INTERNAL","message":"Service not ready"}}`; no connection detail is included. |

The endpoint/method inventory, request/response envelopes and examples are in [API_CONTRACT.md](API_CONTRACT.md); complete request and response schemas are in [openapi.yaml](openapi.yaml).

| Check | Exact command | Result |
|---|---|---|
| System endpoint tests | `npx vitest run server/src/tests/app.test.ts` | Passed; 1 file, 8 tests, including liveness, not-ready behavior, 404, error envelope, validation errors, and invalid environment failure. |
| Live server probes | One-shot `node --import tsx --input-type=module` smoke using `startServer()` and HTTP fetch on port 43127 | MongoDB connected; `/api/health` and `/api/ready` returned HTTP 200 with the documented JSON; server closed and MongoDB disconnected cleanly. |
| Lint | `npm run lint` | Exit 0 (recorded in Phase 3 verification). |
| Typecheck | `npm run typecheck` | Exit 0 (recorded in Phase 3 verification). |
| Full tests | `npm test` | Passed; 3 files, 22 tests (recorded in Phase 3 verification). |
| Build | `npm run build` | Exit 0 (recorded in Phase 3 verification). |
| Live startup/probes | `npm start` after build; `curl.exe --fail-with-body --silent --show-error` against `/api/health` and `/api/ready` | Earlier Phase 1 smoke recorded HTTP 200 for both routes. |

## Phase 2 verification record

| Check | Exact command | Result |
|---|---|---|
| Lint | `npm run lint` | Exit 0. |
| Typecheck | `npm run typecheck` | Exit 0. |
| Tests | `npm test` | Exit 0; 2 files and 17 tests passed, including registration/verification/login/logout, lockout, CSRF, password reset and session invalidation, reserved slugs, seed refusal, and tenant isolation. |
| Build | `npm run build` | Exit 0. |
| Live server | `npm run dev` with temporary process-only settings, port 3100, and a unique local MongoDB database | MongoDB connected; server listened on port 3100. Server and isolated database were stopped/removed after smoke testing. |
| Live auth smoke | PowerShell `Invoke-RestMethod` requests to `/api/auth/csrf`, register, verify-email, login, `/api/auth/me`, slug availability, workspace create, forgot-password, and reset-password | Passed. Signup role remained `user`; `admin` slug reported unavailable and create returned 409; session cookie was HttpOnly; reset invalidated a previously valid session (401), and the new password logged in. |
| Admin seed | `npm run seed:admin` twice with temporary credentials and an isolated database | First run exited 0 and created the superadmin; second exited 1 with “An existing superadmin was found; refusing to seed a second time.” Isolated database removed afterward. |
| HTTP log redaction | Reviewed live Pino request logs | Cookies, `Set-Cookie`, and `x-csrf-token` were redacted. Development verification/reset links were logged for the local flow. |

SMTP delivery was not tested against a real provider. The API smoke run did not stop the pre-existing shared MongoDB service.

## Phase 3 verification record

| Check | Exact command | Result |
|---|---|---|
| Install | `npm ci --no-audit --no-fund` | Exit 0; 339 packages restored. npm warned that the locked ESLint version is deprecated and that esbuild's install script is not approved by the local install-script policy. |
| Lint | `npm run lint` | Passed; exit 0. |
| Typecheck | `npm run typecheck` | Passed; exit 0. |
| Tests | `npm test` | Passed; 3 files and 22 tests. |
| Build | `npm run build` | Passed; exit 0. |
| Production dependency audit | `npm audit --omit=dev` | Passed; 0 production dependency vulnerabilities reported. |
| Full dependency audit | `npm audit` | Exit 1; 3 development dependency findings (1 moderate, 2 critical) in the Vitest/`@vitest/mocker`/`tinypool` chain. npm's proposed forced fix is a breaking Vitest 5 upgrade; not changed in this task. |
| DEMO seed/cleanup | `npm run seed:demo`; `npm run seed:demo:clear` against a uniquely named local database | Passed; created DEMO draft records, removed manifest-owned records, preserved a separately inserted project, then dropped only the isolated test database. |
| Publish/unpublish | `npx vitest run server/src/tests/portfolio.test.ts` | Passed; 1 file and 4 tests; also included in the passing full suite. |

The S3 code path has not been exercised against a cloud account. Asset responses use the API endpoint (including for S3) so unpublished or suspended-workspace assets are not exposed through a direct public object URL.

## Update rules

- Record concrete repository evidence for status changes.
- Use `Verified` only after running the relevant check successfully.
- Record failed checks and blockers accurately.
- Update this document after meaningful implementation work.
