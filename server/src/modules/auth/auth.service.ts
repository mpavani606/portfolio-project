import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { TenantModel } from "../../models/tenant.js";
import { SessionModel, type SessionDocument } from "../../models/session.js";
import { UserModel, type UserDocument } from "../../models/user.js";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "../../../../shared/auth.js";
import { mailService } from "../mail-service.js";
import { ApiError } from "../../utils/api-error.js";
import { SESSION_MAX_AGE_MS } from "../../utils/cookies.js";
import { createOpaqueToken, hashToken } from "../../utils/tokens.js";
import { logger } from "../../utils/logger.js";
import type { Request } from "express";
import type { TenantDocument } from "../../models/tenant.js";
import type { AuthContext } from "../../types/express.js";

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const dummyHashPromise = bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS);

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

async function issueVerificationEmail(user: UserDocument): Promise<void> {
  const token = createOpaqueToken();
  user.verifyTokenHash = hashToken(token);
  user.verifyTokenExpiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  await user.save();
  try {
    await mailService.sendVerificationEmail(user.email, token);
  } catch (error) {
    logger.error({ err: error }, "Verification email delivery failed");
  }
}

async function issueResetEmail(user: UserDocument): Promise<void> {
  const token = createOpaqueToken();
  user.resetTokenHash = hashToken(token);
  user.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();
  try {
    await mailService.sendPasswordResetEmail(user.email, token);
  } catch (error) {
    logger.error({ err: error }, "Password reset email delivery failed");
  }
}

export async function register(input: RegisterInput): Promise<void> {
  let user = await UserModel.findOne({ email: input.email }).select(
    "+verifyTokenHash +verifyTokenExpiresAt",
  );
  if (user) {
    if (!user.isVerified) {
      await issueVerificationEmail(user);
    }
    return;
  }

  user = new UserModel({
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    role: "user",
    isVerified: false,
  });
  try {
    await user.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return;
    }
    throw error;
  }
  await issueVerificationEmail(user);
}

export async function verifyEmail(token: string): Promise<UserDocument> {
  const user = await UserModel.findOneAndUpdate(
    {
      verifyTokenHash: hashToken(token),
      verifyTokenExpiresAt: { $gt: new Date() },
      isVerified: false,
    },
    {
      $set: { isVerified: true },
      $unset: { verifyTokenHash: 1, verifyTokenExpiresAt: 1 },
    },
    { new: true, runValidators: true },
  );
  if (!user) {
    throw new ApiError(400, "UNAUTHENTICATED", "Verification token is invalid or expired");
  }
  return user;
}

export async function resendVerification(email: string): Promise<void> {
  const user = await UserModel.findOne({ email }).select("+verifyTokenHash +verifyTokenExpiresAt");
  if (user && !user.isVerified) {
    await issueVerificationEmail(user);
  }
}

async function recordFailedLogin(user: UserDocument): Promise<void> {
  const updated = await UserModel.findByIdAndUpdate(
    user._id,
    { $inc: { failedLogins: 1 } },
    { new: true },
  );
  if (updated && updated.failedLogins >= MAX_FAILED_LOGINS) {
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { lockedUntil: new Date(Date.now() + ACCOUNT_LOCK_MS) } },
    );
  }
}

export interface CreatedSession {
  token: string;
  session: SessionDocument;
  user: UserDocument;
  tenant: TenantDocument | null;
}

export async function login(input: LoginInput, request: Request): Promise<CreatedSession> {
  const user = await UserModel.findOne({ email: input.email }).select("+passwordHash");
  const storedHash = user?.passwordHash ?? (await dummyHashPromise);
  const passwordMatches = await bcrypt.compare(input.password, storedHash);
  const isLocked = user?.lockedUntil !== undefined && user.lockedUntil > new Date();

  if (!user || !passwordMatches || isLocked) {
    if (user && !isLocked) {
      await recordFailedLogin(user);
    }
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid email or password");
  }
  if (!user.isVerified) {
    throw new ApiError(403, "FORBIDDEN", "Email verification required");
  }

  user.failedLogins = 0;
  user.lockedUntil = undefined;
  await user.save();

  const tenant = await TenantModel.findOne({ ownerId: user._id });
  const token = createOpaqueToken();
  const session = await SessionModel.create({
    sessionIdHash: hashToken(token),
    userId: user._id,
    tenantId: tenant?._id ?? null,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
    userAgent: request.get("user-agent")?.slice(0, 512),
    tokenVersion: user.tokenVersion,
  });
  return { token, session, user, tenant };
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (rawToken !== undefined) {
    await SessionModel.deleteOne({ sessionIdHash: hashToken(rawToken) });
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await UserModel.findOne({ email, isVerified: true }).select(
    "+resetTokenHash +resetTokenExpiresAt",
  );
  if (user) {
    await issueResetEmail(user);
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await UserModel.findOneAndUpdate(
    {
      resetTokenHash: hashToken(input.token),
      resetTokenExpiresAt: { $gt: new Date() },
    },
    {
      $set: { passwordHash, failedLogins: 0 },
      $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1, lockedUntil: 1 },
      $inc: { tokenVersion: 1 },
    },
    { new: true, runValidators: true },
  );
  if (!user) {
    throw new ApiError(400, "UNAUTHENTICATED", "Reset token is invalid or expired");
  }
  await SessionModel.deleteMany({ userId: user._id });
}

export async function changePassword(
  input: ChangePasswordInput,
  context: AuthContext,
): Promise<void> {
  const user = await UserModel.findById(context.user._id).select("+passwordHash");
  if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new ApiError(401, "UNAUTHENTICATED", "Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  const updated = await UserModel.findOneAndUpdate(
    { _id: user._id, passwordHash: user.passwordHash },
    {
      $set: { passwordHash, failedLogins: 0 },
      $unset: { lockedUntil: 1 },
      $inc: { tokenVersion: 1 },
    },
    { new: true },
  );
  if (!updated) {
    throw new ApiError(409, "CONFLICT", "Password changed concurrently; please try again");
  }
  await SessionModel.deleteMany({ userId: user._id });
}
