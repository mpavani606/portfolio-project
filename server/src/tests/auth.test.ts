import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import { env } from "../config/env.js";
import { SessionModel } from "../models/session.js";
import { TenantModel } from "../models/tenant.js";
import { UserModel } from "../models/user.js";
import { createInitialSuperadmin } from "../modules/admin/seed-admin.service.js";
import { mailService } from "../modules/mail-service.js";
import { hashToken } from "../utils/tokens.js";
import { assertTenantIsolation } from "./helpers/assert-tenant-isolation.js";
import { TenantRecordModel, tenantRecordResource } from "./fixtures/tenant-record.js";

const password = "CorrectHorseBattery!92";
const newPassword = "AnotherCorrectBattery!83";
type TestAgent = ReturnType<typeof request.agent>;

async function csrfToken(agent: TestAgent): Promise<string> {
  const response = await agent.get("/api/auth/csrf").expect(200);
  const token: unknown = response.body?.data?.token;
  if (typeof token !== "string") {
    throw new Error("CSRF endpoint did not return a token");
  }
  return token;
}

async function registerUnverified(
  email: string,
): Promise<{ agent: TestAgent; csrf: string; verificationToken: string }> {
  const agent = request.agent(app);
  const csrf = await csrfToken(agent);
  const verificationMail = vi.spyOn(mailService, "sendVerificationEmail").mockResolvedValue();
  await agent
    .post("/api/auth/register")
    .set("x-csrf-token", csrf)
    .send({ email, password })
    .expect(202);
  const verificationToken = verificationMail.mock.calls.at(-1)?.[1];
  if (!verificationToken) {
    throw new Error("Verification email was not requested");
  }
  return { agent, csrf, verificationToken };
}

async function registerAndVerify(
  email: string,
): Promise<{ agent: TestAgent; csrf: string }> {
  const result = await registerUnverified(email);
  await result.agent
    .post("/api/auth/verify-email")
    .set("x-csrf-token", result.csrf)
    .send({ token: result.verificationToken })
    .expect(200);
  return { agent: result.agent, csrf: result.csrf };
}

function loginAgent(agent: TestAgent, csrf: string, email: string, passwordValue = password) {
  return agent
    .post("/api/auth/login")
    .set("x-csrf-token", csrf)
    .send({ email, password: passwordValue });
}

function uniqueEmail(): string {
  return `user-${randomUUID()}@example.test`;
}

beforeAll(async () => {
  await mongoose.connect(env.MONGODB_URI, { dbName: `qm-portfolio-test-${process.pid}` });
  await Promise.all([
    UserModel.init(),
    TenantModel.init(),
    SessionModel.init(),
    TenantRecordModel.init(),
  ]);
});

