import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { isDatabaseReady } from "./config/database.js";
import { csrfHeaderHook } from "./middleware/csrf-header-hook.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { globalRateLimit } from "./middleware/rate-limit.js";
import { requestId } from "./middleware/request-id.js";
import { asyncHandler } from "./utils/async-handler.js";
import { httpLogger } from "./utils/logger.js";
import { ApiError } from "./utils/api-error.js";
import { ok } from "./utils/response.js";
import authRouter from "./routes/auth.routes.js";
import onboardingRouter from "./routes/onboarding.routes.js";
import ownerRouter from "./routes/owner.routes.js";
import publicRouter from "./routes/public.routes.js";

const app = express();

app.disable("x-powered-by");
app.use(requestId);
app.use(httpLogger);
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (origin === undefined || origin === env.CLIENT_ORIGIN) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, "FORBIDDEN", "Origin is not allowed"));
    },
  }),
);
app.use(cookieParser());
app.use(globalRateLimit);
app.use(express.json({ limit: "1mb" }));
app.use(csrfHeaderHook);

app.get("/api/health", (_request, response) => {
  ok(response, { status: "ok" });
});

app.get("/api/ready", asyncHandler(async (_request, response, next) => {
  if (!isDatabaseReady()) {
    next(new ApiError(503, "INTERNAL", "Service not ready"));
    return;
  }
  ok(response, { status: "ready" });
}));

app.use("/api/auth", authRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/owner", ownerRouter);
app.use("/api/public", publicRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
export { app };
