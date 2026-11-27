import { Router } from "express";
import { Types } from "mongoose";
import {
  badgeAwardInputSchema,
  badgeDefinitionInputSchema,
  badgeIdParamsSchema,
  badgeRevokeInputSchema,
  projectChildIdParamsSchema,
  projectChildParamsSchema,
  projectMilestoneInputSchema,
  projectMilestoneUpdateSchema,
  projectReleaseInputSchema,
  projectReleaseUpdateSchema,
  reorderMilestonesSchema,
  type BadgeAwardInput,
  type BadgeDefinitionInput,
  type ProjectMilestoneInput,
  type ProjectMilestoneUpdate,
  type ProjectReleaseInput,
  type ProjectReleaseUpdate,
} from "../../../shared/timeline-badges.js";
import { getValidated, validate } from "../middleware/validate.js";
import { ProjectModel } from "../models/portfolio.js";
import {
  BadgeDefinitionModel,
  ProjectMilestoneModel,
  ProjectReleaseModel,
  UserBadgeModel,
} from "../models/timeline-badges.js";
import {
  badgeDefinitionDto,
  projectMilestoneOwnerDto,
  projectReleaseOwnerDto,
  userBadgeOwnerDto,
} from "../modules/portfolio/serializers.js";
import { assertTenantAssets } from "../modules/portfolio/relations.js";
import { awardBadge, revokeBadge } from "../modules/badges/award.service.js";
import { ApiError } from "../utils/api-error.js";
import { getTenantId } from "../utils/request-context.js";
import { ok } from "../utils/response.js";

const router = Router();

async function requireOwnedProject(tenantId: Types.ObjectId, projectId: string): Promise<void> {
  const projectExists = await ProjectModel.exists({ _id: projectId, tenantId });
  if (!projectExists) {
    throw new ApiError(404, "NOT_FOUND", "Project not found");
  }
}

function assertMilestoneDates(
  stage: ProjectMilestoneInput["stage"],
  startedAt: Date | undefined,
  completedAt: Date | undefined,
): void {
  if (startedAt && completedAt && completedAt < startedAt) {
    throw new ApiError(400, "VALIDATION_ERROR", "Completion date cannot precede start date", {
      completedAt: ["Completion date cannot precede start date"],
    });
  }
  if ((stage === "completed" || stage === "cancelled") && !completedAt) {
    throw new ApiError(400, "VALIDATION_ERROR", "A completed or cancelled stage needs a date", {
      completedAt: ["A date is required for completed or cancelled stages"],
    });
  }
}

function asConflict(error: unknown, field: string): never {
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    throw new ApiError(409, "CONFLICT", "A resource with that value already exists", {
      [field]: ["This value is already in use"],
    });
  }
  throw error;
}

router.get(
  "/projects/:projectId/milestones",
  validate(projectChildParamsSchema, "params"),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId } = getValidated<{ projectId: string }>(response, "params");
    await requireOwnedProject(tenantId, projectId);
    const milestones = await ProjectMilestoneModel.find({
      tenantId,
      projectId,
    }).sort({ sortOrder: 1, startedAt: 1, createdAt: 1 });
    ok(response, milestones.map(projectMilestoneOwnerDto));
  },
);

router.post(
  "/projects/:projectId/milestones",
  validate(projectChildParamsSchema, "params"),
  validate(projectMilestoneInputSchema),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId } = getValidated<{ projectId: string }>(response, "params");
    const input = getValidated<ProjectMilestoneInput>(response, "body");
    await requireOwnedProject(tenantId, projectId);
    assertMilestoneDates(input.stage, input.startedAt, input.completedAt);
    const milestone = await ProjectMilestoneModel.create({
      ...input,
      tenantId,
      projectId: new Types.ObjectId(projectId),
    });
    response.status(201);
    ok(response, projectMilestoneOwnerDto(milestone));
  },
);