afterEach(async () => {
  await Promise.all([
    SessionModel.deleteMany({}),
    TenantModel.deleteMany({}),
    UserModel.deleteMany({}),
    TenantRecordModel.deleteMany({}),
  ]);
  vi.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("authentication and workspace onboarding", () => {
  it("registers, verifies, logs in, returns a whitelisted identity, and logs out", async () => {
    const email = uniqueEmail();
    const agent = request.agent(app);
    const csrf = await csrfToken(agent);
    const verificationMail = vi.spyOn(mailService, "sendVerificationEmail").mockResolvedValue();

    const registration = await agent
      .post("/api/auth/register")
      .set("x-csrf-token", csrf)
      .send({ email, password, role: "superadmin" })
      .expect(202);
    expect(registration.body.data.message).toContain("verification instructions");

    const stored = await UserModel.findOne({ email }).select("+verifyTokenHash");
    const verificationToken = verificationMail.mock.calls[0]?.[1];
    expect(stored?.role).toBe("user");
    expect(stored?.isVerified).toBe(false);
    expect(verificationToken).toBeDefined();
    expect(stored?.verifyTokenHash).toBe(hashToken(verificationToken ?? ""));

    await agent
      .post("/api/auth/verify-email")
      .set("x-csrf-token", csrf)
      .send({ token: verificationToken })
      .expect(200);
    await agent
      .post("/api/auth/verify-email")
      .set("x-csrf-token", csrf)
      .send({ token: verificationToken })
      .expect(400);

    const signedIn = await loginAgent(agent, csrf, email).expect(200);
    expect(signedIn.body.data.user).toMatchObject({ email, role: "user", isVerified: true });
    const sessionCookie = String(signedIn.headers["set-cookie"]);
    expect(sessionCookie).toContain("qm_session=");
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    const rawSession = sessionCookie.match(/qm_session=([^;,]+)/)?.[1];
    const storedSession = await SessionModel.findOne({ userId: stored?._id }).select(
      "+sessionIdHash",
    );
    expect(rawSession).toBeDefined();
    expect(storedSession?.sessionIdHash).toBe(hashToken(rawSession ?? ""));
    expect(storedSession?.sessionIdHash).not.toBe(rawSession);

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.data).toMatchObject({
      user: { email, role: "user", isVerified: true },
      tenant: null,
    });
    expect(JSON.stringify(me.body)).not.toContain("passwordHash");
    expect(JSON.stringify(me.body)).not.toContain("verifyTokenHash");

    await agent.post("/api/auth/logout").set("x-csrf-token", csrf).expect(200);
    await agent.get("/api/auth/me").expect(401);
  });

  it("rejects unsafe requests without the CSRF double-submit header", async () => {
    const email = uniqueEmail();
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email, password });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(await UserModel.exists({ email })).toBeNull();
  });

  it("uses the same login error for unknown email and wrong password, then locks repeated failures", async () => {
    const email = uniqueEmail();
    const { agent, csrf } = await registerAndVerify(email);
    const firstWrongPassword = await loginAgent(agent, csrf, email, "WrongPasswordValue!22");
    const unknownAgent = request.agent(app);
    const unknownCsrf = await csrfToken(unknownAgent);
    const unknownEmail = await loginAgent(
      unknownAgent,
      unknownCsrf,
      uniqueEmail(),
      "WrongPasswordValue!22",
    );
    expect(firstWrongPassword.status).toBe(401);
    expect(firstWrongPassword.body).toEqual(unknownEmail.body);
    expect(firstWrongPassword.body.error.message).toBe("Invalid email or password");

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await loginAgent(agent, csrf, email, "WrongPasswordValue!22").expect(401);
    }
    const limited = await loginAgent(agent, csrf, email);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");

    const user = await UserModel.findOne({ email });
    expect(user?.failedLogins).toBe(5);
    expect(user?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });

  it("resends verification with a new single-use token", async () => {
    const email = uniqueEmail();
    const { agent, csrf, verificationToken: oldToken } = await registerUnverified(email);
    const resend = vi.spyOn(mailService, "sendVerificationEmail").mockResolvedValue();

    await agent
      .post("/api/auth/resend-verification")
      .set("x-csrf-token", csrf)
      .send({ email })
      .expect(200);
    const newToken = resend.mock.calls.at(-1)?.[1];
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);

    await agent
      .post("/api/auth/verify-email")
      .set("x-csrf-token", csrf)
      .send({ token: oldToken })
      .expect(400);
    await agent
      .post("/api/auth/verify-email")
      .set("x-csrf-token", csrf)
      .send({ token: newToken })
      .expect(200);
  });

  it("returns a generic forgot-password response and invalidates prior sessions after reset", async () => {
    const email = uniqueEmail();
    const { agent, csrf } = await registerAndVerify(email);
    await loginAgent(agent, csrf, email).expect(200);
    await agent.get("/api/auth/me").expect(200);

    const resetMail = vi.spyOn(mailService, "sendPasswordResetEmail").mockResolvedValue();
    const forgot = await agent
      .post("/api/auth/forgot-password")
      .set("x-csrf-token", csrf)
      .send({ email })
      .expect(200);
    expect(forgot.body.data.message).toContain("If the account exists");

    const token = resetMail.mock.calls[0]?.[1];
    expect(token).toBeDefined();
    const stored = await UserModel.findOne({ email }).select("+resetTokenHash");
    expect(stored?.resetTokenHash).toBe(hashToken(token ?? ""));

    await agent
      .post("/api/auth/reset-password")
      .set("x-csrf-token", csrf)
      .send({ token, password: newPassword })
      .expect(200);
    expect(await SessionModel.countDocuments({})).toBe(0);
    await agent.get("/api/auth/me").expect(401);
    await loginAgent(agent, csrf, email, newPassword).expect(200);
    await agent
      .post("/api/auth/reset-password")
      .set("x-csrf-token", csrf)
      .send({ token, password })
      .expect(400);
  });

  it("changes password only with the current password and invalidates the session", async () => {
    const email = uniqueEmail();
    const { agent, csrf } = await registerAndVerify(email);
    await loginAgent(agent, csrf, email).expect(200);

    await agent
      .post("/api/auth/change-password")
      .set("x-csrf-token", csrf)
      .send({ currentPassword: "WrongCurrentPassword!22", newPassword })
      .expect(401);
    await agent
      .post("/api/auth/change-password")
      .set("x-csrf-token", csrf)
      .send({ currentPassword: password, newPassword })
      .expect(200);
    await agent.get("/api/auth/me").expect(401);
  });

  it("refuses reserved and duplicate workspace slugs and scopes the owner overview", async () => {
    const firstEmail = uniqueEmail();
    const first = await registerAndVerify(firstEmail);
    await loginAgent(first.agent, first.csrf, firstEmail).expect(200);

    const reservedAvailability = await first.agent
      .get("/api/onboarding/slug-available?slug=admin")
      .expect(200);
    expect(reservedAvailability.body.data.available).toBe(false);
    await first.agent
      .post("/api/onboarding/workspace")
      .set("x-csrf-token", first.csrf)
      .send({ slug: "admin", displayName: "Admin Space" })
      .expect(409);

    const created = await first.agent
      .post("/api/onboarding/workspace")
      .set("x-csrf-token", first.csrf)
      .send({
        slug: "pavani-workspace",
        displayName: "Pavani Workspace",
        ownerId: "000000000000000000000001",
        tenantId: "000000000000000000000002",
      })
      .expect(200);
    expect(created.body.data).toMatchObject({
      slug: "pavani-workspace",
      displayName: "Pavani Workspace",
    });
    const firstUser = await UserModel.findOne({ email: firstEmail });
    expect(created.body.data.ownerId).toBe(firstUser?._id.toString());

    const overview = await first.agent.get("/api/owner/overview").expect(200);
    expect(overview.body.data.counts).toEqual({
      education: 0,
      projects: 0,
      certificates: 0,
      assets: 0,
      achievements: 0,
      careerEntries: 0,
      goals: 0,
      messages: 0,
      skills: 0,
    });
    await first.agent
      .post("/api/onboarding/workspace")
      .set("x-csrf-token", first.csrf)
      .send({ slug: "another-workspace", displayName: "Another Workspace" })
      .expect(409);

    const secondEmail = uniqueEmail();
    const second = await registerAndVerify(secondEmail);
    await loginAgent(second.agent, second.csrf, secondEmail).expect(200);
    await second.agent
      .post("/api/onboarding/workspace")
      .set("x-csrf-token", second.csrf)
      .send({ slug: "pavani-workspace", displayName: "Other Workspace" })
      .expect(409);
  });

  it("runs the reusable tenant isolation assertion across read, update, delete, and list", async () => {
    await assertTenantIsolation(tenantRecordResource);
  });

  it("creates a verified superadmin once and refuses a second seed", async () => {
    const email = uniqueEmail();
    await createInitialSuperadmin(email, password);

    const user = await UserModel.findOne({ email }).select("+passwordHash");
    expect(user?.role).toBe("superadmin");
    expect(user?.isVerified).toBe(true);
    expect(user?.passwordHash).not.toBe(password);
    await expect(createInitialSuperadmin(uniqueEmail(), password)).rejects.toThrow(
      "refusing to seed a second time",
    );
  });

  it("always responds generically for a password-reset request to an unknown account", async () => {
    const agent = request.agent(app);
    const csrf = await csrfToken(agent);
    const response = await agent
      .post("/api/auth/forgot-password")
      .set("x-csrf-token", csrf)
      .send({ email: uniqueEmail() })
      .expect(200);

    expect(response.body.data.message).toContain("If the account exists");
  });
});
