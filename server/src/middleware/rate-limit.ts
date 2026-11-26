import rateLimit from "express-rate-limit";
import { fail } from "../utils/response.js";

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_request, response) => {
    fail(response, 429, {
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    });
  },
});
