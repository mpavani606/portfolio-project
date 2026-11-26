import type { RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/api-error.js";

export type ValidationTarget = "body" | "query" | "params";

export function getValidated<T>(response: Response, target: ValidationTarget): T {
  const value = response.locals.validated?.[target] as T | undefined;
  if (value === undefined) {
    throw new Error(`Missing validated request ${target}`);
  }
  return value;
}

export function validate<T>(
  schema: ZodType<T>,
  target: ValidationTarget = "body",
): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request[target]);
    if (!result.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.length > 0 ? issue.path.join(".") : target;
        fields[field] = [...(fields[field] ?? []), issue.message];
      }
      next(new ApiError(400, "VALIDATION_ERROR", "Request validation failed", fields));
      return;
    }

    response.locals.validated = {
      ...(response.locals.validated ?? {}),
      [target]: result.data,
    };
    next();
  };
}
