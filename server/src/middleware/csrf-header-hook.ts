import type { Request, RequestHandler } from "express";
import { CSRF_COOKIE } from "../utils/cookies.js";
import { verifyCsrfToken } from "../utils/tokens.js";
import { ApiError } from "../utils/api-error.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

type HeaderVerifier = (request: Request) => boolean;

export function createCsrfHeaderHook(verifier?: HeaderVerifier): RequestHandler {
  return (request, _response, next) => {
    if (safeMethods.has(request.method) || verifier === undefined) {
      next();
      return;
    }

    if (!verifier(request)) {
      next(new ApiError(403, "FORBIDDEN", "CSRF validation failed"));
      return;
    }

    next();
  };
}

export const csrfHeaderHook = createCsrfHeaderHook((request) =>
  verifyCsrfToken(request.cookies?.[CSRF_COOKIE], request.get("x-csrf-token")),
);
