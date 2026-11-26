import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { appRoutes } from "./routes";
import { ThemeProvider } from "./theme";

describe("application router", () => {
  it("renders the not-found page for an unknown URL", async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ["/this-route-does-not-exist"],
    });
    render(
      <ThemeProvider>
        <Suspense fallback={<p>Loading</p>}>
          <RouterProvider router={router} />
        </Suspense>
      </ThemeProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
  });
});
