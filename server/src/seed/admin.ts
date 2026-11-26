import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { UserModel } from "../models/user.js";
import { createInitialSuperadmin } from "../modules/admin/seed-admin.service.js";
import { logger } from "../utils/logger.js";

async function seedAdmin(): Promise<void> {
  if (env.SEED_ADMIN_EMAIL === undefined || env.SEED_ADMIN_PASSWORD === undefined) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env before seeding.");
  }

  await connectDatabase();
  try {
    await UserModel.init();
    await createInitialSuperadmin(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);
    logger.info({ email: env.SEED_ADMIN_EMAIL }, "Initial superadmin created");
  } finally {
    await disconnectDatabase();
  }
}

seedAdmin().catch((error: unknown) => {
  logger.error({ err: error }, "Superadmin seed failed");
  process.exitCode = 1;
});
