import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { seedDemoContent } from "../modules/admin/seed-demo.service.js";
import { logger } from "../utils/logger.js";

async function seedDemo(): Promise<void> {
  if (env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled in production.");
  }
  await connectDatabase();
  try {
    await seedDemoContent();
    logger.info({ tenantSlug: env.DEMO_TENANT_SLUG }, "DEMO portfolio content created");
  } finally {
    await disconnectDatabase();
  }
}

seedDemo().catch((error: unknown) => {
  logger.error({ err: error }, "Demo seed failed");
  process.exitCode = 1;
});
