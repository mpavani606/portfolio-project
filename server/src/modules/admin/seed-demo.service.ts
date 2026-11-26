import { Types } from "mongoose";
import { TenantModel } from "../../models/tenant.js";
import {
  AchievementModel,
  CareerEntryModel,
  DemoSeedManifestModel,
  GoalModel,
  ProfileModel,
  ProjectModel,
  SkillModel,
} from "../../models/portfolio.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

const demoSeedKey = "portfolio-demo-v1";

async function findDemoTenant() {
  if (env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled in production.");
  }
  const slug = env.DEMO_TENANT_SLUG;
  if (!slug || !slug.startsWith("demo-test-")) {
    throw new Error("Set DEMO_TENANT_SLUG to an existing demo-test-* workspace.");
  }
  const tenant = await TenantModel.findOne({ slug, status: "active" });
  if (!tenant) {
    throw new Error(`No active demo-test workspace found for slug "${slug}".`);
  }
  return tenant;
}

async function removeManifestResources(
  tenantId: Types.ObjectId,
  manifest: {
    profileIds: Types.ObjectId[];
    projectIds: Types.ObjectId[];
    skillIds: Types.ObjectId[];
    achievementIds: Types.ObjectId[];
    careerEntryIds: Types.ObjectId[];
    goalIds: Types.ObjectId[];
  },
): Promise<void> {
  await Promise.all([
    ProfileModel.deleteMany({ tenantId, _id: { $in: manifest.profileIds } }),
    ProjectModel.deleteMany({ tenantId, _id: { $in: manifest.projectIds } }),
    SkillModel.deleteMany({ tenantId, _id: { $in: manifest.skillIds } }),
    AchievementModel.deleteMany({ tenantId, _id: { $in: manifest.achievementIds } }),
    CareerEntryModel.deleteMany({ tenantId, _id: { $in: manifest.careerEntryIds } }),
    GoalModel.deleteMany({ tenantId, _id: { $in: manifest.goalIds } }),
  ]);
}

async function assertDemoWorkspaceEmpty(tenantId: Types.ObjectId): Promise<void> {
  const counts = await Promise.all([
    ProfileModel.countDocuments({ tenantId }),
    ProjectModel.countDocuments({ tenantId }),
    SkillModel.countDocuments({ tenantId }),
    AchievementModel.countDocuments({ tenantId }),
    CareerEntryModel.countDocuments({ tenantId }),
    GoalModel.countDocuments({ tenantId }),
  ]);
  if (counts.some((count) => count > 0)) {
    throw new ApiError(409, "CONFLICT", "The demo-test workspace already contains portfolio data");
  }
}

export async function seedDemoContent(): Promise<void> {
  const tenant = await findDemoTenant();
  await assertDemoWorkspaceEmpty(tenant._id);
  const manifest = await DemoSeedManifestModel.create({
    tenantId: tenant._id,
    seedKey: demoSeedKey,
  });

  try {
    const profile = await ProfileModel.create({
      tenantId: tenant._id,
      fullName: "DEMO Sample Portfolio",
      headline: "DEMO content — replace before publishing",
      bio: "DEMO sample biography. This is placeholder content, not a real person's history.",
      publicFields: { email: false, location: false },
      publishState: "draft",
    });
    manifest.profileIds = [profile._id];
    await manifest.save();

    const projects = await ProjectModel.create([
      {
        tenantId: tenant._id,
        title: "DEMO Project One",
        slug: "demo-project-one",
        summary: "DEMO sample project summary.",
        description: "DEMO sample project description.",
        techStack: ["DEMO"],
        publishState: "draft",
      },
      {
        tenantId: tenant._id,
        title: "DEMO Project Two",
        slug: "demo-project-two",
        summary: "DEMO sample project summary.",
        description: "DEMO sample project description.",
        techStack: ["DEMO"],
        publishState: "draft",
      },
    ]);
    manifest.projectIds = projects.map((project) => project._id);
    await manifest.save();

    const skills = await SkillModel.create([
      { tenantId: tenant._id, name: "DEMO Sample Skill", category: "DEMO", publishState: "draft" },
      { tenantId: tenant._id, name: "DEMO Sample Skill Two", category: "DEMO", publishState: "draft" },
    ]);
    manifest.skillIds = skills.map((skill) => skill._id);
    await manifest.save();

    const achievements = await AchievementModel.create([
      {
        tenantId: tenant._id,
        title: "DEMO Sample Achievement",
        type: "training",
        issuer: "DEMO — not an actual issuer",
        verificationStatus: "owner_entered",
        visibility: "private",
        publishState: "draft",
      },
    ]);
    manifest.achievementIds = achievements.map((achievement) => achievement._id);
    await manifest.save();

    const careerEntries = await CareerEntryModel.create([
      {
        tenantId: tenant._id,
        kind: "learning",
        title: "DEMO Sample Learning Entry",
        organization: "DEMO",
        publishState: "draft",
      },
    ]);
    manifest.careerEntryIds = careerEntries.map((entry) => entry._id);
    await manifest.save();

    const goals = await GoalModel.create([
      {
        tenantId: tenant._id,
        title: "DEMO Sample Goal",
        horizon: "short",
        status: "not_started",
        relatedTechnologies: ["DEMO"],
        publishState: "draft",
      },
    ]);
    manifest.goalIds = goals.map((goal) => goal._id);
    await manifest.save();
  } catch (error) {
    await removeManifestResources(tenant._id, manifest);
    await DemoSeedManifestModel.deleteOne({ _id: manifest._id, tenantId: tenant._id });
    throw error;
  }
}

export async function clearDemoContent(): Promise<number> {
  const tenant = await findDemoTenant();
  const manifest = await DemoSeedManifestModel.findOne({
    tenantId: tenant._id,
    seedKey: demoSeedKey,
  });
  if (!manifest) {
    return 0;
  }

  await removeManifestResources(tenant._id, manifest);
  await DemoSeedManifestModel.deleteOne({ _id: manifest._id, tenantId: tenant._id });
  return 1;
}
