import { createHash } from "node:crypto";
import { Router } from "express";
import {
  contactMessageInputSchema,
  publicAssetKeyParamsSchema,
  publicListQuerySchema,
  publicProjectParamsSchema,
  publicSlugParamsSchema,
  type ContactMessageInput,
  type PublicListQuery,
} from "../../../shared/portfolio.js";
import {
  publicBadgeParamsSchema,
  publicTimelineParamsSchema,
} from "../../../shared/timeline-badges.js";
import { contactRateLimit } from "../middleware/contact-rate-limit.js";
import { getValidated, validate } from "../middleware/validate.js";
import { TenantModel } from "../models/tenant.js";
import {
  AchievementModel,
  AssetModel,
  CareerEntryModel,
  ContactMessageModel,
  GoalModel,
  ProfileModel,
  ProjectModel,
  SkillModel,
} from "../models/portfolio.js";
import {
  BadgeDefinitionModel,
  ProjectMilestoneModel,
  ProjectReleaseModel,
  UserBadgeModel,
} from "../models/timeline-badges.js";
import {
  publicAchievementDto,
  publicCareerEntryDto,
  publicGoalDto,
  publicProfileDto,
  publicProjectDto,
  publicSkillDto,
  projectMilestonePublicDto,
  projectReleasePublicDto,
  userBadgePublicDto,
} from "../modules/portfolio/serializers.js";
import { assetStorage } from "../modules/assets/storage.js";
import { ApiError } from "../utils/api-error.js";
import { env } from "../config/env.js";
import { ok } from "../utils/response.js";

const router = Router();

async function findPublishedPortfolio(slug: string) {
  const tenant = await TenantModel.findOne({ slug, status: "active" }).select("_id");
  if (!tenant) {
    throw new ApiError(404, "NOT_FOUND", "Portfolio not found");
  }
  const profile = await ProfileModel.findOne({
    tenantId: tenant._id,
    publishState: "published",
  });
  if (!profile) {
    throw new ApiError(404, "NOT_FOUND", "Portfolio not found");
  }
  return { tenantId: tenant._id, profile };
}

export async function publicAssetUrls(
  tenantId: import("mongoose").Types.ObjectId,
  assetIds: Array<import("mongoose").Types.ObjectId | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set(assetIds.filter((id): id is import("mongoose").Types.ObjectId => id !== null && id !== undefined))];
  if (ids.length === 0) {
    return new Map();
  }
  const assets = await AssetModel.find({ tenantId, _id: { $in: ids } }).select("_id url");
  return new Map(assets.map((asset) => [asset._id.toString(), asset.url]));
}

router.get(
  "/assets/:key",
  validate(publicAssetKeyParamsSchema, "params"),
  async (request, response) => {
    const { key } = getValidated<{ key: string }>(response, "params");
    const asset = await AssetModel.findOne({ key });
    if (!asset) {
      throw new ApiError(404, "NOT_FOUND", "Asset not found");
    }

    const assetId = asset._id;
    const [activeTenant, profileReference, projectReference, achievementReference, releaseProjectIds] = await Promise.all([
      TenantModel.exists({ _id: asset.tenantId, status: "active" }),
      ProfileModel.exists({
        tenantId: asset.tenantId,
        publishState: "published",
        avatarAsset: assetId,
      }),
      ProjectModel.exists({
        tenantId: asset.tenantId,
        publishState: "published",
        $or: [{ coverAsset: assetId }, { screenshots: assetId }],
      }),
      AchievementModel.exists({
        tenantId: asset.tenantId,
        publishState: "published",
        visibility: "public",
        evidenceAsset: assetId,
      }),
      ProjectReleaseModel.find({
        tenantId: asset.tenantId,
        visibility: "public",
        assets: assetId,
      }).distinct("projectId"),
    ]);
    const releaseReference = releaseProjectIds.length > 0 && await ProjectModel.exists({
      tenantId: asset.tenantId,
      publishState: "published",
      _id: { $in: releaseProjectIds },
    });
    if (!activeTenant || (
      !profileReference
      && !projectReference
      && !achievementReference
      && !releaseReference
    )) {
      throw new ApiError(404, "NOT_FOUND", "Asset not found");
    }

    const body = await assetStorage.read(asset.key);
    if (!body) {
      throw new ApiError(404, "NOT_FOUND", "Asset not found");
    }
    response
      .type("image/webp")
      .set("Cache-Control", "public, max-age=31536000, immutable")
      .send(body);
  },
);

