import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  apiRequestWithMeta,
  configureCsrfTokenProvider,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "qm_csrf=; Max-Age=0";
});

describe("apiRequest", () => {
  it("unwraps the documented success envelope and includes credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { status: "ready" },
          meta: { source: "test" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ status: string }>("/api/ready")).resolves.toEqual(
      { status: "ready" },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ready",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("returns pagination metadata while keeping apiRequest data-only", async () => {
    const payload = {
      success: true,
      data: [{ id: "project-1" }],
      meta: { page: 2, limit: 10, total: 21, pages: 3 },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/projects")).resolves.toEqual(payload.data);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );
    await expect(apiRequestWithMeta("/api/projects")).resolves.toEqual({
      data: payload.data,
      meta: payload.meta,
    });
  });

  it("bootstraps CSRF when the backend cookie path hides it on dashboard routes", async () => {
    document.cookie = "qm_csrf=cookie-path-token; Path=/api";
    expect(document.cookie).not.toContain("qm_csrf=");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: { token: "csrf-from-api" } }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { saved: true } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/dashboard/settings", {
      method: "PATCH",
      body: JSON.stringify({ theme: "dark" }),
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/auth/csrf");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/dashboard/settings");
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("x-csrf-token"),
    ).toBe("csrf-from-api");
  });

  it("maps error envelopes and field errors into ApiError", async () => {
    const restore = configureCsrfTokenProvider(() => "csrf-value");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              fields: { email: ["Invalid email"] },
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      apiRequest("/api/auth/register", { method: "POST", body: "{}" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      code: "VALIDATION_ERROR",
      status: 400,
      fields: { email: ["Invalid email"] },
    });
    restore();
  });

  it("adds the CSRF header to unsafe requests using the configured token provider", async () => {
    const restore = configureCsrfTokenProvider(() => "csrf-value");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("/api/example", { method: "POST", body: "{}" });
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("x-csrf-token"),
    ).toBe("csrf-value");
    restore();
  });

  it("reads the backend CSRF cookie automatically for unsafe requests", async () => {
    document.cookie = "qm_csrf=cookie-token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("/api/example", { method: "PATCH", body: "{}" });
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("x-csrf-token"),
    ).toBe("cookie-token");
  });

  it("does not send the CSRF header on safe requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("/api/ready");
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("x-csrf-token"),
    ).toBe(false);
  });

  it("represents network failures without exposing browser internals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("socket details")),
    );
    await expect(apiRequest("/api/ready")).rejects.toMatchObject({
      name: "ApiError",
      code: "NETWORK_ERROR",
      message:
        "Unable to reach the service. Check your connection and try again.",
    });
  });
});
