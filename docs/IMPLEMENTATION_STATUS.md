# QM Portfolio --- Implementation Status

Audit date: 2026-11-26. This status reflects the verified backend foundation, auth/workspace slice, and portfolio CMS/public API recorded in [ARCHITECTURE_BACKEND.md](ARCHITECTURE_BACKEND.md) and [API_CONTRACT.md](API_CONTRACT.md). Frontend work and the remaining product features are not started.

| Phase | Backend | Frontend | Evidence / scope |
|---:|---|---|---|
| 0 | Verified | Not started | Backend repository audit documented; npm checks recorded. |
| 1 | Verified | Not started | B-2 independently rechecked against `01_BACKEND_PROMPTS.md`; full suite passes on patched Vitest 4.1.12, live health/readiness/validation probes pass, and npm audit reports 0 vulnerabilities. |
| 2 | Verified | Not started | User, Tenant, and Session models; public registration with verification; workspace onboarding; tenant isolation. Public signup scope approved and blueprint updated. |
| 3 | Verified | Not started | Profile, projects, skills, achievements, career, goals, owner CMS, uploads, publish controls, public APIs, contact inbox, and DEMO seed/cleanup. |
| 4 | Verified | Not started | B-5 project lifecycle timelines, chronological releases, badges, public badge verification, and tenant isolation. Manual release ordering is intentionally omitted per the fixed releaseDate/version ordering rule; milestones are reorderable. Admin account management remains future scope. |
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
| Install | `npm ci --no-audit --no-fund` | Exit 0; 335 packages installed from the updated lockfile. npm warned that ESLint 9.39.5 is deprecated and esbuild's install script is not approved by the local install-script policy. |
| Lint | `npm run lint` | Passed; exit 0. |
| Typecheck | `npm run typecheck` | Passed; exit 0. |
| Test | `npm test` | Passed; 6 files and 46 tests on Vitest 4.1.12. |
| Build | `npm run build` | Passed; exit 0. |
| Live smoke | One-shot `node --import tsx --input-type=module` server on port 43128 | `/api/health` and connected `/api/ready` returned HTTP 200; invalid registration returned HTTP 400 `VALIDATION_ERROR` with field errors; after disconnecting Mongoose, `/api/ready` returned HTTP 503 with a generic error and no database details. |

Supertest also verifies the not-ready response and invalid-environment failure. The already-running shared MongoDB service was not stopped; the live check disconnected the app's Mongoose connection. See [ARCHITECTURE_BACKEND.md](ARCHITECTURE_BACKEND.md) for exact commands, route/model inventory, and confirmed scope additions.

## B-2 completion record (Phase 1)

**Status: VERIFIED (independently rechecked 2026-11-26).** The complete B-2 requirements in `01_BACKEND_PROMPTS.md` were checked against the implementation. The app is importable without listening (`server/src/app.ts`); the server entry point connects to MongoDB, listens, and handles graceful shutdown (`server/src/server.ts`). Both system endpoints are mounted in `app.ts`; rejected asynchronous handlers are forwarded through the tested `asyncHandler` utility. Middleware, env validation, response/error contracts, CSRF hook, root scripts, CI, and required Supertest coverage are present.

| Method and route | Request | Verified response |
|---|---|---|
| `GET /api/health` | No body | HTTP 200: `{"success":true,"data":{"status":"ok"}}` |
| `GET /api/ready` | No body | HTTP 200 with `{"success":true,"data":{"status":"ready"}}` when MongoDB is connected. |
| `GET /api/ready` (MongoDB disconnected) | No body | HTTP 503: `{"success":false,"error":{"code":"INTERNAL","message":"Service not ready"}}`; no connection detail is included. |

The endpoint/method inventory, request/response envelopes and examples are in [API_CONTRACT.md](API_CONTRACT.md); complete request and response schemas are in [openapi.yaml](openapi.yaml).

