import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusPage } from "./pages";

function renderStatusPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StatusPage />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("development status page", () => {
  it("shows readiness from the real API envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { status: "ready" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderStatusPage();
    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ready",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("shows a safe not-ready state without backend details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "INTERNAL", message: "Service not ready" },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    renderStatusPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Service not ready",
    );
    expect(
      screen.queryByText(/mongodb|connection string/i),
    ).not.toBeInTheDocument();
  });
});
