import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ThemeToggle } from "./theme-toggle";

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" to="/" aria-label="Portfolio home">
            Portfolio
          </Link>
          <Button
            className="menu-toggle"
            variant="secondary"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </Button>
          <nav
            id="primary-navigation"
            className="site-nav"
            data-open={menuOpen}
            aria-label="Main navigation"
          >
            <Link to="/" onClick={() => setMenuOpen(false)}>
              Home
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main-content" className="page-container">
        <Outlet />
      </main>
      <footer className="site-footer">Portfolio</footer>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <a className="skip-link" href="#auth-content">
        Skip to content
      </a>
      <div className="auth-frame">
        <header className="auth-header">
          <Link className="brand" to="/">
            Portfolio
          </Link>
          <ThemeToggle />
        </header>
        <main id="auth-content">
          <Outlet />
        </main>
        <footer className="site-footer">Portfolio</footer>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      <a className="skip-link" href="#dashboard-content">
        Skip to content
      </a>
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-inner">
          <Link className="brand" to="/">
            Portfolio
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="dashboard-content" className="dashboard-content">
        <Outlet />
      </main>
      <footer className="site-footer">Portfolio</footer>
    </div>
  );
}
