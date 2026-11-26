import express from "express";
import request from "supertest";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import app from "../app.js";
import { errorHandler } from "../middleware/error-handler.js";
import { validate } from "../middleware/validate.js";
import { parseEnvironment } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
import { ok } from "../utils/response.js";

describe("API foundation", () => {
  it("returns a liveness success envelope", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: "ok" } });
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("rejects origins outside the configured allowlist", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "https://untrusted.example");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "Origin is not allowed" },
    });
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("reports not ready without exposing MongoDB details", async () => {
    const response = await request(app).get("/api/ready");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: { code: "INTERNAL", message: "Service not ready" },
    });
    expect(JSON.stringify(response.body)).not.toContain("mongodb");
  });

  it("returns a stable 404 envelope", async () => {
    const response = await request(app).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("returns the central error envelope", async () => {
    const testApp = express();
    testApp.get("/failure", (_request, _response, next) => {
      next(new ApiError(403, "FORBIDDEN", "Access denied"));
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get("/failure");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "Access denied" },
    });
  });

  it("returns field details for invalid request bodies", async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.post(
      "/input",
      validate(z.object({ name: z.string().min(1) })),
      (_request, response) => {
        ok(response, response.locals.validated.body);
      },
    );
    testApp.use(errorHandler);

    const response = await request(testApp).post("/input").send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        fields: { name: expect.any(Array) },
      },
    });
  });

  it("fails fast with a clear message when environment configuration is invalid", () => {
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", "import('./server/src/config/env.ts')"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: "not-a-port",
          MONGODB_URI: "not-a-mongodb-uri",
          CLIENT_ORIGIN: "not-a-url",
          SESSION_SECRET: "short",
        },
      },
    );

    expect(child.status).not.toBe(0);
    expect(child.stderr).toContain("Invalid environment configuration");
    expect(child.stderr).toContain("SESSION_SECRET");
    expect(child.stderr).not.toContain(process.env.SESSION_SECRET);
  });

  it("requires an HTTPS public API origin for production asset URLs", () => {
    const productionEnvironment = {
      NODE_ENV: "production",
      PORT: "3000",
      MONGODB_URI: "mongodb://127.0.0.1:27017/portfolio-production",
      CLIENT_ORIGIN: "https://portfolio.example",
      SESSION_SECRET: "production-session-secret-0123456789",
      ASSET_STORAGE_PROVIDER: "s3",
      AWS_REGION: "us-east-1",
      S3_BUCKET: "portfolio-assets",
    };

    expect(() => parseEnvironment(productionEnvironment)).toThrow("PUBLIC_API_ORIGIN");
    expect(() => parseEnvironment({
      ...productionEnvironment,
      PUBLIC_API_ORIGIN: "http://api.example",
    })).toThrow("must use HTTPS");
    expect(parseEnvironment({
      ...productionEnvironment,
      PUBLIC_API_ORIGIN: "https://api.example",
    }).PUBLIC_API_ORIGIN).toBe("https://api.example");
  });
});
