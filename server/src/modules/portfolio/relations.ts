import { Types } from "mongoose";
import { AssetModel, ProjectModel } from "../../models/portfolio.js";
import { ApiError } from "../../utils/api-error.js";

export async function assertTenantAssets(
  tenantId: Types.ObjectId,
  assetIds: Array<string | null | undefined>,
): Promise<void> {
  const ids = [...new Set(assetIds.filter((id): id is string => id !== null && id !== undefined))];
  if (ids.length === 0) {
    return;
  }
  const count = await AssetModel.countDocuments({
    tenantId,
    _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
  });
  if (count !== ids.length) {
    throw new ApiError(400, "VALIDATION_ERROR", "Assets must belong to this workspace", {
      assets: ["One or more assets are invalid for this workspace"],
    });
  }
}

export async function assertTenantProjects(
  tenantId: Types.ObjectId,
  projectIds: string[],
): Promise<void> {
  const ids = [...new Set(projectIds)];
  if (ids.length === 0) {
    return;
  }
  const count = await ProjectModel.countDocuments({
    tenantId,
    _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
  });
  if (count !== ids.length) {
    throw new ApiError(400, "VALIDATION_ERROR", "Projects must belong to this workspace", {
      evidenceProjectIds: ["One or more projects are invalid for this workspace"],
    });
  }
}
