import type { ErrorRequestHandler, RequestHandler } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
import { logger } from "../utils/logger.js";
import { fail } from "../utils/response.js";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new ApiError(404, "NOT_FOUND", `Route not found: ${request.method} ${request.path}`));
};

function isBodyParserError(error: unknown): error is Error & { type: string } {
  return (
    error instanceof Error &&
    "type" in error &&
    typeof error.type === "string" &&
    (error.type === "entity.parse.failed" || error.type === "entity.too.large")
  );
}

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    fail(response, error.statusCode, {
      code: error.code,
      message: error.message,
      ...(error.fields === undefined ? {} : { fields: error.fields }),
    });
    return;
  }

  if (isBodyParserError(error)) {
    const tooLarge = error.type === "entity.too.large";
    fail(response, tooLarge ? 413 : 400, {
      code: "VALIDATION_ERROR",
      message: tooLarge ? "Request body is too large" : "Malformed JSON request body",
      fields: { body: [tooLarge ? "Request body is too large" : "Malformed JSON"] },
    });
    return;
  }

  logger.error({ err: error, requestId: response.getHeader("x-request-id") }, "Unhandled request error");
  const message =
    env.NODE_ENV === "production"
      ? "Internal server error"
      : error instanceof Error
        ? error.message
        : "Internal server error";
  fail(response, 500, { code: "INTERNAL", message });
};
