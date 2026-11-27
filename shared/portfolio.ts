import { z } from "zod";

export const publishStateSchema = z.enum(["draft", "published"]);
export const visibilitySchema = z.enum(["public", "private"]);

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid resource identifier");
const projectSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");
const urlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "URL must use HTTP or HTTPS");
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date (YYYY-MM-DD)")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const nonEmptyUpdate = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one field");

export const socialLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: urlSchema,
});

export const profileInputSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  headline: z.string().trim().max(200).optional(),
  bio: z.string().max(20_000).optional(),
  location: z.string().trim().max(160).optional(),
  avatarAsset: objectIdSchema.nullable().optional(),
  socialLinks: z.array(socialLinkSchema).max(10).default([]),
  contactEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
  publicFields: z.object({
    email: z.boolean().default(false),
    location: z.boolean().default(false),
  }).default({ email: false, location: false }),
  defaultLocale: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).default("en"),
});






const projectFields = {
  title: z.string().trim().min(1).max(160),
  slug: projectSlugSchema,
  summary: z.string().trim().max(400).optional(),
  description: z.string().max(20_000).optional(),
  techStack: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  coverAsset: objectIdSchema.nullable().optional(),
  screenshots: z.array(objectIdSchema).max(10).default([]),
  liveUrl: urlSchema.optional(),
  repoUrl: urlSchema.optional(),
  status: z.enum(["planning", "development", "testing", "completed", "on_hold", "cancelled"]).default("planning"),
  confirmCompletion: z.boolean().optional(),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(-100_000).max(100_000).default(0),
};
export const projectInputSchema = z.object(projectFields);
export const projectUpdateSchema = nonEmptyUpdate(z.object({
  ...projectFields,
  techStack: z.array(z.string().trim().min(1).max(50)).max(30),
  screenshots: z.array(objectIdSchema).max(10),
  status: z.enum(["planning", "development", "testing", "completed", "on_hold", "cancelled"]),
  confirmCompletion: z.boolean(),
  featured: z.boolean(),
  sortOrder: z.number().int().min(-100_000).max(100_000),
})).refine(
  (value) => Object.keys(value).some((field) => field !== "confirmCompletion"),
  { message: "Provide at least one project field other than confirmCompletion" },
);

const skillFields = {
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().max(80).optional(),
  status: z.enum(["learning", "practicing", "completed", "needs_refresh"]).default("learning"),
  progressSelfReported: z.number().int().min(0).max(100).default(0),
  evidenceProjectIds: z.array(objectIdSchema).max(50).default([]),
};
export const skillInputSchema = z.object(skillFields);
export const skillUpdateSchema = nonEmptyUpdate(z.object({
  ...skillFields,
  status: z.enum(["learning", "practicing", "completed", "needs_refresh"]),
  progressSelfReported: z.number().int().min(0).max(100),
  evidenceProjectIds: z.array(objectIdSchema).max(50),
}));

const achievementFields = {
  title: z.string().trim().min(1).max(160),
  type: z.enum(["certificate", "hackathon", "training", "education", "award"]),
  issuer: z.string().trim().max(160).optional(),
  credentialId: z.string().trim().max(160).optional(),
  issueDate: dateSchema.optional(),
  expiryDate: dateSchema.optional(),
  verificationUrl: urlSchema.optional(),
  evidenceAsset: objectIdSchema.nullable().optional(),
  visibility: visibilitySchema.default("private"),
};
const issueExpiryRefinement = (value: { issueDate?: Date; expiryDate?: Date }, context: z.RefinementCtx) => {
  if (value.issueDate && value.expiryDate && value.expiryDate < value.issueDate) {
    context.addIssue({ code: "custom", path: ["expiryDate"], message: "Expiry date cannot precede issue date" });
  }
};
export const achievementInputSchema = z.object(achievementFields).superRefine(issueExpiryRefinement);
export const achievementUpdateSchema = z.object({
  ...achievementFields,
  type: z.enum(["certificate", "hackathon", "training", "education", "award"]),
  visibility: visibilitySchema,
}).partial().superRefine(issueExpiryRefinement).refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one field",
);