router.get(
  "/:slug/profile",
  validate(publicSlugParamsSchema, "params"),
  async (_request, response) => {
    const { slug } = getValidated<{ slug: string }>(response, "params");
    const { tenantId, profile } = await findPublishedPortfolio(slug);
    const assets = await publicAssetUrls(tenantId, [profile.avatarAsset]);
    const avatarUrl = profile.avatarAsset
      ? assets.get(profile.avatarAsset.toString()) ?? null
      : null;
    ok(response, publicProfileDto(profile, avatarUrl));
  },
);

router.get(
  "/:slug/projects",
  validate(publicSlugParamsSchema, "params"),
  validate(publicListQuerySchema, "query"),
  async (_request, response) => {
    const { slug } = getValidated<{ slug: string }>(response, "params");
    const query = getValidated<PublicListQuery>(response, "query");
    const { tenantId } = await findPublishedPortfolio(slug);
    const filter = { tenantId, publishState: "published" as const };
    const [projects, total] = await Promise.all([
      ProjectModel.find(filter)
        .sort({ featured: -1, sortOrder: 1, createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      ProjectModel.countDocuments(filter),
    ]);
    const assetIds = projects.flatMap((project) => [
      project.coverAsset,
      ...project.screenshots,
    ]);
    const assetUrls = await publicAssetUrls(tenantId, assetIds);
    ok(response, projects.map((project) => publicProjectDto(project, assetUrls)), {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    });
  },
);

router.get(
  "/:slug/projects/:projectSlug",
  validate(publicProjectParamsSchema, "params"),
  async (_request, response) => {
    const { slug, projectSlug } = getValidated<{ slug: string; projectSlug: string }>(
      response,
      "params",
    );
    const { tenantId } = await findPublishedPortfolio(slug);
    const project = await ProjectModel.findOne({
      tenantId,
      slug: projectSlug,
      publishState: "published",
    });
    if (!project) {
      throw new ApiError(404, "NOT_FOUND", "Project not found");
    }
    const assetUrls = await publicAssetUrls(tenantId, [
      project.coverAsset,
      ...project.screenshots,
    ]);
    ok(response, publicProjectDto(project, assetUrls));
  },
);

router.get(
  "/:slug/projects/:projectSlug/timeline",
  validate(publicTimelineParamsSchema, "params"),
  async (_request, response) => {
    const { slug, projectSlug } = getValidated<{ slug: string; projectSlug: string }>(
      response,
      "params",
    );
    const { tenantId } = await findPublishedPortfolio(slug);
    const project = await ProjectModel.findOne({
      tenantId,
      slug: projectSlug,
      publishState: "published",
    }).select("_id");
    if (!project) {
      throw new ApiError(404, "NOT_FOUND", "Project not found");
    }
    const milestones = await ProjectMilestoneModel.find({
      tenantId,
      projectId: project._id,
      visibility: "public",
    }).sort({ sortOrder: 1, startedAt: 1, createdAt: 1 });
    ok(response, milestones.map(projectMilestonePublicDto));
  },
);

router.get(
  "/:slug/projects/:projectSlug/releases",
  validate(publicTimelineParamsSchema, "params"),
  async (_request, response) => {
    const { slug, projectSlug } = getValidated<{ slug: string; projectSlug: string }>(
      response,
      "params",
    );
    const { tenantId } = await findPublishedPortfolio(slug);
    const project = await ProjectModel.findOne({
      tenantId,
      slug: projectSlug,
      publishState: "published",
    }).select("_id");
    if (!project) {
      throw new ApiError(404, "NOT_FOUND", "Project not found");
    }
    const releases = await ProjectReleaseModel.find({
      tenantId,
      projectId: project._id,
      visibility: "public",
    }).sort({ releaseDate: -1, version: -1 });
    const assetIds = releases.flatMap((release) => release.assets);
    const assetUrls = await publicAssetUrls(tenantId, assetIds);
    ok(response, releases.map((release) => projectReleasePublicDto(release, assetUrls)));
  },
);

router.get(
  "/:slug/badges",
  validate(publicSlugParamsSchema, "params"),
  async (_request, response) => {
    const { slug } = getValidated<{ slug: string }>(response, "params");
    const { tenantId } = await findPublishedPortfolio(slug);
    const badges = await UserBadgeModel.find({
      tenantId,
      visibility: "public",
      revokedAt: { $exists: false },
    }).sort({ issuedAt: -1 });
    const definitions = badges.length > 0
      ? await BadgeDefinitionModel.find({
        _id: { $in: badges.map((badge) => badge.badgeDefinitionId) },
        active: true,
        $or: [{ tenantId: null }, { tenantId }],
      })
      : [];
    const definitionsById = new Map(definitions.map((definition) => [
      definition._id.toString(),
      definition,
    ]));
    ok(response, badges.flatMap((badge) => {
      const definition = definitionsById.get(badge.badgeDefinitionId.toString());
      return definition ? [userBadgePublicDto(badge, definition)] : [];
    }));
  },
);

router.get(
  "/:slug/badges/:badgePublicId",
  validate(publicBadgeParamsSchema, "params"),
  async (_request, response) => {
    const { slug, badgePublicId } = getValidated<{
      slug: string;
      badgePublicId: string;
    }>(response, "params");
    const { tenantId } = await findPublishedPortfolio(slug);
    const badge = await UserBadgeModel.findOne({
      tenantId,
      publicId: badgePublicId,
      visibility: "public",
      revokedAt: { $exists: false },
    });
    if (!badge) {
      throw new ApiError(404, "NOT_FOUND", "Badge not found");
    }
    const definition = await BadgeDefinitionModel.findOne({
      _id: badge.badgeDefinitionId,
      active: true,
      $or: [{ tenantId: null }, { tenantId }],
    });
    if (!definition) {
      throw new ApiError(404, "NOT_FOUND", "Badge not found");
    }
    ok(response, userBadgePublicDto(badge, definition));
  },
);

router.get(
  "/:slug/skills",
  validate(publicSlugParamsSchema, "params"),
  validate(publicListQuerySchema, "query"),
  async (_request, response) => {
    const { slug } = getValidated<{ slug: string }>(response, "params");
    const query = getValidated<PublicListQuery>(response, "query");
    const { tenantId } = await findPublishedPortfolio(slug);
    const filter = { tenantId, publishState: "published" as const };
    const [skills, total] = await Promise.all([
      SkillModel.find(filter).sort({ category: 1, name: 1 }).skip((query.page - 1) * query.limit).limit(query.limit),
      SkillModel.countDocuments(filter),
    ]);
    ok(response, skills.map(publicSkillDto), {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    });
  },
);

router.get(
  "/:slug/achievements",
  validate(publicSlugParamsSchema, "params"),
  validate(publicListQuerySchema, "query"),
  async (_request, response) => {
    const { slug } = getValidated<{ slug: string }>(response, "params");
    const query = getValidated<PublicListQuery>(response, "query");
    const { tenantId } = await findPublishedPortfolio(slug);
    const filter = { tenantId, publishState: "published" as const, visibility: "public" as const };
    const [achievements, total] = await Promise.all([
      AchievementModel.find(filter).sort({ issueDate: -1, createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
      AchievementModel.countDocuments(filter),
    ]);
    const assets = await publicAssetUrls(tenantId, achievements.map((achievement) => achievement.evidenceAsset));
    ok(response, achievements.map((achievement) => publicAchievementDto(
      achievement,
      achievement.evidenceAsset ? assets.get(achievement.evidenceAsset.toString()) ?? null : null,
    )), {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    });
  },
);

router.get(
  "/:slug/career",
  validate(publicSlugParamsSchema, "params"),
  validate(publicListQuerySchema, "query"),
  async (_request, response) => {
    const { slug } = getValidated<{ slug: string }>(response, "params");
    const query = getValidated<PublicListQuery>(response, "query");
    const { tenantId } = await findPublishedPortfolio(slug);
    const filter = { tenantId, publishState: "published" as const };
    const [entries, total] = await Promise.all([
      CareerEntryModel.find(filter).sort({ startDate: -1, createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
      CareerEntryModel.countDocuments(filter),
    ]);
    ok(response, entries.map(publicCareerEntryDto), {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    });
  },
);

router.get(
  "/:slug/goals",
  validate(publicSlugParamsSchema, "params"),
  validate(publicListQuerySchema, "query"),
  async (_request, response) => {
    const { slug } = getValidated<{ slug: string }>(response, "params");
    const query = getValidated<PublicListQuery>(response, "query");
    const { tenantId } = await findPublishedPortfolio(slug);
    const filter = { tenantId, publishState: "published" as const };
    const [goals, total] = await Promise.all([
      GoalModel.find(filter).sort({ targetDate: 1, createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
      GoalModel.countDocuments(filter),
    ]);
    ok(response, goals.map(publicGoalDto), {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    });
  },
);

router.post(
  "/:slug/contact",
  validate(publicSlugParamsSchema, "params"),
  contactRateLimit,
  validate(contactMessageInputSchema),
  async (request, response) => {
    const { slug } = getValidated<{ slug: string }>(response, "params");
    const input = getValidated<ContactMessageInput>(response, "body");
    const { tenantId } = await findPublishedPortfolio(slug);
    if (!input.honeypot) {
      const ipHash = createHash("sha256")
        .update(env.SESSION_SECRET)
        .update("\0")
        .update(request.ip ?? "unknown")
        .digest("hex");
      await ContactMessageModel.create({
        tenantId,
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        ipHash,
      });
    }
    response.status(202);
    ok(response, { accepted: true });
  },
);

export default router;
