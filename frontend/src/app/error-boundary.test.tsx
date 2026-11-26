import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./error-boundary";

function BrokenPage(): never {
  throw new Error("private implementation detail");
}

describe("ErrorBoundary", () => {
  it("shows a safe recovery message when a child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <BrokenPage />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The page could not be displayed",
    );
    expect(
      screen.queryByText("private implementation detail"),
    ).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
