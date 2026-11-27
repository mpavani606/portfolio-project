import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { env } from "../config/env.js";
import app from "../app.js";
import { imageUploadResponseSchema } from "../../../shared/portfolio.js";
import { SessionModel } from "../models/session.js";
import { TenantModel } from "../models/tenant.js";
import { UserModel } from "../models/user.js";
import {
  AchievementModel,
  AssetModel,
  CareerEntryModel,
  ContactMessageModel,
  DemoSeedManifestModel,
  GoalModel,
  ProfileModel,
  ProjectModel,
  SkillModel,
} from "../models/portfolio.js";
import { createCsrfToken, createOpaqueToken, hashToken } from "../utils/tokens.js";
import { assertTenantIsolation } from "./helpers/assert-tenant-isolation.js";
import { tenantModelIsolationResource } from "./helpers/tenant-model-isolation.js";

const uploadDirectory = join(tmpdir(), `qm-portfolio-test-uploads-${process.pid}`);

interface OwnerSession {
  cookie: string;
  csrf: string;
  email: string;
  tenantId: Types.ObjectId;
  slug: string;
}

async function createOwnerSession(): Promise<OwnerSession> {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 16);
  const email = `portfolio-${suffix}@example.test`;
  const user = await UserModel.create({
    email,
    passwordHash: "test-only-hash",
    isVerified: true,
  });
  const tenant = await TenantModel.create({
    ownerId: user._id,
    slug: `portfolio-${suffix}`,
    displayName: `Portfolio ${suffix}`,
  });
  const sessionToken = createOpaqueToken();
  const csrf = createCsrfToken();
  await SessionModel.create({
    sessionIdHash: hashToken(sessionToken),
    userId: user._id,
    tenantId: tenant._id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    tokenVersion: user.tokenVersion,
  });
  return {
    cookie: `qm_session=${sessionToken}; qm_csrf=${csrf}`,
    csrf,
    email,
    tenantId: tenant._id,
    slug: tenant.slug,
  };
}

function ownerGet(owner: OwnerSession, path: string) {
  return request(app).get(path).set("Cookie", owner.cookie);
}

function ownerPost(owner: OwnerSession, path: string, body: object) {
  return request(app)
    .post(path)
    .set("Cookie", owner.cookie)
    .set("x-csrf-token", owner.csrf)
    .send(body);
}

function ownerPut(owner: OwnerSession, path: string, body: object) {
  return request(app)
    .put(path)
    .set("Cookie", owner.cookie)
    .set("x-csrf-token", owner.csrf)
    .send(body);
}

function ownerPatch(owner: OwnerSession, path: string, body: object) {
  return request(app)
    .patch(path)
    .set("Cookie", owner.cookie)
    .set("x-csrf-token", owner.csrf)
    .send(body);
}

function ownerDelete(owner: OwnerSession, path: string) {
  return request(app)
    .delete(path)
    .set("Cookie", owner.cookie)
    .set("x-csrf-token", owner.csrf);
}

function objectIdString(): string {
  return new Types.ObjectId().toString();
}

beforeAll(async () => {
  await mongoose.connect(env.MONGODB_URI, { dbName: `qm-portfolio-content-test-${process.pid}` });
  await Promise.all([
    UserModel.init(),
    TenantModel.init(),
    SessionModel.init(),
    ProfileModel.init(),
    ProjectModel.init(),
    SkillModel.init(),
    AchievementModel.init(),
    CareerEntryModel.init(),
    GoalModel.init(),
    ContactMessageModel.init(),
    AssetModel.init(),
    DemoSeedManifestModel.init(),
  ]);
});

