import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";

export const SESSION_COOKIE = "qm_session";
export const CSRF_COOKIE = "qm_csrf";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const commonCookieOptions: CookieOptions = {
  path: "/api",
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
};

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(SESSION_COOKIE, token, {
    ...commonCookieOptions,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, {
    ...commonCookieOptions,
    httpOnly: true,
  });
}

export function setCsrfCookie(response: Response, token: string): void {
  response.cookie(CSRF_COOKIE, token, {
    ...commonCookieOptions,
    httpOnly: false,
    maxAge: 24 * 60 * 60 * 1000,
  });
}
