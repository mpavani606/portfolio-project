import { Router } from "express";
import {
  createWorkspaceSchema,
  RESERVED_SLUGS,
  slugAvailabilityQuerySchema,
  type CreateWorkspaceInput,
  type SlugAvailabilityQuery,
} from "../../../shared/onboarding.js";
import { requireAuth, requireVerified } from "../middleware/auth.js";
import { validate, getValidated } from "../middleware/validate.js";
import { SessionModel } from "../models/session.js";
import { TenantModel } from "../models/tenant.js";
import { ApiError } from "../utils/api-error.js";
import { ok } from "../utils/response.js";

const router = Router();
const reservedSlugs = new Set<string>(RESERVED_SLUGS);

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

router.get(
  "/slug-available",
  requireAuth,
  requireVerified,
  validate(slugAvailabilityQuerySchema, "query"),
  async (_request, response) => {
    const { slug } = getValidated<SlugAvailabilityQuery>(response, "query");
    const reserved = reservedSlugs.has(slug);
    const exists = reserved || (await TenantModel.exists({ slug })) !== null;
    ok(response, { slug, available: !exists });
  },
);

router.post(
  "/workspace",
  requireAuth,
  requireVerified,
  validate(createWorkspaceSchema),
  async (request, response) => {
    const input = getValidated<CreateWorkspaceInput>(response, "body");
    const context = request.authContext;
    if (!context) {
      throw new Error("Authentication middleware did not attach a user session");
    }

    if (await TenantModel.exists({ ownerId: context.user._id })) {
      throw new ApiError(409, "CONFLICT", "A workspace already exists for this account");
    }
    if (reservedSlugs.has(input.slug)) {
      throw new ApiError(409, "CONFLICT", "This workspace slug is reserved");
    }

    let tenant;
    try {
      tenant = await TenantModel.create({
        ownerId: context.user._id,
        slug: input.slug,
        displayName: input.displayName,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError(409, "CONFLICT", "This workspace slug is unavailable");
      }
      throw error;
    }

    await SessionModel.updateMany(
      { userId: context.user._id },
      { $set: { tenantId: tenant._id } },
    );
    context.session.tenantId = tenant._id;
    ok(response, {
      id: tenant._id.toString(),
      ownerId: tenant.ownerId.toString(),
      slug: tenant.slug,
      displayName: tenant.displayName,
      status: tenant.status,
    });
  },
);

export default router;
