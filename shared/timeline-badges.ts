import { z } from "zod";
import { publicSlugParamsSchema } from "./portfolio.js";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid resource identifier");
const httpUrlSchema = z.string().trim().url().refine((value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "URL must use HTTP or HTTPS");
const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date (YYYY-MM-DD)")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const visibilitySchema = z.enum(["public", "private"]);

export const projectChildParamsSchema = z.object({
  projectId: objectIdSchema,
});
export const projectChildIdParamsSchema = projectChildParamsSchema.extend({
  id: objectIdSchema,
});
export const badgeIdParamsSchema = z.object({ id: objectIdSchema });
export const publicBadgeParamsSchema = publicSlugParamsSchema.extend({
  badgePublicId: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/, "Invalid badge identifier"),
});
export const publicTimelineParamsSchema = publicSlugParamsSchema.extend({
  projectSlug: z.string().trim().toLowerCase().min(2).max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid project slug"),
});

const milestoneFields = {
  stage: z.enum(["planning", "development", "testing", "completed", "on_hold", "cancelled"]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(["pending", "in_progress", "done"]).default("pending"),
  startedAt: dateSchema.optional(),
  completedAt: dateSchema.optional(),
  notes: z.string().trim().max(5000).optional(),
  evidenceUrl: httpUrlSchema.optional(),
  sortOrder: z.number().int().min(-100_000).max(100_000).default(0),
  visibility: visibilitySchema.default("private"),
};
const milestoneUpdateFields = {
  ...milestoneFields,
  status: z.enum(["pending", "in_progress", "done"]),
  sortOrder: z.number().int().min(-100_000).max(100_000),
  visibility: visibilitySchema,
};
function milestoneDateRefinement(
  value: { stage?: ProjectMilestoneInput["stage"]; startedAt?: Date; completedAt?: Date },
  context: z.RefinementCtx,
): void {
  if (value.startedAt && value.completedAt && value.completedAt < value.startedAt) {
    context.addIssue({
      code: "custom",
      path: ["completedAt"],
      message: "Completion date cannot precede start date",
    });
  }
  if (
    (value.stage === "completed" || value.stage === "cancelled")
    && !value.completedAt
  ) {
    context.addIssue({
      code: "custom",
      path: ["completedAt"],
      message: "A date is required for completed or cancelled stages",
    });
  }
}
export const projectMilestoneInputSchema = z.object(milestoneFields)
  .superRefine(milestoneDateRefinement);
export const projectMilestoneUpdateSchema = z.object(milestoneUpdateFields).partial()
  .superRefine((value, context) => {
    if (value.startedAt && value.completedAt && value.completedAt < value.startedAt) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Completion date cannot precede start date",
      });
    }
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field");
export const reorderMilestonesSchema = z.object({
  milestones: z.array(z.object({
    id: objectIdSchema,
    sortOrder: z.number().int().min(-100_000).max(100_000),
  })).min(1).max(500),
});

const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const releaseLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: httpUrlSchema,
});
const releaseChangeSchema = z.object({
  type: z.enum(["added", "changed", "fixed", "removed"]),
  text: z.string().trim().min(1).max(500),
});
const releaseFields = {
  version: z.string().trim().regex(semanticVersion, "Use a valid semantic version"),
  releaseDate: dateSchema,
  summary: z.string().trim().min(1).max(2000),
  changes: z.array(releaseChangeSchema).max(50).default([]),
  links: z.array(releaseLinkSchema).max(10).default([]),
  assets: z.array(objectIdSchema).max(10).default([]),
  visibility: visibilitySchema.default("private"),
};
export const projectReleaseInputSchema = z.object(releaseFields);
export const projectReleaseUpdateSchema = z.object({
  ...releaseFields,
  changes: z.array(releaseChangeSchema).max(50),
  links: z.array(releaseLinkSchema).max(10),
  assets: z.array(objectIdSchema).max(10),
  visibility: visibilitySchema,
}).partial().refine((value) => Object.keys(value).length > 0, "Provide at least one field");

export const badgeCategories = [
  "certificate",
  "hackathon",
  "project",
  "learning",
  "open_source",
  "coding",
] as const;
export const badgeIconKeys = [
  "award",
  "certificate",
  "code",
  "github",
  "project",
  "star",
  "trophy",
  "book",
] as const;
export const badgeCriteriaRuleSchema = z.object({
  type: z.enum([
    "completed_projects",
    "published_projects",
    "projects_with_repo",
    "certificates_added",
    "completed_skills",
  ]),
  threshold: z.number().int().min(1).max(1000),
});
export const badgeDefinitionInputSchema = z.object({
  key: z.string().trim().toLowerCase().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(120),
  category: z.enum(badgeCategories),
  criteriaText: z.string().trim().min(1).max(1000),
  criteriaRule: badgeCriteriaRuleSchema.optional(),
  iconKey: z.enum(badgeIconKeys),
  active: z.boolean().default(true),
});
export const badgeAwardInputSchema = z.object({
  definitionId: objectIdSchema,
  evidenceUrl: httpUrlSchema.optional(),
  evidenceNote: z.string().trim().min(1).max(1000).optional(),
  visibility: visibilitySchema.default("public"),
}).refine((value) => Boolean(value.evidenceUrl || value.evidenceNote), {
  path: ["evidenceNote"],
  message: "Provide an evidence URL or note",
});
export const badgeRevokeInputSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export type ProjectMilestoneInput = z.infer<typeof projectMilestoneInputSchema>;
export type ProjectMilestoneUpdate = z.infer<typeof projectMilestoneUpdateSchema>;
export type ProjectReleaseInput = z.infer<typeof projectReleaseInputSchema>;
export type ProjectReleaseUpdate = z.infer<typeof projectReleaseUpdateSchema>;
export type BadgeCriteriaRule = z.infer<typeof badgeCriteriaRuleSchema>;
export type BadgeDefinitionInput = z.infer<typeof badgeDefinitionInputSchema>;
export type BadgeAwardInput = z.infer<typeof badgeAwardInputSchema>;
