import type { RequestHandler } from "express";
import { SessionModel } from "../models/session.js";
import { TenantModel } from "../models/tenant.js";
import { UserModel, type UserRole } from "../models/user.js";
import { hashToken } from "../utils/tokens.js";
import { SESSION_COOKIE } from "../utils/cookies.js";
import { ApiError } from "../utils/api-error.js";

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const rawSession = request.cookies?.[SESSION_COOKIE];
  if (typeof rawSession !== "string" || rawSession.length === 0) {
    next(new ApiError(401, "UNAUTHENTICATED", "Authentication required"));
    return;
  }

  const session = await SessionModel.findOne({
    sessionIdHash: hashToken(rawSession),
    expiresAt: { $gt: new Date() },
  });
  if (!session) {
    next(new ApiError(401, "UNAUTHENTICATED", "Authentication required"));
    return;
  }

  const user = await UserModel.findById(session.userId);
  if (
    !user ||
    user.tokenVersion !== session.tokenVersion ||
    (user.lockedUntil !== undefined && user.lockedUntil > new Date())
  ) {
    await SessionModel.deleteOne({ _id: session._id });
    next(new ApiError(401, "UNAUTHENTICATED", "Authentication required"));
    return;
  }

  request.authContext = { user, session };
  next();
};

export const requireVerified: RequestHandler = (request, _response, next) => {
  if (!request.authContext?.user.isVerified) {
    next(new ApiError(403, "FORBIDDEN", "Email verification required"));
    return;
  }
  next();
};

export const requireTenant: RequestHandler = async (request, _response, next) => {
  const context = request.authContext;
  const tenantId = context?.session.tenantId;
  if (!context || !tenantId) {
    next(new ApiError(403, "FORBIDDEN", "An active workspace is required"));
    return;
  }

  const tenant = await TenantModel.findOne({
    _id: tenantId,
    ownerId: context.user._id,
    status: "active",
  }).select("_id");
  if (!tenant) {
    next(new ApiError(403, "FORBIDDEN", "An active workspace is required"));
    return;
  }

  request.tenantId = tenantId;
  next();
};

export function requireRole(role: UserRole): RequestHandler {
  return (request, _response, next) => {
    if (request.authContext?.user.role !== role) {
      next(new ApiError(403, "FORBIDDEN", "Insufficient permissions"));
      return;
    }
    next();
  };
}
