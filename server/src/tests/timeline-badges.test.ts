import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { env } from "../config/env.js";
import app from "../app.js";
import { AchievementModel, ProjectModel, SkillModel } from "../models/portfolio.js";
import { SessionModel } from "../models/session.js";
import { TenantModel } from "../models/tenant.js";
import {
  BadgeDefinitionModel,
  ProjectMilestoneModel,
  ProjectReleaseModel,
  UserBadgeModel,
} from "../models/timeline-badges.js";
import { UserModel } from "../models/user.js";
import { seedPlatformBadges } from "../modules/badges/seed-platform-badges.js";
import { createCsrfToken, createOpaqueToken, hashToken } from "../utils/tokens.js";
import { assertTenantIsolation } from "./helpers/assert-tenant-isolation.js";
import { tenantModelIsolationResource } from "./helpers/tenant-model-isolation.js";

interface OwnerSession {
  cookie: string;
  csrf: string;
  slug: string;
  tenantId: Types.ObjectId;
}

async function createOwnerSession(): Promise<OwnerSession> {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 16);
  const user = await UserModel.create({
    email: `timeline-${suffix}@example.test`,
    passwordHash: "test-only-hash",
    isVerified: true,
  });
  const tenant = await TenantModel.create({
    ownerId: user._id,
    slug: `timeline-${suffix}`,
    displayName: `Timeline ${suffix}`,
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
    slug: tenant.slug,
    tenantId: tenant._id,
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

async function createProject(owner: OwnerSession, slug = "timeline-project") {
  return ownerPost(owner, "/api/owner/projects", {
    title: "Timeline Project",
    slug,
  }).expect(201);
}

beforeAll(async () => {
  await mongoose.connect(env.MONGODB_URI, { dbName: `qm-portfolio-timeline-test-${process.pid}` });
  await Promise.all([
    UserModel.init(),
    TenantModel.init(),
    SessionModel.init(),
    ProjectModel.init(),
    AchievementModel.init(),
    SkillModel.init(),
    BadgeDefinitionModel.init(),
    UserBadgeModel.init(),
    ProjectMilestoneModel.init(),
    ProjectReleaseModel.init(),
  ]);
  await seedPlatformBadges();
});

afterEach(async () => {
  await Promise.all([
    SessionModel.deleteMany({}),
    TenantModel.deleteMany({}),
    UserModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    AchievementModel.deleteMany({}),
    SkillModel.deleteMany({}),
    ProjectMilestoneModel.deleteMany({}),
    ProjectReleaseModel.deleteMany({}),
    UserBadgeModel.deleteMany({}),
    BadgeDefinitionModel.deleteMany({ tenantId: { $ne: null } }),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("project timelines, releases, and badges", () => {
  it("validates milestone dates and requires confirmation or a done milestone before completion", async () => {
    const owner = await createOwnerSession();
    const project = await createProject(owner);
    const projectId = project.body.data.id as string;
    const milestonePath = `/api/owner/projects/${projectId}/milestones`;

    const missingCompletionDate = await ownerPost(owner, milestonePath, {
      stage: "completed",
      title: "Completed milestone",
    }).expect(400);
    expect(missingCompletionDate.body.error.fields).toHaveProperty("completedAt");

    const cancelledWithoutDate = await ownerPost(owner, milestonePath, {
      stage: "cancelled",
      title: "Cancelled milestone",
    }).expect(400);
    expect(cancelledWithoutDate.body.error.fields).toHaveProperty("completedAt");

    const invalidDateOrder = await ownerPost(owner, milestonePath, {
      stage: "development",
      title: "Invalid dates",
      startedAt: "2025-04-02",
      completedAt: "2025-04-01",
    }).expect(400);
    expect(invalidDateOrder.body.error.fields).toHaveProperty("completedAt");

    await ownerPost(owner, milestonePath, {
      stage: "development",
      title: "Implementation finished",
      status: "done",
      startedAt: "2025-04-01",
      completedAt: "2025-04-02",
    }).expect(201);
    await ownerPatch(owner, `/api/owner/projects/${projectId}`, {
      status: "completed",
    }).expect(200);

    const secondProject = await createProject(owner, "confirmation-project");
    const completionWithoutProof = await ownerPatch(
      owner,
      `/api/owner/projects/${secondProject.body.data.id}`,
      { status: "completed" },
    ).expect(400);
    expect(completionWithoutProof.body.error.fields).toHaveProperty("status");
    const confirmed = await ownerPatch(
      owner,
      `/api/owner/projects/${secondProject.body.data.id}`,
      { status: "completed", confirmCompletion: true },
    ).expect(200);
    expect(confirmed.body.data.status).toBe("completed");
    expect(confirmed.body.data).not.toHaveProperty("confirmCompletion");
  });

  it("rejects duplicate semantic versions with a field error and sorts releases by date then version", async () => {
    const owner = await createOwnerSession();
    const project = await createProject(owner);
    const path = `/api/owner/projects/${project.body.data.id}/releases`;
    const first = {
      version: "1.0.0",
      releaseDate: "2025-02-01",
      summary: "First release",
      changes: [{ type: "added", text: "Initial feature" }],
      links: [{ label: "Release notes", url: "https://example.test/release/1" }],
    };
    const created = await ownerPost(owner, path, first).expect(201);
    expect(created.body.data.version).toBe("1.0.0");

    const duplicate = await ownerPost(owner, path, first).expect(409);
    expect(duplicate.body.error).toMatchObject({
      code: "CONFLICT",
      fields: { version: expect.any(Array) },
    });

    await ownerPost(owner, path, {
      ...first,
      version: "2.0.0",
      releaseDate: "2025-01-01",
      summary: "Earlier dated release",
    }).expect(201);
    const releases = await ownerGet(owner, path).expect(200);
    expect(releases.body.data.map((release: { version: string }) => release.version))
      .toEqual(["1.0.0", "2.0.0"]);
  });

  it("hides private timeline entries and stops serving a revoked badge publicly", async () => {
    const owner = await createOwnerSession();
    await ownerPut(owner, "/api/owner/profile", { fullName: "Public Owner" }).expect(200);
    await ownerPatch(owner, "/api/owner/profile/publish", { publishState: "published" }).expect(200);
    const project = await createProject(owner, "public-timeline");
    const projectId = project.body.data.id as string;
    await ownerPatch(owner, `/api/owner/projects/${projectId}/publish`, {
      publishState: "published",
    }).expect(200);
    const timelinePath = `/api/public/${owner.slug}/projects/public-timeline/timeline`;
    await ownerPost(owner, `/api/owner/projects/${projectId}/milestones`, {
      stage: "development",
      title: "Hidden milestone",
      visibility: "private",
    }).expect(201);
    await ownerPost(owner, `/api/owner/projects/${projectId}/milestones`, {
      stage: "development",
      title: "Visible milestone",
      visibility: "public",
      notes: "Owner-only notes",
    }).expect(201);
    const timeline = await request(app).get(timelinePath).expect(200);
    expect(timeline.body.data).toHaveLength(1);
    expect(timeline.body.data[0].title).toBe("Visible milestone");
    expect(timeline.body.data[0]).not.toHaveProperty("notes");

    const releasesPath = `/api/owner/projects/${projectId}/releases`;
    await ownerPost(owner, releasesPath, {
      version: "0.9.0",
      releaseDate: "2025-01-01",
      summary: "Private release",
      visibility: "private",
    }).expect(201);
    await ownerPost(owner, releasesPath, {
      version: "1.0.0",
      releaseDate: "2025-02-01",
      summary: "Public release",
      visibility: "public",
    }).expect(201);
    const publicReleases = await request(app)
      .get(`/api/public/${owner.slug}/projects/public-timeline/releases`)
      .expect(200);
    expect(publicReleases.body.data.map((release: { version: string }) => release.version))
      .toEqual(["1.0.0"]);
    expect(JSON.stringify(publicReleases.body)).not.toContain("tenantId");

    const definition = await ownerPost(owner, "/api/owner/badges/definitions", {
      key: "manual-test-badge",
      title: "Manual Test Badge",
      category: "coding",
      criteriaText: "Awarded by the portfolio owner with evidence.",
      iconKey: "award",
    }).expect(201);
    const awardWithoutEvidence = await ownerPost(owner, "/api/owner/badges/award", {
      definitionId: definition.body.data.id,
    }).expect(400);
    expect(awardWithoutEvidence.body.error.fields).toHaveProperty("evidenceNote");
    const award = await ownerPost(owner, "/api/owner/badges/award", {
      definitionId: definition.body.data.id,
      evidenceNote: "Reviewed the supporting work.",
    }).expect(201);
    expect(award.body.data.verificationStatus).toBe("evidence_provided");
    expect(award.body.data.verificationStatus).not.toBe("issuer_verified");

    const publicBadges = `/api/public/${owner.slug}/badges`;
    const publicBadgePath = `${publicBadges}/${award.body.data.publicId}`;
    await request(app).get(publicBadgePath).expect(200);
    await ownerPost(owner, `/api/owner/badges/${award.body.data.id}/revoke`, {
      reason: "Evidence was withdrawn.",
    }).expect(200);
    await request(app).get(publicBadges).expect(200).expect((response) => {
      expect(response.body.data.some((badge: { publicId: string }) =>
        badge.publicId === award.body.data.publicId)).toBe(false);
    });
    await request(app).get(publicBadgePath).expect(404);
  });

  it("runs explicit automatic badge criteria once and seeds six platform definitions", async () => {
    const owner = await createOwnerSession();
    const platformBadges = await BadgeDefinitionModel.find({ tenantId: null });
    expect(platformBadges).toHaveLength(6);
    const definition = platformBadges.find((badge) => badge.key === "first-project-completed");
    expect(definition?.criteriaRule?.type).toBe("completed_projects");
    expect(definition?.criteriaRule?.threshold).toBe(1);
    const openSourceBadge = platformBadges.find((badge) => badge.key === "open-source-contributor");
    expect(openSourceBadge?.criteriaRule).toBeUndefined();
    expect(openSourceBadge?.criteriaText).toContain("actual contribution");

    const project = await ownerPost(owner, "/api/owner/projects", {
      title: "Completed Project",
      slug: "completed-project",
      status: "completed",
      confirmCompletion: true,
    }).expect(201);
    await ownerPatch(owner, `/api/owner/projects/${project.body.data.id}/publish`, {
      publishState: "published",
    }).expect(200);
    const completedProject = await ProjectModel.findById(project.body.data.id);
    expect(completedProject?.status).toBe("completed");

    const userBadges = await UserBadgeModel.find({});
    const firstProjectBadge = userBadges.filter((badge) =>
      badge.badgeDefinitionId.equals(definition?._id ?? new Types.ObjectId()));
    expect(firstProjectBadge).toHaveLength(1);
    expect(firstProjectBadge[0].verificationStatus).toBe("owner_awarded");
    await ownerPatch(owner, `/api/owner/projects/${project.body.data.id}`, {
      summary: "Updated without another award",
    }).expect(200);
    expect(await UserBadgeModel.countDocuments({
      tenantId: owner.tenantId,
      badgeDefinitionId: definition?._id,
    })).toBe(1);
  });

  it("enforces tenant isolation for milestones, releases, and issued badges", async () => {
    await assertTenantIsolation(tenantModelIsolationResource({
      model: ProjectMilestoneModel,
      build: (value) => ({
        projectId: new Types.ObjectId(),
        stage: "development" as const,
        title: value,
      }),
      getValue: (document) => document.title,
      update: (value) => ({ title: value }),
    }));
    await assertTenantIsolation(tenantModelIsolationResource({
      model: ProjectReleaseModel,
      build: (value) => ({
        projectId: new Types.ObjectId(),
        version: "1.0.0",
        releaseDate: new Date("2025-01-01T00:00:00.000Z"),
        summary: value,
      }),
      getValue: (document) => document.summary,
      update: (value) => ({ summary: value }),
    }));
    await assertTenantIsolation(tenantModelIsolationResource({
      model: UserBadgeModel,
      build: (value) => ({
        badgeDefinitionId: new Types.ObjectId(),
        publicId: `${value.replace(/\W/g, "")}-${randomUUID()}`,
        evidenceNote: value,
      }),
      getValue: (document) => document.evidenceNote ?? "",
      update: (value) => ({ evidenceNote: value }),
    }));
  });

  it("supports milestone and release update, reorder, and delete operations", async () => {
    const owner = await createOwnerSession();
    const project = await createProject(owner);
    const projectId = project.body.data.id as string;
    const milestonePath = `/api/owner/projects/${projectId}/milestones`;
    const first = await ownerPost(owner, milestonePath, {
      stage: "planning",
      title: "Plan",
    }).expect(201);
    const second = await ownerPost(owner, milestonePath, {
      stage: "development",
      title: "Build",
    }).expect(201);
    await ownerPatch(owner, `${milestonePath}/reorder`, {
      milestones: [
        { id: first.body.data.id, sortOrder: 2 },
        { id: second.body.data.id, sortOrder: 1 },
      ],
    }).expect(200);
    const updated = await ownerPatch(owner, `${milestonePath}/${first.body.data.id}`, {
      title: "Planning complete",
    }).expect(200);
    expect(updated.body.data.title).toBe("Planning complete");
    await ownerGet(owner, `${milestonePath}/${second.body.data.id}`).expect(200);
    await ownerDelete(owner, `${milestonePath}/${first.body.data.id}`).expect(200);

    const releasePath = `/api/owner/projects/${projectId}/releases`;
    const release = await ownerPost(owner, releasePath, {
      version: "1.0.0",
      releaseDate: "2025-02-01",
      summary: "Initial release",
    }).expect(201);
    const patched = await ownerPatch(owner, `${releasePath}/${release.body.data.id}`, {
      summary: "Updated release",
    }).expect(200);
    expect(patched.body.data.summary).toBe("Updated release");
    await ownerGet(owner, `${releasePath}/${release.body.data.id}`).expect(200);
    await ownerDelete(owner, `${releasePath}/${release.body.data.id}`).expect(200);
  });
});
