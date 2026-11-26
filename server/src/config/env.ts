import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  MONGODB_URI: z
    .string()
    .min(1)
    .refine(
      (value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
      "must be a valid MongoDB connection URI",
    ),
  CLIENT_ORIGIN: z
    .string()
    .url()
    .refine(
      (value) => {
        try {
          return new URL(value).origin === value;
        } catch {
          return false;
        }
      },
      "must be an origin without a path",
    ),
  SESSION_SECRET: z.string().min(32, "must contain at least 32 characters"),
  OPENAI_API_KEY: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().email().optional(),
  SEED_ADMIN_EMAIL: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  SEED_ADMIN_PASSWORD: z
    .string()
    .min(12)
    .max(72)
    .refine((value) => new TextEncoder().encode(value).length <= 72)
    .optional(),
  ASSET_STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().min(1).default("var/uploads"),
  PUBLIC_API_ORIGIN: z
    .string()
    .url()
    .refine(
      (value) => {
        try {
          return new URL(value).origin === value;
        } catch {
          return false;
        }
      },
      "must be an origin without a path",
    )
    .optional(),
  AWS_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  DEMO_TENANT_SLUG: z
    .string()
    .regex(/^demo-test-[a-z0-9]+(?:-[a-z0-9]+)*$/, "must identify a demo-test workspace")
    .optional(),
}).superRefine((value, context) => {
  const smtpValues = [
    value.SMTP_HOST,
    value.SMTP_PORT,
    value.SMTP_USER,
    value.SMTP_PASSWORD,
    value.SMTP_FROM,
  ];
  if (smtpValues.some((item) => item !== undefined) && smtpValues.some((item) => item === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["SMTP_HOST"],
      message: "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured together",
    });
  }
  if ((value.SEED_ADMIN_EMAIL === undefined) !== (value.SEED_ADMIN_PASSWORD === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["SEED_ADMIN_EMAIL"],
      message: "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be configured together",
    });
  }
  if (value.NODE_ENV === "production" && value.ASSET_STORAGE_PROVIDER !== "s3") {
    context.addIssue({
      code: "custom",
      path: ["ASSET_STORAGE_PROVIDER"],
      message: "production requires ASSET_STORAGE_PROVIDER=s3",
    });
  }
  if (value.ASSET_STORAGE_PROVIDER === "s3") {
    for (const field of ["AWS_REGION", "S3_BUCKET"] as const) {
      if (value[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "is required when ASSET_STORAGE_PROVIDER=s3",
        });
      }
    }
  }
  if (value.NODE_ENV === "production") {
    if (!value.PUBLIC_API_ORIGIN) {
      context.addIssue({
        code: "custom",
        path: ["PUBLIC_API_ORIGIN"],
        message: "is required in production to generate public asset URLs",
      });
    } else if (!value.PUBLIC_API_ORIGIN.startsWith("https://")) {
      context.addIssue({
        code: "custom",
        path: ["PUBLIC_API_ORIGIN"],
        message: "must use HTTPS in production",
      });
    }
  }
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv): Environment {
  const result = environmentSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join(".") : "environment";
      return `${field}: ${issue.message}`;
    });
    throw new Error(`Invalid environment configuration:\n- ${issues.join("\n- ")}`);
  }
  return result.data;
}

export const env = parseEnvironment(process.env);
