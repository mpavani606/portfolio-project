import { createHash } from "node:crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { RequestHandler } from "express";
import type { LoginInput } from "../../../shared/auth.js";
import { getValidated } from "./validate.js";
import { fail } from "../utils/response.js";

const windowMs = 15 * 60 * 1000;

const tooManyRequests: RequestHandler = (_request, response) => {
  fail(response, 429, {
    code: "RATE_LIMITED",
    message: "Too many requests. Please try again later.",
  });
};

function perIpRateLimit(limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: tooManyRequests,
  });
}

export const registrationRateLimit = perIpRateLimit(10);
export const verificationRateLimit = perIpRateLimit(10);
export const resendVerificationRateLimit = perIpRateLimit(5);
export const passwordRecoveryRateLimit = perIpRateLimit(5);
export const passwordResetRateLimit = perIpRateLimit(5);

export const loginRateLimit = rateLimit({
  windowMs,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (request, response) => {
    const { email } = getValidated<LoginInput>(response, "body");
    const emailKey = createHash("sha256").update(email).digest("hex");
    return `${ipKeyGenerator(request.ip ?? "unknown")}:${emailKey}`;
  },
  handler: tooManyRequests,
});
