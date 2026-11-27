import { Router } from "express";
import { Types } from "mongoose";
import {
  achievementInputSchema,
  achievementUpdateSchema,
  careerEntryInputSchema,
  careerEntryUpdateSchema,
  contactMessageStatusSchema,
  goalInputSchema,
  goalUpdateSchema,
  profileInputSchema,
  projectInputSchema,
  projectUpdateSchema,
  reorderProjectsSchema,
  resourceIdParamsSchema,
  resourceListQuerySchema,
  skillInputSchema,
  skillUpdateSchema,
  publishStateInputSchema,
  type AchievementInput,
  type AchievementUpdate,
  type CareerEntryInput,
  type CareerEntryUpdate,
  type GoalInput,
  type GoalUpdate,
  type ProfileInput,
  type ProjectInput,
  type ProjectUpdate,
  type ResourceListQuery,
  type SkillInput,
  type SkillUpdate,
} from "../../../shared/portfolio.js";
import { validate, getValidated } from "../middleware/validate.js";
import {
  AchievementModel,
  CareerEntryModel,
  ContactMessageModel,
  GoalModel,
  ProfileModel,
  ProjectModel,
  SkillModel,
} from "../models/portfolio.js";
import {
  ProjectMilestoneModel,
  ProjectReleaseModel,
} from "../models/timeline-badges.js";
import {
  achievementOwnerDto,
  careerEntryOwnerDto,
  contactMessageOwnerDto,
  goalOwnerDto,
  profileOwnerDto,
  projectOwnerDto,
  skillOwnerDto,
} from "../modules/portfolio/serializers.js";
import { registerOwnerResource } from "../modules/portfolio/owner-resource.js";
import { assertTenantAssets, assertTenantProjects } from "../modules/portfolio/relations.js";
import { ApiError } from "../utils/api-error.js";
import { getTenantId } from "../utils/request-context.js";
import { ok } from "../utils/response.js";
import { tenantScoped } from "../utils/tenant-scoped.js";
import { awardEligibleBadges } from "../modules/badges/award.service.js";

const router = Router();

function objectId(id: string | null | undefined): Types.ObjectId | null {
  return id === null || id === undefined ? null : new Types.ObjectId(id);
}

function duplicateAsConflict(error: unknown, field: string): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  ) {
    throw new ApiError(409, "CONFLICT", "A resource with that unique value already exists", {
      [field]: ["This value is already in use"],
    });
  }
  throw error;
}

function assertDateOrder(
  startDate: Date | undefined,
  endDate: Date | undefined,
  endField: string,
  endLabel: string,
): void {
  if (startDate && endDate && endDate < startDate) {
    throw new ApiError(400, "VALIDATION_ERROR", `${endLabel} cannot precede its start date`, {
      [endField]: [`${endLabel} cannot precede its start date`],
    });
  }
}

function requireCompletionConfirmation(): never {
  throw new ApiError(
    400,
    "VALIDATION_ERROR",
    "Completing a project requires a done milestone or explicit confirmation",
    { status: ["Add a done milestone or set confirmCompletion to true"] },
  );
}

router.get("/profile", async (request, response) => {
  const tenantId = getTenantId(request);
  const profile = await ProfileModel.findOne({ tenantId });
  if (!profile) {
    throw new ApiError(404, "NOT_FOUND", "Profile not found");
  }
  ok(response, profileOwnerDto(profile));
});

router.put(
  "/profile",
  validate(profileInputSchema),
  async (request, response) => {
    const tenantId = getTenantId(request);
    const input = getValidated<ProfileInput>(response, "body");
    await assertTenantAssets(tenantId, [input.avatarAsset]);
    const { avatarAsset, ...fields } = input;
    try {
      const profile = await ProfileModel.findOneAndUpdate(
        { tenantId },
        {
          $set: { ...fields, avatarAsset: objectId(avatarAsset) },
          $setOnInsert: { tenantId },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      );
      if (!profile) {
        throw new Error("Profile upsert did not return a document");
      }
      ok(response, profileOwnerDto(profile));
    } catch (error) {
      duplicateAsConflict(error, "profile");
    }
  },
);

router.patch(
  "/profile/publish",
  validate(publishStateInputSchema),
  async (request, response) => {
    const tenantId = getTenantId(request);
    const { publishState } = getValidated<{ publishState: "draft" | "published" }>(response, "body");
    const profile = await ProfileModel.findOneAndUpdate(
      { tenantId },
      { $set: { publishState } },
      { new: true, runValidators: true },
    );
    if (!profile) {
      throw new ApiError(404, "NOT_FOUND", "Profile not found");
    }
    ok(response, profileOwnerDto(profile));
  },
);

router.patch(
  "/projects/reorder",
  validate(reorderProjectsSchema),
  async (request, response) => {
    const tenantId = getTenantId(request);
    const { projects } = getValidated<{ projects: Array<{ id: string; sortOrder: number }> }>(
      response,
      "body",
    );
    const ids = projects.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      throw new ApiError(400, "VALIDATION_ERROR", "Project IDs must be unique", {
        projects: ["Do not include the same project more than once"],
      });
    }
    const count = await ProjectModel.countDocuments({
      tenantId,
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
    });
    if (count !== ids.length) {
      throw new ApiError(404, "NOT_FOUND", "One or more projects were not found in this workspace");
    }
    const scoped = tenantScoped(ProjectModel);
    await Promise.all(
      projects.map(({ id, sortOrder }) =>
        scoped.updateById(tenantId, id, { sortOrder }),
      ),
    );
    const updated = await scoped.find(tenantId, { _id: { $in: ids } }).sort({ sortOrder: 1 }).exec();
    ok(response, updated.map(projectOwnerDto));
  },
);

