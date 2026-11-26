import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthLayout, DashboardLayout, PublicLayout } from "./layouts";
import { ThemeProvider } from "./theme";

describe("PublicLayout", () => {
  it("provides skip navigation, a responsive menu control, and theme switching", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<h1>Home content</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveTextContent("Home content");
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await user.click(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});

describe("shared layouts", () => {
  it("provides a skip link, main landmark, and footer in the auth layout", () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/auth"]}>
          <Routes>
            <Route path="/auth" element={<AuthLayout />}>
              <Route index element={<h1>Auth content</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#auth-content");
    expect(screen.getByRole("main")).toHaveTextContent("Auth content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("provides a skip link, main landmark, footer, and theme toggle in dashboard layout", () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<h1>Dashboard content</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#dashboard-content");
    expect(screen.getByRole("main")).toHaveTextContent("Dashboard content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeInTheDocument();
  });
});
