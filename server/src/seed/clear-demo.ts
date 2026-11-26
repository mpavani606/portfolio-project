import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { clearDemoContent } from "../modules/admin/seed-demo.service.js";
import { logger } from "../utils/logger.js";

async function clearDemo(): Promise<void> {
  if (env.NODE_ENV === "production") {
    throw new Error("Demo cleanup is disabled in production.");
  }
  await connectDatabase();
  try {
    const removed = await clearDemoContent();
    logger.info({ tenantSlug: env.DEMO_TENANT_SLUG, removed }, "DEMO portfolio content cleanup complete");
  } finally {
    await disconnectDatabase();
  }
}

clearDemo().catch((error: unknown) => {
  logger.error({ err: error }, "Demo cleanup failed");
  process.exitCode = 1;
});
