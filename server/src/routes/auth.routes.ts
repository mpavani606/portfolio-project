import { Router, type Request } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResendVerificationInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from "../../../shared/auth.js";
import {
  changePassword,
  login,
  logout,
  register,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "../modules/auth/auth.service.js";
import { requireAuth, requireVerified } from "../middleware/auth.js";
import {
  loginRateLimit,
  passwordRecoveryRateLimit,
  passwordResetRateLimit,
  registrationRateLimit,
  resendVerificationRateLimit,
  verificationRateLimit,
} from "../middleware/auth-rate-limit.js";
import { validate, getValidated } from "../middleware/validate.js";
import { TenantModel } from "../models/tenant.js";
import { clearSessionCookie, SESSION_COOKIE, setCsrfCookie, setSessionCookie } from "../utils/cookies.js";
import { createCsrfToken } from "../utils/tokens.js";
import { ok } from "../utils/response.js";
import type { AuthContext } from "../types/express.js";
import type { TenantDocument } from "../models/tenant.js";
import type { UserDocument } from "../models/user.js";
import type { TenantDto, UserDto } from "../../../shared/user.js";

const router = Router();

function authContext(request: Request): AuthContext {
  if (!request.authContext) {
    throw new Error("Authentication middleware did not attach a user session");
  }
  return request.authContext;
}

function userDto(user: UserDocument): UserDto {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

function tenantDto(tenant: TenantDocument | null): TenantDto | null {
  if (!tenant) {
    return null;
  }
  return {
    id: tenant._id.toString(),
    slug: tenant.slug,
    displayName: tenant.displayName,
    status: tenant.status,
  };
}

router.get("/csrf", (_request, response) => {
  const token = createCsrfToken();
  setCsrfCookie(response, token);
  ok(response, { token });
});

router.post(
  "/register",
  validate(registerSchema),
  registrationRateLimit,
  async (_request, response) => {
    const input = getValidated<RegisterInput>(response, "body");
    await register(input);
    response.status(202);
    ok(response, {
      message: "If the address can be registered, verification instructions will be sent.",
    });
  },
);

router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  verificationRateLimit,
  async (_request, response) => {
    const input = getValidated<VerifyEmailInput>(response, "body");
    const user = await verifyEmail(input.token);
    ok(response, { verified: true, user: userDto(user) });
  },
);

router.post(
  "/resend-verification",
  validate(resendVerificationSchema),
  resendVerificationRateLimit,
  async (_request, response) => {
    const input = getValidated<ResendVerificationInput>(response, "body");
    await resendVerification(input.email);
    ok(response, {
      message: "If the address needs verification, instructions will be sent.",
    });
  },
);

router.post(
  "/login",
  validate(loginSchema),
  loginRateLimit,
  async (request, response) => {
    const input = getValidated<LoginInput>(response, "body");
    const session = await login(input, request);
    setSessionCookie(response, session.token);
    ok(response, { user: userDto(session.user), tenant: tenantDto(session.tenant) });
  },
);

router.post("/logout", async (request, response) => {
  await logout(request.cookies?.[SESSION_COOKIE]);
  clearSessionCookie(response);
  ok(response, { loggedOut: true });
});

router.get("/me", requireAuth, async (request, response) => {
  const context = authContext(request);
  const tenant = context.session.tenantId
    ? await TenantModel.findById(context.session.tenantId)
    : null;
  ok(response, { user: userDto(context.user), tenant: tenantDto(tenant) });
});

router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  passwordRecoveryRateLimit,
  async (_request, response) => {
    const input = getValidated<ForgotPasswordInput>(response, "body");
    await requestPasswordReset(input.email);
    ok(response, { message: "If the account exists, password reset instructions will be sent." });
  },
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  passwordResetRateLimit,
  async (_request, response) => {
    const input = getValidated<ResetPasswordInput>(response, "body");
    await resetPassword(input);
    ok(response, { message: "Password updated. Please sign in again." });
  },
);

router.post(
  "/change-password",
  requireAuth,
  requireVerified,
  validate(changePasswordSchema),
  async (request, response) => {
    const input = getValidated<ChangePasswordInput>(response, "body");
    await changePassword(input, authContext(request));
    clearSessionCookie(response);
    ok(response, { message: "Password updated. Please sign in again." });
  },
);

export default router;
