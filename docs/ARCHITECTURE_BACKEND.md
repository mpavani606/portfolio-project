# Backend Architecture and Implementation Audit

Updated: 2026-11-26  
Scope: Verified backend foundation, authentication/workspace onboarding, and Phase 3 portfolio CMS/public API. The original `backend/` directory remains unchanged.

## Current tree

```text
server/src/
  app.ts
  server.ts
  config/
    database.ts
    env.ts
  middleware/
    auth.ts
    auth-rate-limit.ts
    contact-rate-limit.ts
    csrf-header-hook.ts
    error-handler.ts
    image-upload.ts
    rate-limit.ts
    request-id.ts
    validate.ts
  models/
    index.ts
    portfolio.ts
    session.ts
    tenant.ts
    user.ts
  modules/
    admin/
      seed-admin.service.ts
      seed-demo.service.ts
    assets/
      storage.ts
    auth/
      auth.service.ts
    portfolio/
      owner-resource.ts
      relations.ts
      serializers.ts
    mail-service.ts
  routes/
    auth.routes.ts
    onboarding.routes.ts
    owner-content.routes.ts
    owner-upload.routes.ts
    owner.routes.ts
    public.routes.ts
  seed/
    admin.ts
    clear-demo.ts
    demo.ts
  tests/
    app.test.ts
    auth.test.ts
    fixtures/
      tenant-record.ts
    helpers/
      assert-tenant-isolation.ts
      tenant-model-isolation.ts
    portfolio.test.ts
    setup.ts
  types/
    express.d.ts
  utils/
    api-error.ts
    async-handler.ts
    cookies.ts
    logger.ts
    request-context.ts
    response.ts
    tenant-scoped.ts
    tokens.ts
shared/
  api.ts
  auth.ts
  onboarding.ts
  portfolio.ts
  user.ts
.github/workflows/backend.yml
```

`app.ts` configures Express without opening a listener; `server.ts` validates environment settings, connects Mongoose, listens, and handles graceful shutdown. Shared Zod schemas define auth, onboarding, owner-resource, upload, contact, and list-query contracts. Models persist accounts, workspaces, sessions, portfolio records, assets, and the demo cleanup manifest. Route handlers use session-derived tenant identity and explicit owner/public DTO serializers.

## API inventory

All implemented API routes use the global rate limiter. Unsafe methods require the double-submit CSRF cookie/header check. Owner endpoints require an authenticated, verified user and active workspace; the tenant ID comes only from the server session. Public JSON endpoints use explicit serializers, and asset bytes are served only for active workspaces while a published resource references them.

| Endpoint | Exists? | Auth | Validation | Ownership check | Rate limit | DTO whitelist | Verdict |
|---|---|---|---|---|---|---|---|
| `GET /api/health`, `GET /api/ready` | Yes | Public | No input | N/A | Global | Fixed status/error envelope | working |
| `GET /api/auth/csrf` | Yes | Public | No input | N/A | Global | Token response | working |
| `/api/auth/{register,verify-email,resend-verification,login,logout,me,forgot-password,reset-password,change-password}` | Yes | Public or session; CSRF for unsafe | Shared Zod schemas | Session/token-derived | Global + route-specific auth limiters | User/tenant/message allowlists | working |
| `/api/onboarding/slug-available`, `/api/onboarding/workspace` | Yes | Verified session | Shared Zod query/body | Owner ID from session; one tenant per user | Global | Tenant response fields only | working |
| `GET /api/owner/overview` | Yes | Verified session + active tenant | No input | Tenant from session | Global | Explicit counts/checklist | working |
| `GET, PUT /api/owner/profile`; `PATCH /api/owner/profile/publish` | Yes | Verified session + active tenant; CSRF for writes | Shared Zod schemas | Tenant from session | Global | Explicit profile DTO | working |
| `GET, POST /api/owner/{projects,skills,achievements,career,goals}` | Yes | Verified session + active tenant; CSRF for writes | Shared Zod query/body schemas | `tenantScoped` | Global | Resource-specific owner DTO | working |
| `GET, PATCH, DELETE /api/owner/{resource}/:id`; `PATCH /api/owner/{resource}/:id/publish` | Yes | Verified session + active tenant; CSRF for writes | Shared Zod params/body schemas | `_id` and `tenantId` are queried together | Global | Resource-specific owner DTO | working |
| `PATCH /api/owner/projects/reorder` | Yes | Verified session + active tenant + CSRF | Shared Zod body schema | Every project ID checked within session tenant | Global | Project owner DTOs | working |
| `GET /api/owner/messages`; `PATCH, DELETE /api/owner/messages/:id` | Yes | Verified session + active tenant; CSRF for writes | Shared Zod query/params/body schemas | Tenant in every inbox query/write | Global | Inbox DTO omits IP hash and tenant ID | working |
| `POST /api/owner/uploads/image` | Yes | Verified session + active tenant + CSRF | Multipart, size, extension/MIME/signature checks; Sharp decode | Storage key and Asset row use session tenant | Global | Asset key, URL, dimensions only | working |
| `GET /api/public/:slug/profile` | Yes | Public | Shared Zod slug | Active tenant lookup | Global | Profile whitelist honors email/location settings | working |
| `GET /api/public/:slug/projects`, `GET /api/public/:slug/projects/:projectSlug` | Yes | Public | Shared Zod params/query | Active tenant and tenant-scoped published record | Global | Project whitelist | working |
| `GET /api/public/:slug/{skills,achievements,career,goals}` | Yes | Public | Shared Zod params/query | Active tenant and tenant-scoped published records; achievement visibility checked | Global | Per-resource public whitelist | working |
| `POST /api/public/:slug/contact` | Yes | Public + CSRF | Shared Zod body; honeypot and length checks | Active tenant from requested public slug | Global + contact limiter | Accepted/message response only | working |
| `GET /api/public/assets/:key` | Yes | Public | Shared Zod key | Asset must belong to active tenant and a published reference | Global | WebP bytes only | working |
| Admin account management beyond bootstrap | No | Admin only, proposed | Missing | Missing | Missing | Missing | missing |
| Score, QR, resume, timeline, analytics, certificate-verification workflows | No | Mixed, proposed | Missing | Missing | Missing | Missing | missing |
| AI suggestions, collaboration, visitor feedback, reports, PDF export | No | Mixed or unspecified in blueprint | Missing | Missing | Missing | Missing | missing |