const careerFields = {
  kind: z.enum(["education", "experience", "learning"]),
  title: z.string().trim().min(1).max(160),
  organization: z.string().trim().max(160).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  description: z.string().max(10_000).optional(),
};
const careerDateRefinement = (value: { startDate?: Date; endDate?: Date }, context: z.RefinementCtx) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date cannot precede start date" });
  }
};
export const careerEntryInputSchema = z.object(careerFields).superRefine(careerDateRefinement);
export const careerEntryUpdateSchema = z.object({
  ...careerFields,
  kind: z.enum(["education", "experience", "learning"]),
}).partial().superRefine(careerDateRefinement).refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one field",
);

const goalFields = {
  title: z.string().trim().min(1).max(160),
  horizon: z.enum(["short", "medium", "long"]),
  targetDate: dateSchema.optional(),
  status: z.enum(["not_started", "in_progress", "completed", "on_hold"]).default("not_started"),
  description: z.string().max(10_000).optional(),
  relatedTechnologies: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
};
export const goalInputSchema = z.object(goalFields);
export const goalUpdateSchema = nonEmptyUpdate(z.object({
  ...goalFields,
  status: z.enum(["not_started", "in_progress", "completed", "on_hold"]),
  relatedTechnologies: z.array(z.string().trim().min(1).max(50)).max(30),
}));

export const resourceIdParamsSchema = z.object({ id: objectIdSchema });
export const publicSlugParamsSchema = z.object({
  slug: z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
export const publicProjectParamsSchema = publicSlugParamsSchema.extend({ projectSlug: projectSlugSchema });

export const resourceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  status: z.enum([
    "planning",
    "development",
    "testing",
    "completed",
    "on_hold",
    "cancelled",
    "learning",
    "practicing",
    "needs_refresh",
    "certificate",
    "hackathon",
    "training",
    "education",
    "award",
    "public",
    "private",
    "experience",
    "not_started",
    "in_progress",
    "new",
    "read",
    "archived",
  ]).optional(),
  sort: z.string().trim().max(40).optional(),
});

export const publicListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const publishStateInputSchema = z.object({ publishState: publishStateSchema });
export const reorderProjectsSchema = z.object({
  projects: z.array(z.object({ id: objectIdSchema, sortOrder: z.number().int().min(-100_000).max(100_000) })).min(1).max(500),
});
export const contactMessageInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  subject: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(5_000),
  honeypot: z.string().max(200).default(""),
});
export const contactMessageStatusSchema = z.object({
  status: z.enum(["read", "archived"]),
});
export const imageFileMetadataSchema = z.object({
  originalname: z.string().min(1).max(255),
  mimetype: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().min(1).max(5 * 1024 * 1024),
});

export const imageUploadResponseSchema = z.object({
  assetId: objectIdSchema,
  key: z.string(),
  url: urlSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type ImageUploadResponse = z.infer<typeof imageUploadResponseSchema>;

export const publicAssetKeyParamsSchema = z.object({
  key: z.string().regex(/^[a-f\d]{24}-[a-f\d-]{36}\.webp$/i, "Invalid asset key"),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
export type SkillInput = z.infer<typeof skillInputSchema>;
export type SkillUpdate = z.infer<typeof skillUpdateSchema>;
export type AchievementInput = z.infer<typeof achievementInputSchema>;
export type AchievementUpdate = z.infer<typeof achievementUpdateSchema>;
export type CareerEntryInput = z.infer<typeof careerEntryInputSchema>;
export type CareerEntryUpdate = z.infer<typeof careerEntryUpdateSchema>;
export type GoalInput = z.infer<typeof goalInputSchema>;
export type GoalUpdate = z.infer<typeof goalUpdateSchema>;
export type ResourceListQuery = z.infer<typeof resourceListQuerySchema>;
export type PublicListQuery = z.infer<typeof publicListQuerySchema>;
export type ContactMessageInput = z.infer<typeof contactMessageInputSchema>;
