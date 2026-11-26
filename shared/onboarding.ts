import { z } from "zod";

export const RESERVED_SLUGS = [
  "admin",
  "api",
  "dashboard",
  "login",
  "register",
  "onboarding",
  "status",
  "passport",
  "verify",
  "community",
  "assets",
  "static",
  "help",
  "about",
] as const;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens");

export const slugAvailabilityQuerySchema = z.object({ slug: slugSchema });

export const createWorkspaceSchema = z.object({
  slug: slugSchema,
  displayName: z.string().trim().min(2).max(100),
});

export type SlugAvailabilityQuery = z.infer<typeof slugAvailabilityQuerySchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
