import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import { fail } from "../utils/response.js";

const contactRateLimited: RequestHandler = (_request, response) => {
  fail(response, 429, {
    code: "RATE_LIMITED",
    message: "Too many contact submissions. Please try again later.",
  });
};

export const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: contactRateLimited,
});
