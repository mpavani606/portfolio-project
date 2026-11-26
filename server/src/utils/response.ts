import type { Response } from "express";
import type { ErrorResponse } from "../../../shared/api.js";

export function ok<T>(
  response: Response,
  data: T,
  meta?: Record<string, unknown>,
): Response {
  return response.json({
    success: true,
    data,
    ...(meta === undefined ? {} : { meta }),
  });
}

export function fail(
  response: Response,
  statusCode: number,
  error: ErrorResponse["error"],
): Response {
  return response.status(statusCode).json({ success: false, error });
}