Resource list queries support pagination, search, status, and allowlisted sort keys. Project deletion removes its ID from same-tenant skill evidence references. Uploads are transcoded to WebP without preserving image metadata. The S3 adapter stores private objects and reads them through the gated API endpoint rather than exposing a public bucket URL.

`assertTenantIsolation(resource)` is run for every tenant-owned portfolio model; it proves cross-tenant read, update, delete, and list isolation through `tenantScoped`. Route tests also exercise owner requests using separate sessions and workspaces.

## Model inventory

| Model/data area | Exists? | `tenantId` present? | Indexes present? |
|---|---|---|---|
| User and role | Yes | No; identity/owner record | Unique lowercase email; unique sparse verification/reset token hashes; partial unique index for one initial superadmin |
| Tenant/workspace | Yes | N/A; tenant record | Unique owner ID and slug |
| Session | Yes | Nullable until workspace onboarding | Unique session hash; user/tenant indexes; expiry TTL and user/expiry indexes |
| Profile | Yes | Yes | Unique tenant; tenant + publish state |
| Project | Yes | Yes | Unique tenant + slug; tenant + publish/sort; tenant + status |
| Skill | Yes | Yes | Tenant + publish/category; tenant + status |
| Achievement | Yes | Yes | Tenant + publish/visibility; tenant + type |
| CareerEntry (education, experience, learning) | Yes | Yes | Tenant + publish/kind/start date |
| Goal | Yes | Yes | Tenant + publish/horizon; tenant + status/target date |
| ContactMessage | Yes | Yes | Tenant + status/created date; tenant + publish state |
| Asset | Yes | Yes | Unique key; unique tenant + key; tenant + publish state |
| DemoSeedManifest | Yes | Yes | Unique tenant + seed key |
| Tenant isolation fixture (tests only) | Yes | Yes | Test-only unique/indexed fixture fields |

Portfolio models use Mongoose timestamps. All public routes serialize whitelisted values; Mongoose documents, tenant IDs, owner IDs, internal hashes, and contact IP hashes are not returned directly.

## Security and migration risks

- Public registration is approved scope from the original blueprint. Signup always creates a regular user; the initial superadmin is bootstrapped once through the seed command.
- Session cookies are HttpOnly, SameSite=Lax, scoped to `/api`, Secure in production, and contain a random opaque token whose hash is stored in MongoDB. Unsafe requests validate the signed double-submit CSRF cookie/header.
- Passwords use bcrypt with cost 12. Verification/reset tokens are random, single-use, time-limited, and stored as hashes. Reset/change-password invalidates sessions.
- Authenticated tenant identity is taken from the server session, checked against the tenant owner and active status, and never accepted from client payloads. Owner reads/writes combine tenant ID and resource ID.
- Public content requires a published profile and published resource; achievements additionally require public visibility. Private contact messages and IP hashes remain owner-only.
- Verification status is limited to `owner_entered` or `evidence_provided`; a URL cannot produce an issuer-verified label.
- S3 production storage uses the AWS default credential chain. Keep the bucket private and grant the server role only the needed object operations. Public delivery is proxied through the API and checks active tenant/published references. S3 integration was not live-tested against a cloud account.
- Rate limiters use the process-local default store. Multi-instance deployments need a shared store and proxy/IP configuration review.
- `npm audit` reports 3 development-tool findings (1 moderate in `@vitest/mocker`, 2 critical in `tinypool` through Vitest). `npm audit --omit=dev` reports none; npm's suggested fix is a breaking Vitest 5 upgrade, so the existing test-runner major was not changed in this feature task.
- Unique-index creation against legacy collections may fail if duplicate emails, slugs, owners, or privileged roles already exist. There is no migration runner or legacy data migration in this repository; back up and reconcile duplicates before deploying indexes to populated databases.
- The project slug and profile unique indexes are new. Existing documents must be backfilled with valid per-tenant slugs and at most one profile before deploying to a populated database.
- Demo seed/cleanup is restricted to a `demo-test-*` workspace in non-production. Cleanup deletes only IDs from the exact per-tenant manifest, but operators should still verify the selected slug before running it.
- SMTP has not been exercised against a real mail provider. Do not enable development token-link logging in production.
- No full deployment/security audit has been completed.