afterEach(async () => {
  await Promise.all([
    SessionModel.deleteMany({}),
    TenantModel.deleteMany({}),
    UserModel.deleteMany({}),
    ProfileModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    SkillModel.deleteMany({}),
    AchievementModel.deleteMany({}),
    CareerEntryModel.deleteMany({}),
    GoalModel.deleteMany({}),
    ContactMessageModel.deleteMany({}),
    AssetModel.deleteMany({}),
    DemoSeedManifestModel.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await rm(uploadDirectory, { recursive: true, force: true });
});

describe("owner portfolio CMS", () => {
  it("persists profile and performs paginated CRUD, publish, and reorder for every portfolio resource", async () => {
    const owner = await createOwnerSession();
    const profileMissing = await ownerGet(owner, "/api/owner/profile");
    expect(profileMissing.status).toBe(404);

    const profile = await ownerPut(owner, "/api/owner/profile", {
      fullName: "Example Owner",
      headline: "Backend developer",
      bio: "A sample biography.",
      location: "Private Location",
      contactEmail: "private@example.test",
      publicFields: { email: false, location: false },
      socialLinks: [{ label: "GitHub", url: "https://github.com/example" }],
      ownerId: objectIdString(),
      tenantId: objectIdString(),
    }).expect(200);
    expect(profile.body.data).toMatchObject({
      fullName: "Example Owner",
      publishState: "draft",
      contactEmail: "private@example.test",
    });
    expect(profile.body.data).not.toHaveProperty("tenantId");
    expect(profile.body.data).not.toHaveProperty("ownerId");
    await ownerGet(owner, "/api/owner/profile").expect(200);

    const invalidProject = await ownerPost(owner, "/api/owner/projects", {
      title: "",
      slug: "invalid project slug",
    }).expect(400);
    expect(invalidProject.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      fields: {
        title: expect.any(Array),
        slug: expect.any(Array),
      },
    });

    const projectResponse = await ownerPost(owner, "/api/owner/projects", {
      title: "DEMO Backend API",
      slug: "demo-backend-api",
      summary: "First project.",
      description: "A project description.",
      techStack: ["TypeScript", "Node.js"],
      status: "planning",
      tenantId: objectIdString(),
      privateNotes: "must not be persisted",
    }).expect(201);
    const projectId = projectResponse.body.data.id as string;
    expect(projectResponse.body.data).not.toHaveProperty("tenantId");
    expect(projectResponse.body.data).not.toHaveProperty("privateNotes");
    const storedProject = await ProjectModel.findById(projectId);
    expect(storedProject?.tenantId.toString()).toBe(owner.tenantId.toString());
    expect(storedProject?.toObject()).not.toHaveProperty("privateNotes");

    await ownerPost(owner, "/api/owner/projects", {
      title: "Duplicate slug",
      slug: "demo-backend-api",
    }).expect(409);
    const projectList = await ownerGet(owner, "/api/owner/projects?page=1&limit=1&q=Backend&status=planning")
      .expect(200);
    expect(projectList.body.data).toHaveLength(1);
    expect(projectList.body.meta).toMatchObject({ page: 1, limit: 1, total: 1, pages: 1 });
    await ownerGet(owner, "/api/owner/projects?page=0").expect(400);
    await ownerGet(owner, "/api/owner/projects?sort=tenantId").expect(400);
    await ownerGet(owner, "/api/owner/projects?status=unknown").expect(400);
    await ownerGet(owner, `/api/owner/projects/${projectId}`).expect(200);
    await ownerPatch(owner, `/api/owner/projects/${projectId}`, {
      summary: "Updated project summary.",
    }).expect(200);
    const reordered = await ownerPatch(owner, "/api/owner/projects/reorder", {
      projects: [{ id: projectId, sortOrder: 3 }],
    }).expect(200);
    expect(reordered.body.data[0].sortOrder).toBe(3);
    const publishedProject = await ownerPatch(owner, `/api/owner/projects/${projectId}/publish`, {
      publishState: "published",
    }).expect(200);
    expect(publishedProject.body.data.publishState).toBe("published");

    const skill = await ownerPost(owner, "/api/owner/skills", {
      name: "TypeScript",
      category: "Programming",
      status: "practicing",
      progressSelfReported: 55,
      evidenceProjectIds: [projectId],
    }).expect(201);
    const skillId = skill.body.data.id as string;
    await ownerGet(owner, "/api/owner/skills?q=TypeScript&status=practicing").expect(200);
    await ownerGet(owner, `/api/owner/skills/${skillId}`).expect(200);
    await ownerPatch(owner, `/api/owner/skills/${skillId}`, { progressSelfReported: 60 }).expect(200);
    await ownerPatch(owner, `/api/owner/skills/${skillId}/publish`, {
      publishState: "published",
    }).expect(200);

    const achievement = await ownerPost(owner, "/api/owner/achievements", {
      title: "Owner-entered certificate",
      type: "certificate",
      issuer: "Example issuer",
      issueDate: "2024-01-01",
      expiryDate: "2024-12-01",
      verificationUrl: "https://example.test/credential/1",
      verificationStatus: "issuer_verified",
      visibility: "public",
    }).expect(201);
    const achievementId = achievement.body.data.id as string;
    expect(achievement.body.data.verificationStatus).toBe("evidence_provided");
    expect(achievement.body.data.verificationStatus).not.toBe("issuer_verified");
    await ownerGet(owner, "/api/owner/achievements?status=public").expect(200);
    await ownerGet(owner, `/api/owner/achievements/${achievementId}`).expect(200);
    await ownerPatch(owner, `/api/owner/achievements/${achievementId}`, { issuer: "Updated issuer" }).expect(200);
    await ownerPatch(owner, `/api/owner/achievements/${achievementId}`, {
      issueDate: "2025-01-01",
    }).expect(400);
    await ownerPatch(owner, `/api/owner/achievements/${achievementId}/publish`, {
      publishState: "published",
    }).expect(200);

    const career = await ownerPost(owner, "/api/owner/career", {
      kind: "experience",
      title: "DEMO Software role",
      organization: "Example Company",
      startDate: "2023-01-01",
      endDate: "2024-01-01",
    }).expect(201);
    const careerId = career.body.data.id as string;
    await ownerGet(owner, "/api/owner/career?status=experience").expect(200);
    await ownerGet(owner, `/api/owner/career/${careerId}`).expect(200);
    await ownerPatch(owner, `/api/owner/career/${careerId}`, { organization: "Updated Company" }).expect(200);
    await ownerPatch(owner, `/api/owner/career/${careerId}`, {
      endDate: "2022-01-01",
    }).expect(400);
    await ownerPatch(owner, `/api/owner/career/${careerId}/publish`, {
      publishState: "published",
    }).expect(200);
    await ownerPost(owner, "/api/owner/career", {
      kind: "education",
      title: "Invalid date range",
      startDate: "2025-01-01",
      endDate: "2024-01-01",
    }).expect(400);

    const goal = await ownerPost(owner, "/api/owner/goals", {
      title: "Build a portfolio API",
      horizon: "short",
      targetDate: "2026-12-01",
      status: "in_progress",
      relatedTechnologies: ["Node.js"],
    }).expect(201);
    const goalId = goal.body.data.id as string;
    await ownerGet(owner, "/api/owner/goals?status=in_progress").expect(200);
    await ownerGet(owner, `/api/owner/goals/${goalId}`).expect(200);
    await ownerPatch(owner, `/api/owner/goals/${goalId}`, { status: "completed" }).expect(200);
    await ownerPatch(owner, `/api/owner/goals/${goalId}/publish`, {
      publishState: "published",
    }).expect(200);

    const secondOwner = await createOwnerSession();
    await ownerGet(secondOwner, `/api/owner/projects/${projectId}`).expect(404);
    await ownerDelete(secondOwner, `/api/owner/projects/${projectId}`).expect(404);

    const overview = await ownerGet(owner, "/api/owner/overview").expect(200);
    expect(overview.body.data.counts).toEqual({
      education: 0,
      projects: 1,
      certificates: 1,
      assets: 0,
      skills: 1,
      achievements: 1,
      careerEntries: 1,
      goals: 1,
      messages: 0,
    });
    expect(overview.body.data.checklist).toEqual({
      profileComplete: true,
      professionalLinksConfigured: true,
      portfolioPublished: false,
    });

    await ownerDelete(owner, `/api/owner/projects/${projectId}`).expect(200);
    await ownerDelete(owner, `/api/owner/skills/${skillId}`).expect(200);
    await ownerDelete(owner, `/api/owner/achievements/${achievementId}`).expect(200);
    await ownerDelete(owner, `/api/owner/career/${careerId}`).expect(200);
    await ownerDelete(owner, `/api/owner/goals/${goalId}`).expect(200);
    await ownerGet(owner, `/api/owner/projects/${projectId}`).expect(404);
  });

  it("enforces tenant isolation for every portfolio model through tenantScoped", async () => {
    const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const fixtures = [
      tenantModelIsolationResource({
        model: ProfileModel,
        build: (value) => ({ fullName: value, bio: value }),
        getValue: (document) => document.bio ?? "",
        update: (value) => ({ bio: value }),
      }),
      tenantModelIsolationResource({
        model: ProjectModel,
        build: (value) => ({ title: value, slug: slug(value), summary: value }),
        getValue: (document) => document.summary ?? "",
        update: (value) => ({ summary: value }),
      }),
      tenantModelIsolationResource({
        model: SkillModel,
        build: (value) => ({ name: value, category: value }),
        getValue: (document) => document.category ?? "",
        update: (value) => ({ category: value }),
      }),
      tenantModelIsolationResource({
        model: AchievementModel,
        build: (value) => ({ title: value, type: "training" as const, issuer: value }),
        getValue: (document) => document.issuer ?? "",
        update: (value) => ({ issuer: value }),
      }),
      tenantModelIsolationResource({
        model: CareerEntryModel,
        build: (value) => ({ title: value, kind: "learning" as const, organization: value }),
        getValue: (document) => document.organization ?? "",
        update: (value) => ({ organization: value }),
      }),
      tenantModelIsolationResource({
        model: GoalModel,
        build: (value) => ({ title: value, horizon: "short" as const, description: value }),
        getValue: (document) => document.description ?? "",
        update: (value) => ({ description: value }),
      }),
      tenantModelIsolationResource({
        model: ContactMessageModel,
        build: (value) => ({
          name: "Example Sender",
          email: "sender@example.test",
          subject: value,
          message: value,
          ipHash: "test-hash",
        }),
        getValue: (document) => document.message,
        update: (value) => ({ message: value }),
      }),
      tenantModelIsolationResource({
        model: AssetModel,
        build: (value) => ({
          key: `${value.replace(/[^a-z0-9-]/gi, "-")}-${randomUUID()}.webp`,
          url: value,
          mimeType: "image/webp" as const,
          width: 1,
          height: 1,
          sizeBytes: 16,
          storageProvider: "local" as const,
        }),
        getValue: (document) => document.url,
        update: (value) => ({ url: value }),
      }),
      tenantModelIsolationResource({
        model: DemoSeedManifestModel,
        build: (value) => ({ seedKey: value }),
        getValue: (document) => document.seedKey,
        update: (value) => ({ seedKey: value }),
      }),
    ];
    for (const resource of fixtures) {
      await assertTenantIsolation(resource);
    }
  });
});

describe("public portfolio and image/contact APIs", () => {
  it("serves only published whitelisted records without private fields and hides unpublished profiles", async () => {
    const owner = await createOwnerSession();
    const draftProject = await ownerPost(owner, "/api/owner/projects", {
      title: "Draft project",
      slug: "draft-project",
      privateNotes: "never public",
    }).expect(201);
    const publishedProject = await ownerPost(owner, "/api/owner/projects", {
      title: "Published project",
      slug: "published-project",
      summary: "Public summary.",
    }).expect(201);
    await ownerPatch(owner, `/api/owner/projects/${publishedProject.body.data.id}/publish`, {
      publishState: "published",
    }).expect(200);

    await request(app).get(`/api/public/${owner.slug}/projects`).expect(404);
    await ownerPut(owner, "/api/owner/profile", {
      fullName: "Public Profile",
      headline: "Public headline",
      bio: "Public bio.",
      location: "Private Location",
      contactEmail: "hidden@example.test",
      publicFields: { email: false, location: false },
    }).expect(200);
    await ownerPatch(owner, "/api/owner/profile/publish", { publishState: "published" }).expect(200);

    const skill = await ownerPost(owner, "/api/owner/skills", {
      name: "Published skill",
      category: "Engineering",
    }).expect(201);
    await ownerPatch(owner, `/api/owner/skills/${skill.body.data.id}/publish`, {
      publishState: "published",
    }).expect(200);
    const publicAchievement = await ownerPost(owner, "/api/owner/achievements", {
      title: "Public achievement",
      type: "training",
      visibility: "public",
      verificationUrl: "https://example.test/credential",
    }).expect(201);
    await ownerPatch(owner, `/api/owner/achievements/${publicAchievement.body.data.id}/publish`, {
      publishState: "published",
    }).expect(200);
    const privateAchievement = await ownerPost(owner, "/api/owner/achievements", {
      title: "Private achievement",
      type: "education",
      visibility: "private",
    }).expect(201);
    await ownerPatch(owner, `/api/owner/achievements/${privateAchievement.body.data.id}/publish`, {
      publishState: "published",
    }).expect(200);
    const career = await ownerPost(owner, "/api/owner/career", {
      kind: "education",
      title: "Published education",
      organization: "Example school",
    }).expect(201);
    await ownerPatch(owner, `/api/owner/career/${career.body.data.id}/publish`, {
      publishState: "published",
    }).expect(200);
    const goal = await ownerPost(owner, "/api/owner/goals", {
      title: "Published goal",
      horizon: "short",
    }).expect(201);
    await ownerPatch(owner, `/api/owner/goals/${goal.body.data.id}/publish`, {
      publishState: "published",
    }).expect(200);

    const publicProjects = await request(app)
      .get(`/api/public/${owner.slug}/projects`)
      .expect(200);
    expect(publicProjects.body.data.map((project: { slug: string }) => project.slug)).toEqual([
      "published-project",
    ]);
    const serializedProjects = JSON.stringify(publicProjects.body);
    for (const sensitiveField of ["tenantId", "ownerId", "privateNotes", "contactEmail"]) {
      expect(serializedProjects).not.toContain(sensitiveField);
    }

    const publicProfile = await request(app)
      .get(`/api/public/${owner.slug}/profile`)
      .expect(200);
    expect(publicProfile.body.data).not.toHaveProperty("location");
    expect(publicProfile.body.data).not.toHaveProperty("contactEmail");
    expect(JSON.stringify(publicProfile.body)).not.toContain("tenantId");
    expect(JSON.stringify(publicProfile.body)).not.toContain("ownerId");
    const publicResourceResponses = await Promise.all([
      request(app).get(`/api/public/${owner.slug}/projects/published-project`).expect(200),
      request(app).get(`/api/public/${owner.slug}/skills`).expect(200),
      request(app).get(`/api/public/${owner.slug}/achievements`).expect(200),
      request(app).get(`/api/public/${owner.slug}/career`).expect(200),
      request(app).get(`/api/public/${owner.slug}/goals`).expect(200),
    ]);
    expect(publicResourceResponses[2].body.data.map((item: { title: string }) => item.title))
      .toEqual(["Public achievement"]);
    for (const response of publicResourceResponses) {
      const serialized = JSON.stringify(response.body);
      for (const sensitiveField of ["tenantId", "ownerId", "privateNotes", "contactEmail"]) {
        expect(serialized).not.toContain(sensitiveField);
      }
    }

    await ownerPatch(owner, `/api/owner/projects/${publishedProject.body.data.id}/publish`, {
      publishState: "draft",
    }).expect(200);
    const unpublished = await request(app)
      .get(`/api/public/${owner.slug}/projects`)
      .expect(200);
    expect(unpublished.body.data).toEqual([]);
    await ownerDelete(owner, `/api/owner/projects/${draftProject.body.data.id}`).expect(200);
    await request(app).get("/api/public/not-a-real-workspace/profile").expect(404);
  });

  it("validates and strips metadata from uploads, restricts local asset reads, and handles contact inbox state", async () => {
    const owner = await createOwnerSession();
    await ownerPut(owner, "/api/owner/profile", {
      fullName: "Contact Portfolio",
      headline: "Contact me",
      bio: "Public contact profile.",
      contactEmail: "private@example.test",
      publicFields: { email: false, location: false },
    }).expect(200);
    await ownerPatch(owner, "/api/owner/profile/publish", { publishState: "published" }).expect(200);

    const csrf = owner.csrf;
    const csrfCookie = `qm_csrf=${csrf}`;
    const fakeImage = await request(app)
      .post("/api/owner/uploads/image")
      .set("Cookie", owner.cookie)
      .set("x-csrf-token", csrf)
      .attach("image", Buffer.from("not actually an image"), {
        filename: "fake.png",
        contentType: "image/png",
      })
      .expect(400);
    expect(fakeImage.body.error.code).toBe("VALIDATION_ERROR");
    expect(await AssetModel.countDocuments({ tenantId: owner.tenantId })).toBe(0);

    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 80, g: 120, b: 200 },
      },
    }).png().toBuffer();
    const upload = await request(app)
      .post("/api/owner/uploads/image")
      .set("Cookie", owner.cookie)
      .set("x-csrf-token", csrf)
      .attach("image", png, { filename: "cover.png", contentType: "image/png" })
      .expect(201);
    expect(() => imageUploadResponseSchema.parse(upload.body.data)).not.toThrow();
    expect(upload.body.data).toMatchObject({
      assetId: expect.any(String),
      key: expect.any(String),
      url: expect.any(String),
      width: 2,
      height: 2,
    });
    expect(upload.body.data.url).toContain(upload.body.data.key);

    const asset = await AssetModel.findOne({ key: upload.body.data.key });
    expect(asset).not.toBeNull();
    expect(upload.body.data.assetId).toBe(asset?._id.toString());
    expect(asset?.mimeType).toBe("image/webp");

    const assetPath = new URL(upload.body.data.url).pathname;
    await request(app).get(assetPath).expect(404);

    const project = await ownerPost(owner, "/api/owner/projects", {
      title: "Image project",
      slug: "image-project",
      coverAsset: asset?._id.toString(),
    }).expect(201);
    await ownerPatch(owner, `/api/owner/projects/${project.body.data.id}/publish`, {
      publishState: "published",
    }).expect(200);
    const imageRead = await request(app).get(assetPath).expect(200);
    expect(imageRead.headers["content-type"]).toContain("image/webp");
    const publicProject = await request(app)
      .get(`/api/public/${owner.slug}/projects`)
      .expect(200);
    expect(publicProject.body.data[0].coverUrl).toBe(upload.body.data.url);
    await TenantModel.updateOne({ _id: owner.tenantId }, { $set: { status: "suspended" } });
    await request(app).get(assetPath).expect(404);
    await TenantModel.updateOne({ _id: owner.tenantId }, { $set: { status: "active" } });
    await ownerDelete(owner, `/api/owner/projects/${project.body.data.id}`).expect(200);

    const contactBody = {
      name: "Visitor",
      email: "visitor@example.test",
      subject: "A question",
      message: "I would like to know more.",
      honeypot: "",
    };
    const honeypot = await request(app)
      .post(`/api/public/${owner.slug}/contact`)
      .set("Cookie", csrfCookie)
      .set("x-csrf-token", csrf)
      .send({ ...contactBody, honeypot: "automated spam" })
      .expect(202);
    expect(honeypot.body.data.accepted).toBe(true);

    for (let index = 0; index < 4; index += 1) {
      await request(app)
        .post(`/api/public/${owner.slug}/contact`)
        .set("Cookie", csrfCookie)
        .set("x-csrf-token", csrf)
        .send({ ...contactBody, subject: `Question ${index + 1}` })
        .expect(202);
    }
    const rateLimited = await request(app)
      .post(`/api/public/${owner.slug}/contact`)
      .set("Cookie", csrfCookie)
      .set("x-csrf-token", csrf)
      .send(contactBody)
      .expect(429);
    expect(rateLimited.body.error.code).toBe("RATE_LIMITED");

    const inbox = await ownerGet(owner, "/api/owner/messages?status=new").expect(200);
    expect(inbox.body.data).toHaveLength(4);
    expect(inbox.body.data[0]).not.toHaveProperty("ipHash");
    expect(inbox.body.data[0]).not.toHaveProperty("tenantId");
    const messageId = inbox.body.data[0].id as string;
    await ownerPatch(owner, `/api/owner/messages/${messageId}`, { status: "read" }).expect(200);
    await ownerGet(owner, "/api/owner/messages?status=read").expect(200);
    await ownerDelete(owner, `/api/owner/messages/${messageId}`).expect(200);
    await request(app).get(assetPath).expect(404);
  });
});