registerOwnerResource(router, {
  path: "/projects",
  model: ProjectModel,
  createSchema: projectInputSchema,
  updateSchema: projectUpdateSchema,
  toCreate: (input: ProjectInput) => {
    const fields = { ...input };
    delete fields.confirmCompletion;
    const { coverAsset, screenshots, ...projectFields } = fields;
    return {
      ...projectFields,
      coverAsset: objectId(coverAsset),
      screenshots: screenshots.map((id) => new Types.ObjectId(id)),
    };
  },
  toUpdate: (input: ProjectUpdate) => {
    const fields = { ...input };
    delete fields.confirmCompletion;
    const { coverAsset, screenshots, ...projectFields } = fields;
    return {
      ...projectFields,
      ...(coverAsset !== undefined ? { coverAsset: objectId(coverAsset) } : {}),
      ...(screenshots !== undefined
        ? { screenshots: screenshots.map((id) => new Types.ObjectId(id)) }
        : {}),
    };
  },
  serialize: projectOwnerDto,
  searchFields: ["title", "summary", "description", "techStack"],
  sortFields: { createdAt: "createdAt", title: "title", sortOrder: "sortOrder", status: "status" },
  statusField: "status",
  statusValues: ["planning", "development", "testing", "completed", "on_hold", "cancelled"],
  uniqueField: "slug",
  defaultSort: { sortOrder: 1, createdAt: -1 },
  beforeCreate: async (tenantId, input) => {
    await assertTenantAssets(tenantId, [input.coverAsset, ...input.screenshots]);
    if (input.status === "completed" && !input.confirmCompletion) {
      requireCompletionConfirmation();
    }
  },
  beforeUpdate: async (tenantId, input, id) => {
    await assertTenantAssets(tenantId, [input.coverAsset, ...(input.screenshots ?? [])]);
    if (input.status === "completed" && !input.confirmCompletion) {
      const project = await ProjectModel.findOne({ _id: id, tenantId }).select("_id");
      if (!project) {
        throw new ApiError(404, "NOT_FOUND", "Project not found");
      }
      const doneMilestone = await ProjectMilestoneModel.exists({
        tenantId,
        projectId: id,
        status: "done",
      });
      if (!doneMilestone) {
        requireCompletionConfirmation();
      }
    }
  },
  beforeDelete: async (tenantId, id) => {
    await SkillModel.updateMany(
      { tenantId },
      { $pull: { evidenceProjectIds: new Types.ObjectId(id) } },
    );
  },
  afterCreate: (tenantId) => awardEligibleBadges(tenantId),
  afterUpdate: (tenantId) => awardEligibleBadges(tenantId),
  afterDelete: async (tenantId, id) => {
    await Promise.all([
      ProjectMilestoneModel.deleteMany({ tenantId, projectId: id }),
      ProjectReleaseModel.deleteMany({ tenantId, projectId: id }),
    ]);
  },
});

registerOwnerResource(router, {
  path: "/skills",
  model: SkillModel,
  createSchema: skillInputSchema,
  updateSchema: skillUpdateSchema,
  toCreate: (input: SkillInput) => ({
    ...input,
    evidenceProjectIds: input.evidenceProjectIds.map((id) => new Types.ObjectId(id)),
  }),
  toUpdate: (input: SkillUpdate) => {
    const { evidenceProjectIds, ...fields } = input;
    return {
      ...fields,
      ...(evidenceProjectIds
        ? { evidenceProjectIds: evidenceProjectIds.map((id) => new Types.ObjectId(id)) }
        : {}),
    };
  },
  serialize: skillOwnerDto,
  searchFields: ["name", "category"],
  sortFields: { createdAt: "createdAt", name: "name", category: "category" },
  statusField: "status",
  statusValues: ["learning", "practicing", "completed", "needs_refresh"],
  beforeCreate: (tenantId, input) => assertTenantProjects(tenantId, input.evidenceProjectIds),
  beforeUpdate: (tenantId, input) =>
    assertTenantProjects(tenantId, input.evidenceProjectIds ?? []),
  afterCreate: (tenantId) => awardEligibleBadges(tenantId),
  afterUpdate: (tenantId) => awardEligibleBadges(tenantId),
});