router.patch(
  "/projects/:projectId/milestones/reorder",
  validate(projectChildParamsSchema, "params"),
  validate(reorderMilestonesSchema),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId } = getValidated<{ projectId: string }>(response, "params");
    const { milestones } = getValidated<{ milestones: Array<{ id: string; sortOrder: number }> }>(
      response,
      "body",
    );
    await requireOwnedProject(tenantId, projectId);
    const ids = milestones.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      throw new ApiError(400, "VALIDATION_ERROR", "Milestone IDs must be unique", {
        milestones: ["Do not include the same milestone more than once"],
      });
    }
    const count = await ProjectMilestoneModel.countDocuments({
      tenantId,
      projectId,
      _id: { $in: ids },
    });
    if (count !== ids.length) {
      throw new ApiError(404, "NOT_FOUND", "One or more milestones were not found in this project");
    }
    await Promise.all(milestones.map(({ id, sortOrder }) =>
      ProjectMilestoneModel.updateOne(
        { _id: id, projectId, tenantId },
        { $set: { sortOrder } },
      )));
    const updated = await ProjectMilestoneModel.find({ tenantId, projectId }).sort({
      sortOrder: 1,
      createdAt: 1,
    });
    ok(response, updated.map(projectMilestoneOwnerDto));
  },
);

router.get(
  "/projects/:projectId/milestones/:id",
  validate(projectChildIdParamsSchema, "params"),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId, id } = getValidated<{ projectId: string; id: string }>(response, "params");
    await requireOwnedProject(tenantId, projectId);
    const milestone = await ProjectMilestoneModel.findOne({ _id: id, tenantId, projectId });
    if (!milestone) {
      throw new ApiError(404, "NOT_FOUND", "Milestone not found");
    }
    ok(response, projectMilestoneOwnerDto(milestone));
  },
);

router.patch(
  "/projects/:projectId/milestones/:id",
  validate(projectChildIdParamsSchema, "params"),
  validate(projectMilestoneUpdateSchema),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId, id } = getValidated<{ projectId: string; id: string }>(response, "params");
    const input = getValidated<ProjectMilestoneUpdate>(response, "body");
    await requireOwnedProject(tenantId, projectId);
    const current = await ProjectMilestoneModel.findOne({ _id: id, tenantId, projectId });
    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Milestone not found");
    }
    assertMilestoneDates(
      input.stage ?? current.stage,
      input.startedAt ?? current.startedAt,
      input.completedAt ?? current.completedAt,
    );
    const updated = await ProjectMilestoneModel.findOneAndUpdate(
      { _id: id, tenantId, projectId },
      { $set: input },
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw new ApiError(404, "NOT_FOUND", "Milestone not found");
    }
    ok(response, projectMilestoneOwnerDto(updated));
  },
);

router.delete(
  "/projects/:projectId/milestones/:id",
  validate(projectChildIdParamsSchema, "params"),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId, id } = getValidated<{ projectId: string; id: string }>(response, "params");
    await requireOwnedProject(tenantId, projectId);
    const deleted = await ProjectMilestoneModel.deleteOne({ _id: id, tenantId, projectId });
    if (deleted.deletedCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Milestone not found");
    }
    ok(response, { deleted: true });
  },
);

router.get(
  "/projects/:projectId/releases",
  validate(projectChildParamsSchema, "params"),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId } = getValidated<{ projectId: string }>(response, "params");
    await requireOwnedProject(tenantId, projectId);
    const releases = await ProjectReleaseModel.find({ tenantId, projectId })
      .sort({ releaseDate: -1, version: -1 });
    ok(response, releases.map(projectReleaseOwnerDto));
  },
);

router.post(
  "/projects/:projectId/releases",
  validate(projectChildParamsSchema, "params"),
  validate(projectReleaseInputSchema),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId } = getValidated<{ projectId: string }>(response, "params");
    const input = getValidated<ProjectReleaseInput>(response, "body");
    await requireOwnedProject(tenantId, projectId);
    await assertTenantAssets(tenantId, input.assets);
    try {
      const release = await ProjectReleaseModel.create({
        ...input,
        tenantId,
        projectId: new Types.ObjectId(projectId),
        assets: input.assets.map((id) => new Types.ObjectId(id)),
      });
      response.status(201);
      ok(response, projectReleaseOwnerDto(release));
    } catch (error) {
      asConflict(error, "version");
    }
  },
);

