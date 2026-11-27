import { Router } from "express";
import { requireAuth, requireTenant, requireVerified } from "../middleware/auth.js";
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
import ownerContentRouter from "./owner-content.routes.js";
import ownerTimelineBadgesRouter from "./owner-timeline-badges.routes.js";
import ownerUploadRouter from "./owner-upload.routes.js";
import { getTenantId } from "../utils/request-context.js";
import { ok } from "../utils/response.js";

const router = Router();

router.use(requireAuth, requireVerified, requireTenant);
router.use(ownerContentRouter);
router.use(ownerTimelineBadgesRouter);
router.use("/uploads", ownerUploadRouter);

router.get("/overview", async (request, response) => {
  const tenantId = getTenantId(request);
  const [
    profile,
    education,
    projects,
    certificates,
    assets,
    skills,
    achievements,
    careerEntries,
    goals,
    messages,
  ] = await Promise.all([
    ProfileModel.findOne({ tenantId }),
    CareerEntryModel.countDocuments({ tenantId, kind: "education" }),
    ProjectModel.countDocuments({ tenantId }),
    AchievementModel.countDocuments({ tenantId, type: "certificate" }),
    AssetModel.countDocuments({ tenantId }),
    SkillModel.countDocuments({ tenantId }),
    AchievementModel.countDocuments({ tenantId }),
    CareerEntryModel.countDocuments({ tenantId }),
    GoalModel.countDocuments({ tenantId }),
    ContactMessageModel.countDocuments({ tenantId }),
  ]);
  ok(response, {
    tenantId: tenantId.toString(),
    counts: {
      education,
      projects,
      certificates,
      assets,
      skills,
      achievements,
      careerEntries,
      goals,
      messages,
    },
    checklist: {
      profileComplete: Boolean(profile?.fullName.trim() && profile.headline?.trim() && profile.bio?.trim()),
      professionalLinksConfigured: Boolean(profile && profile.socialLinks.length > 0),
      portfolioPublished: profile?.publishState === "published",
    },
  });
});

export default router;