registerOwnerResource(router, {
  path: "/achievements",
  model: AchievementModel,
  createSchema: achievementInputSchema,
  updateSchema: achievementUpdateSchema,
  toCreate: (input: AchievementInput) => {
    const { evidenceAsset, ...fields } = input;
    return {
      ...fields,
      evidenceAsset: objectId(evidenceAsset),
      verificationStatus: input.evidenceAsset || input.verificationUrl
        ? "evidence_provided" as const
        : "owner_entered" as const,
    };
  },
  toUpdate: (input: AchievementUpdate) => {
    const { evidenceAsset, ...fields } = input;
    return {
      ...fields,
      ...(evidenceAsset !== undefined ? { evidenceAsset: objectId(evidenceAsset) } : {}),
      ...(input.evidenceAsset || input.verificationUrl
        ? { verificationStatus: "evidence_provided" as const }
        : {}),
    };
  },
  serialize: achievementOwnerDto,
  searchFields: ["title", "issuer", "credentialId"],
  sortFields: { createdAt: "createdAt", title: "title", issueDate: "issueDate" },
  statusField: "visibility",
  statusValues: ["public", "private"],
  beforeCreate: (tenantId, input) => assertTenantAssets(tenantId, [input.evidenceAsset]),
  beforeUpdate: async (tenantId, input, id) => {
    await assertTenantAssets(tenantId, [input.evidenceAsset]);
    const existing = await AchievementModel.findOne({ _id: id, tenantId })
      .select("issueDate expiryDate");
    assertDateOrder(
      input.issueDate ?? existing?.issueDate,
      input.expiryDate ?? existing?.expiryDate,
      "expiryDate",
      "Expiry date",
    );
  },
  afterCreate: (tenantId) => awardEligibleBadges(tenantId),
  afterUpdate: (tenantId) => awardEligibleBadges(tenantId),
});

registerOwnerResource(router, {
  path: "/career",
  model: CareerEntryModel,
  createSchema: careerEntryInputSchema,
  updateSchema: careerEntryUpdateSchema,
  toCreate: (input: CareerEntryInput) => input,
  toUpdate: (input: CareerEntryUpdate) => input,
  serialize: careerEntryOwnerDto,
  searchFields: ["title", "organization", "description"],
  sortFields: { createdAt: "createdAt", title: "title", startDate: "startDate" },
  statusField: "kind",
  statusValues: ["education", "experience", "learning"],
  defaultSort: { startDate: -1, createdAt: -1 },
  beforeUpdate: async (tenantId, input, id) => {
    const existing = await CareerEntryModel.findOne({ _id: id, tenantId })
      .select("startDate endDate");
    assertDateOrder(
      input.startDate ?? existing?.startDate,
      input.endDate ?? existing?.endDate,
      "endDate",
      "End date",
    );
  },
});

registerOwnerResource(router, {
  path: "/goals",
  model: GoalModel,
  createSchema: goalInputSchema,
  updateSchema: goalUpdateSchema,
  toCreate: (input: GoalInput) => input,
  toUpdate: (input: GoalUpdate) => input,
  serialize: goalOwnerDto,
  searchFields: ["title", "description", "relatedTechnologies"],
  sortFields: { createdAt: "createdAt", title: "title", targetDate: "targetDate" },
  statusField: "status",
  statusValues: ["not_started", "in_progress", "completed", "on_hold"],
});

router.get(
  "/messages",
  validate(resourceListQuerySchema, "query"),
  async (request, response) => {
    const tenantId = getTenantId(request);
    const query = getValidated<ResourceListQuery>(response, "query");
    const filter: Record<string, unknown> = {};
    if (query.status) {
      if (!["new", "read", "archived"].includes(query.status)) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid status filter", {
          status: ["Allowed values: new, read, archived"],
        });
      }
      filter.status = query.status;
    }
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expression = new RegExp(escaped, "i");
      filter.$or = [
        { name: expression },
        { email: expression },
        { subject: expression },
        { message: expression },
      ];
    }
    const [messages, total] = await Promise.all([
      ContactMessageModel.find({ ...filter, tenantId })
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      ContactMessageModel.countDocuments({ ...filter, tenantId }),
    ]);
    ok(response, messages.map(contactMessageOwnerDto), {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    });
  },
);

router.patch(
  "/messages/:id",
  validate(resourceIdParamsSchema, "params"),
  validate(contactMessageStatusSchema),
  async (request, response) => {
    const tenantId = getTenantId(request);
    const { id } = getValidated<{ id: string }>(response, "params");
    const { status } = getValidated<{ status: "read" | "archived" }>(response, "body");
    const message = await ContactMessageModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status } },
      { new: true, runValidators: true },
    );
    if (!message) {
      throw new ApiError(404, "NOT_FOUND", "Message not found");
    }
    ok(response, contactMessageOwnerDto(message));
  },
);

router.delete(
  "/messages/:id",
  validate(resourceIdParamsSchema, "params"),
  async (request, response) => {
    const tenantId = getTenantId(request);
    const { id } = getValidated<{ id: string }>(response, "params");
    const result = await ContactMessageModel.deleteOne({ _id: id, tenantId });
    if (result.deletedCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Message not found");
    }
    ok(response, { deleted: true });
  },
);

export default router;