router.get(
  "/projects/:projectId/releases/:id",
  validate(projectChildIdParamsSchema, "params"),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId, id } = getValidated<{ projectId: string; id: string }>(response, "params");
    await requireOwnedProject(tenantId, projectId);
    const release = await ProjectReleaseModel.findOne({ _id: id, tenantId, projectId });
    if (!release) {
      throw new ApiError(404, "NOT_FOUND", "Release not found");
    }
    ok(response, projectReleaseOwnerDto(release));
  },
);

router.patch(
  "/projects/:projectId/releases/:id",
  validate(projectChildIdParamsSchema, "params"),
  validate(projectReleaseUpdateSchema),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId, id } = getValidated<{ projectId: string; id: string }>(response, "params");
    const input = getValidated<ProjectReleaseUpdate>(response, "body");
    await requireOwnedProject(tenantId, projectId);
    if (input.assets) {
      await assertTenantAssets(tenantId, input.assets);
    }
    const { assets, ...fields } = input;
    try {
      const release = await ProjectReleaseModel.findOneAndUpdate(
        { _id: id, tenantId, projectId },
        {
          $set: {
            ...fields,
            ...(assets === undefined
              ? {}
              : { assets: assets.map((assetId) => new Types.ObjectId(assetId)) }),
          },
        },
        { new: true, runValidators: true },
      );
      if (!release) {
        throw new ApiError(404, "NOT_FOUND", "Release not found");
      }
      ok(response, projectReleaseOwnerDto(release));
    } catch (error) {
      asConflict(error, "version");
    }
  },
);

router.delete(
  "/projects/:projectId/releases/:id",
  validate(projectChildIdParamsSchema, "params"),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { projectId, id } = getValidated<{ projectId: string; id: string }>(response, "params");
    await requireOwnedProject(tenantId, projectId);
    const deleted = await ProjectReleaseModel.deleteOne({ _id: id, tenantId, projectId });
    if (deleted.deletedCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Release not found");
    }
    ok(response, { deleted: true });
  },
);

router.get("/badges", async (request, response) => {
  const tenantId = getTenantId(request);
  const [definitions, badges] = await Promise.all([
    BadgeDefinitionModel.find({ active: true, $or: [{ tenantId: null }, { tenantId }] })
      .sort({ title: 1 }),
    UserBadgeModel.find({ tenantId }).sort({ issuedAt: -1 }),
  ]);
  const definitionsById = new Map(definitions.map((definition) => [
    definition._id.toString(),
    definition,
  ]));
  ok(response, {
    definitions: definitions.map(badgeDefinitionDto),
    badges: badges.map((badge) => userBadgeOwnerDto(
      badge,
      definitionsById.get(badge.badgeDefinitionId.toString()) ?? null,
    )),
  });
});

router.post(
  "/badges/definitions",
  validate(badgeDefinitionInputSchema),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const input = getValidated<BadgeDefinitionInput>(response, "body");
    try {
      const definition = await BadgeDefinitionModel.create({ ...input, tenantId });
      response.status(201);
      ok(response, badgeDefinitionDto(definition));
    } catch (error) {
      asConflict(error, "key");
    }
  },
);

router.post(
  "/badges/award",
  validate(badgeAwardInputSchema),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const input = getValidated<BadgeAwardInput>(response, "body");
    const badge = await awardBadge(tenantId, input);
    const definition = await BadgeDefinitionModel.findById(badge.badgeDefinitionId);
    response.status(201);
    ok(response, userBadgeOwnerDto(badge, definition));
  },
);

router.post(
  "/badges/:id/revoke",
  validate(badgeIdParamsSchema, "params"),
  validate(badgeRevokeInputSchema),
  async (_request, response) => {
    const tenantId = getTenantId(_request);
    const { id } = getValidated<{ id: string }>(response, "params");
    const { reason } = getValidated<{ reason: string }>(response, "body");
    const badge = await revokeBadge(tenantId, id, reason);
    const definition = await BadgeDefinitionModel.findById(badge.badgeDefinitionId);
    ok(response, userBadgeOwnerDto(badge, definition));
  },
);

export default router;
