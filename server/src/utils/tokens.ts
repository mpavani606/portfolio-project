import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createCsrfToken(): string {
  const nonce = randomBytes(32).toString("base64url");
  const signature = createHmac("sha256", env.SESSION_SECRET).update(nonce).digest("base64url");
  return `${nonce}.${signature}`;
}

export function verifyCsrfToken(cookieToken: string | undefined, headerToken: string | undefined): boolean {
  if (cookieToken === undefined || headerToken === undefined) {
    return false;
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  if (cookieBuffer.length !== headerBuffer.length || !timingSafeEqual(cookieBuffer, headerBuffer)) {
    return false;
  }

  const [nonce, signature, extra] = cookieToken.split(".");
  if (
    nonce === undefined ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
    signature === undefined ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature) ||
    extra !== undefined
  ) {
    return false;
  }

  const expected = createHmac("sha256", env.SESSION_SECRET).update(nonce).digest();
  const actual = Buffer.from(signature, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
