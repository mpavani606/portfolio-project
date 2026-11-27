import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import type { BadgeCriteriaRule } from "../../../../shared/timeline-badges.js";
import { AchievementModel, ProjectModel, SkillModel } from "../../models/portfolio.js";
import {
  BadgeDefinitionModel,
  UserBadgeModel,
} from "../../models/timeline-badges.js";
import { ApiError } from "../../utils/api-error.js";

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function evaluateRule(
  tenantId: Types.ObjectId,
  rule: BadgeCriteriaRule,
): Promise<{ eligible: boolean; evidenceUrl?: string }> {
  let count: number;
  let evidenceUrl: string | undefined;
  switch (rule.type) {
    case "completed_projects":
      count = await ProjectModel.countDocuments({
        tenantId,
        publishState: "published",
        status: "completed",
      });
      break;
    case "published_projects":
      count = await ProjectModel.countDocuments({ tenantId, publishState: "published" });
      break;
    case "projects_with_repo": {
      const filter = {
        tenantId,
        publishState: "published",
        repoUrl: { $exists: true, $ne: "" },
      };
      count = await ProjectModel.countDocuments(filter);
      const project = await ProjectModel.findOne(filter).select("repoUrl");
      evidenceUrl = project?.repoUrl;
      break;
    }
    case "certificates_added":
      count = await AchievementModel.countDocuments({
        tenantId,
        publishState: "published",
        visibility: "public",
        type: "certificate",
      });
      break;
    case "completed_skills":
      count = await SkillModel.countDocuments({
        tenantId,
        publishState: "published",
        status: "completed",
      });
      break;
  }
  return {
    eligible: count >= rule.threshold,
    ...(evidenceUrl === undefined ? {} : { evidenceUrl }),
  };
}

export async function awardEligibleBadges(tenantId: Types.ObjectId): Promise<void> {
  const definitions = await BadgeDefinitionModel.find({
    active: true,
    criteriaRule: { $exists: true },
    $or: [{ tenantId: null }, { tenantId }],
  });
  for (const definition of definitions) {
    if (!definition.criteriaRule) {
      continue;
    }
    const result = await evaluateRule(tenantId, definition.criteriaRule);
    if (!result.eligible) {
      continue;
    }
    try {
      await UserBadgeModel.updateOne(
        { tenantId, badgeDefinitionId: definition._id },
        {
          $setOnInsert: {
            publicId: randomBytes(24).toString("base64url"),
            issuedAt: new Date(),
            verificationStatus: result.evidenceUrl ? "evidence_provided" : "owner_awarded",
            ...(result.evidenceUrl === undefined ? {} : { evidenceUrl: result.evidenceUrl }),
            visibility: "public",
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const alreadyAwarded = await UserBadgeModel.exists({
        tenantId,
        badgeDefinitionId: definition._id,
      });
      if (!alreadyAwarded) {
        throw error;
      }
    }
  }
}

export async function awardBadge(
  tenantId: Types.ObjectId,
  input: {
    definitionId: string;
    evidenceUrl?: string;
    evidenceNote?: string;
    visibility: "public" | "private";
  },
) {
  const definition = await BadgeDefinitionModel.findOne({
    _id: input.definitionId,
    active: true,
    $or: [{ tenantId: null }, { tenantId }],
  });
  if (!definition) {
    throw new ApiError(404, "NOT_FOUND", "Active badge definition not found");
  }

  try {
    return await UserBadgeModel.create({
      tenantId,
      badgeDefinitionId: definition._id,
      publicId: randomBytes(24).toString("base64url"),
      evidenceUrl: input.evidenceUrl,
      evidenceNote: input.evidenceNote,
      verificationStatus: input.evidenceUrl || input.evidenceNote
        ? "evidence_provided"
        : "owner_awarded",
      visibility: input.visibility,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const alreadyAwarded = await UserBadgeModel.exists({
        tenantId,
        badgeDefinitionId: definition._id,
      });
      if (alreadyAwarded) {
        throw new ApiError(409, "CONFLICT", "This badge has already been awarded", {
          definitionId: ["This badge has already been awarded"],
        });
      }
    }
    throw error;
  }
}

export async function revokeBadge(
  tenantId: Types.ObjectId,
  id: string,
  reason: string,
) {
  const badge = await UserBadgeModel.findOneAndUpdate(
    { _id: id, tenantId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
    { new: true, runValidators: true },
  );
  if (!badge) {
    throw new ApiError(404, "NOT_FOUND", "Active badge not found");
  }
  return badge;
}
