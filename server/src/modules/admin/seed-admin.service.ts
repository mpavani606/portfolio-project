import bcrypt from "bcryptjs";
import { UserModel } from "../../models/user.js";

export async function createInitialSuperadmin(email: string, password: string): Promise<void> {
  if (await UserModel.exists({ role: "superadmin" })) {
    throw new Error("An existing superadmin was found; refusing to seed a second time.");
  }

  try {
    await UserModel.create({
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "superadmin",
      isVerified: true,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new Error("An existing superadmin was found; refusing to seed a second time.");
    }
    throw error;
  }
}
