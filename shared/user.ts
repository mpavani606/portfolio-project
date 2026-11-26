import { z } from "zod";

export const userDtoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(["user", "superadmin"]),
  isVerified: z.boolean(),
  createdAt: z.string(),
});

export const tenantDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  status: z.enum(["active", "suspended"]),
});

export type UserDto = z.infer<typeof userDtoSchema>;
export type TenantDto = z.infer<typeof tenantDtoSchema>;
