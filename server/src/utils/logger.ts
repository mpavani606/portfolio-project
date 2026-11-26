import pino from "pino";
import { pinoHttp } from "pino-http";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers.x-api-key",
    "req.headers.x-csrf-token",
    "res.headers.set-cookie",
  ],
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (_request, response) => String(response.getHeader("x-request-id")),
});