| Check | Exact command | Result |
|---|---|---|
| Install | `npm ci --no-audit --no-fund` | Exit 0; 335 packages restored from lockfile. |
| Lint | `npm run lint` | Exit 0. |
| Typecheck | `npm run typecheck` | Exit 0. |
| Full tests | `npm test` | Passed; 6 files and 46 tests on Vitest 4.1.12. |
| Build | `npm run build` | Exit 0. |
| Live server/API checks | One-shot `node --import tsx --input-type=module` smoke using `startServer()` and HTTP fetch on port 43128 | Health and connected readiness HTTP 200; invalid registration HTTP 400 with `VALIDATION_ERROR` and `email`/`password` field errors; disconnected readiness HTTP 503 with no database details. Server closed cleanly. |
| Full dependency audit | `npm audit` | Exit 0; 0 vulnerabilities. |
| Production dependency audit | `npm audit --omit=dev` | Exit 0; 0 vulnerabilities. |
| Working tree secret check | `git ls-files --error-unmatch .env`; `git check-ignore -v .env` | `.env` is not tracked and is ignored by `.gitignore`; no local `.env` file was present during this review. |

Audit remediation: the previous audit found moderate `@vitest/mocker` path-traversal/mock-registration advisories and critical `tinypool` worker-option prototype-pollution/RCE advisories through Vitest 3.2.7. Updated the dev dependency to `vitest@^4.1.12` (Node >=20 supported, compatible with the project's Vite 7); the patched tree uses `@vitest/mocker@4.1.12` and no vulnerable `tinypool`. The full suite passes and both audits now report zero. This avoids npm's suggested forced Vitest 5 upgrade.

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
| Tests | `npm test` | Passed; 3 files and 23 tests. |
| Build | `npm run build` | Passed; exit 0. |
| Production dependency audit | `npm audit --omit=dev` | Passed; 0 production dependency vulnerabilities reported. |
| Full dependency audit | `npm audit` | Historical Phase 3 run found 3 development dependency findings (1 moderate, 2 critical) in Vitest 3.2.7's `@vitest/mocker`/`tinypool` chain. Remediated during the B-2 re-verification by updating to Vitest 4.1.12; current audit exits 0 with 0 vulnerabilities, and all 46 tests pass. |
| DEMO seed/cleanup | `npm run seed:demo`; `npm run seed:demo:clear` against a uniquely named local database | Passed; created DEMO draft records, removed manifest-owned records, preserved a separately inserted project, then dropped only the isolated test database. |
| Publish/unpublish | `npx vitest run server/src/tests/portfolio.test.ts` | Passed; 1 file and 4 tests; also included in the passing full suite. |

The S3 code path has not been exercised against a cloud account. Asset responses use the API endpoint (including for S3) so unpublished or suspended-workspace assets are not exposed through a direct public object URL.

## B-5 completion record (Phase 4)

**Status: VERIFIED.** B-5 adds tenant-scoped project milestones/releases and badge definitions/awards, shared Zod contracts, owner CRUD/public serializers, a six-definition idempotent seed, and Supertest coverage. User confirmed chronological release ordering: releases are always sorted by descending `releaseDate` then descending `version`; milestones have a `sortOrder` and manual reorder endpoint, while releases intentionally do not have a manual reorder operation.

| Check | Exact command | Result |
|---|---|---|
| Targeted B-5 tests | `npx vitest run server/src/tests/timeline-badges.test.ts` | Passed; 1 file, 6 tests. Covers milestone date/stage validation, completion confirmation, release duplicate `409` field errors and ordering, private timeline/release filtering, badge issuance/revocation, automatic-award idempotency, six platform definitions, and tenant isolation for milestones/releases/awards. |
| Full tests | `npm test` | Passed; 4 source files, 29 tests. Vitest is restricted to `server/src/tests/**/*.test.ts` so compiled `dist/` copies are not run a second time. |
| Lint | `npm run lint` | Exit 0. |
| Typecheck | `npm run typecheck` | Exit 0. |
| Build | `npm run build` | Exit 0. |
| OpenAPI syntax | Node.js `js-yaml` parse of `docs/openapi.yaml` | Parsed successfully; OpenAPI 3.1.0, 46 paths. |
| Platform badge seed | `npm run seed:badges` twice against isolated database `qm-portfolio-b5-seed-final-20261126`; counted `badgedefinitions` where `tenantId: null` and checked the Open-Source Contributor rule | Both runs exited 0; final count was 6 and the Open-Source Contributor badge has no auto-award rule. The isolated database was dropped afterward. |
| Full dependency audit | `npm audit` | Exit 0; 0 vulnerabilities. |
| Production dependency audit | `npm audit --omit=dev` | Exit 0; 0 vulnerabilities. |

## Update rules

- Record concrete repository evidence for status changes.
- Use `Verified` only after running the relevant check successfully.
- Record failed checks and blockers accurately.
- Update this document after meaningful implementation work.
