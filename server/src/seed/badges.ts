import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { seedPlatformBadges } from "../modules/badges/seed-platform-badges.js";
import { logger } from "../utils/logger.js";

async function seedBadges(): Promise<void> {
  await connectDatabase();
  try {
    await seedPlatformBadges();
    logger.info("Platform badge definitions seeded");
  } finally {
    await disconnectDatabase();
  }
}

seedBadges().catch((error: unknown) => {
  logger.error({ err: error }, "Platform badge seed failed");
  process.exitCode = 1;
});