## Incremental backend plan

The blueprint defines releases rather than numbered phases. The numbered 0–16 sequence below is the repository's implementation breakdown.

| Phase | Backend scope | Current state |
|---:|---|---|
| 0 | Repository audit, baseline, API/model inventory | Verified |
| 1 | Express/TypeScript foundation, configuration, middleware, health/readiness, CI | Verified |
| 2 | User/Tenant/Session models, authentication, verification, workspace onboarding, tenant isolation | Verified |
| 3 | Profile, projects, skills, achievements, career, goals, owner CMS, uploads, public APIs, contact inbox | Verified |
| 4 | Admin account management beyond initial bootstrap, including generated R1 IDs and initial credentials | Not started |
| 5 | Frontend profile/dashboard workflows | Not started |
| 6 | Frontend education management | Not started |
| 7 | Frontend project management | Not started |
| 8 | Frontend professional links | Not started |
| 9 | PDF uploads and frontend asset workflow | Not started |
| 10 | Frontend public portfolio and publishing UI | Not started |
| 11 | Three-language interface/content support | Not started |
| 12 | Portfolio score, QR, resume, timeline, analytics | Not started |
| 13 | Certificate verification policy and integration | Not started |
| 14 | AI suggestion routes and provider configuration | Not started |
| 15 | Collaboration, feedback, reports, PDF export; confirmed future additions | Not started |
| 16 | Security review, migration planning, deployment, full verification | Not started |

## Phase 3 verification record

Environment: Node `v26.8.2`, npm `11.19.1`; MongoDB was already available at `127.0.0.1:27017`. The test suite uses a process-specific database. The shared MongoDB service was not stopped.

| Check | Exact command | Result |
|---|---|---|
| Install | `npm ci --no-audit --no-fund` | Exit 0; 339 packages restored. npm warned that the locked ESLint version is deprecated and that esbuild's install script is not approved by the local install-script policy. |
| Lint | `npm run lint` | Passed; exit 0. |
| Typecheck | `npm run typecheck` | Passed; exit 0. |
| Tests | `npm test` | Passed; 3 files and 23 tests. Includes CRUD, tenant isolation for all portfolio models, public filtering/privacy, upload validation, contact rate limiting, production asset-origin validation, async-handler forwarding, and publish/unpublish behavior. |
| Build | `npm run build` | Passed; exit 0. |
| Production dependency audit | `npm audit --omit=dev` | Passed; 0 production dependency vulnerabilities reported. |
| Full dependency audit | `npm audit` | Exit 1; reported 3 development dependency findings (1 moderate, 2 critical) in the Vitest/`@vitest/mocker`/`tinypool` chain. The suggested forced fix requires a breaking Vitest 5 upgrade; no test-runner major upgrade was made here. |
| DEMO seed/cleanup | `npm run seed:demo`; `npm run seed:demo:clear` against a uniquely named local database | Passed; created DEMO draft records, removed manifest-owned records, preserved a separately inserted project, then dropped only the isolated test database. |
| Publish/unpublish flow | `npx vitest run server/src/tests/portfolio.test.ts` | Passed; 1 file and 4 tests. The full `npm test` suite also passed. |

## Local commands

From the repository root in PowerShell, with MongoDB running:

```powershell
Copy-Item .env.example .env
# Set SESSION_SECRET to a random value of at least 32 characters.
npm ci
npm run dev
```

The default API port is 3000. In another terminal:

```powershell
curl.exe http://localhost:3000/api/health
curl.exe http://localhost:3000/api/ready
```

For initial admin bootstrap, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env`, then run `npm run seed:admin` once.

## Confirmed scope additions beyond the blueprint

Confirmed by the user for future planning on 2026-11-26; not implemented or specified as API contracts:

- Public pages for badges and coding profiles, plus a canonical passport URL.
- Dashboard pages for messages, settings, and audit logs.
