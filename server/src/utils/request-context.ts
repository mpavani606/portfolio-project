import type { Request } from "express";
import type { Types } from "mongoose";
import { ApiError } from "./api-error.js";

export function getTenantId(request: Request): Types.ObjectId {
  if (!request.tenantId) {
    throw new ApiError(403, "FORBIDDEN", "An active workspace is required");
  }
  return request.tenantId;
}
